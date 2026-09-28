// Pure trajectory prediction for the aiming guide and for bots. It replays exactly the physics a
// rocket fired right now would get (same integrator, same sub-steps, gates at their future
// positions), minus the per-rocket random spread. It never mutates the state.

import {
  crateYAt,
  gatePositionAt,
  insideGate,
  integrate,
  isOffscreen,
  launchState,
} from "./geometry.js";
import { surfaceAt } from "./terrain.js";
import { SUBSTEPS, type Card } from "./tuning.js";
import type { RoundView, Vec2 } from "./types.js";

export type ImpactKind =
  "terrain" | "castle" | "shield" | "offscreen" | "gate" | "timeout";

export interface TrajectoryImpact {
  kind: ImpactKind;
  x: number;
  y: number;
  /** Ticks after launch. */
  tick: number;
  /** Castle hit (for "castle" and "shield"), otherwise null. */
  castleId: number | null;
}

export interface Trajectory {
  /** Launch point followed by one point per tick until impact (inclusive). */
  points: Vec2[];
  impact: TrajectoryImpact;
  /** Gates the rocket would pass through (in order), with their multiplier. */
  gates: {
    gateId: number;
    multiplier: number;
    tick: number;
    x: number;
    y: number;
  }[];
  /** Crates the rocket would collect. */
  crates: { crateId: number; card: Card; tick: number }[];
}

export interface PredictOptions {
  /** Stop after this many ticks (default 360 = 6 s). */
  maxTicks?: number;
  /** Stop at the first gate crossing (cheap for bots that only want the gate). Default false. */
  stopAtGate?: boolean;
}

/**
 * Predicts the path of a rocket fired by `castleId` at `angle` (default: its current launcher
 * angle) if its button were pressed on the next `step`.
 */
export function predictTrajectory(
  state: RoundView,
  castleId: number,
  angle?: number,
  options: PredictOptions = {},
): Trajectory {
  const castle = state.castles[castleId];
  if (!castle) throw new RangeError(`no castle ${castleId}`);
  const t = state.tuning;
  const maxTicks = options.maxTicks ?? 360;
  const r = launchState(castle, t, angle ?? castle.angle);
  const points: Vec2[] = [{ x: r.x, y: r.y }];
  const gates: Trajectory["gates"] = [];
  const crates: Trajectory["crates"] = [];
  const passed = new Set<number>();
  const taken = new Set<number>();
  const halfH = t.castleHeight / 2;
  const shieldR = t.shieldRadius + t.rocketRadius;
  const castleR = t.castleRadius + t.rocketRadius;
  const crateR = t.crateRadius + t.rocketRadius;
  const terrain = state.terrain;
  const done = (
    kind: ImpactKind,
    k: number,
    castleHit: number | null = null,
  ): Trajectory => {
    points.push({ x: r.x, y: r.y });
    return {
      points,
      impact: { kind, x: r.x, y: r.y, tick: k + 1, castleId: castleHit },
      gates,
      crates,
    };
  };

  for (let k = 0; k < maxTicks; k++) {
    const tick = state.tick + k;
    for (let s = 0; s < SUBSTEPS; s++) {
      integrate(r, t.gravity);
      if (isOffscreen(r.x, r.y, terrain.width, terrain.height))
        return done("offscreen", k);
      for (const c of state.castles) {
        if (!c.alive || c.id === castleId) continue;
        const dx = r.x - c.x;
        const dy = r.y - (c.y - halfH);
        const d2 = dx * dx + dy * dy;
        if (c.shieldHp > 0 && d2 < shieldR * shieldR)
          return done("shield", k, c.id);
        if (d2 < castleR * castleR) return done("castle", k, c.id);
      }
      if (r.y >= surfaceAt(terrain, r.x)) return done("terrain", k);
      for (const g of state.gates) {
        if (passed.has(g.id) || tick >= g.expireTick) continue;
        const p = gatePositionAt(g, tick);
        if (!insideGate(p.x, p.y, g, r.x, r.y)) continue;
        passed.add(g.id);
        gates.push({
          gateId: g.id,
          multiplier: g.multiplier,
          tick: k,
          x: r.x,
          y: r.y,
        });
        if (options.stopAtGate === true) return done("gate", k);
      }
      for (const crate of state.crates) {
        if (taken.has(crate.id)) continue;
        const dx = r.x - crate.x;
        const dy =
          r.y - crateYAt(crate.baseY, crate.bobPhase, crate.spawnTick, tick);
        if (dx * dx + dy * dy < crateR * crateR) {
          taken.add(crate.id);
          crates.push({ crateId: crate.id, card: crate.card, tick: k });
        }
      }
    }
    points.push({ x: r.x, y: r.y });
  }
  return {
    points,
    impact: { kind: "timeout", x: r.x, y: r.y, tick: maxTicks, castleId: null },
    gates,
    crates,
  };
}
