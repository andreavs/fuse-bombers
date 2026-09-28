// Small pure helpers shared by the simulation and the trajectory predictor.

import { DT, SUBSTEPS, type Tuning } from "./tuning.js";
import type { CastleView, GateView, Vec2 } from "./types.js";

export const DEG = Math.PI / 180;

/** Centre of a castle's hit circle (and of its shield bubble). */
export function castleCenter(c: CastleView, tuning: Tuning): Vec2 {
  return { x: c.x, y: c.y - tuning.castleHeight / 2 };
}

/** Pivot the launcher rotates around. */
export function launcherPivot(c: CastleView, tuning: Tuning): Vec2 {
  return { x: c.x, y: c.y - tuning.launcherHeight };
}

/** Where a rocket fired at `angle` appears, and its velocity (before per-rocket spread). */
export function launchState(
  c: CastleView,
  tuning: Tuning,
  angle: number,
  speed = tuning.launchSpeed,
): { x: number; y: number; vx: number; vy: number } {
  const p = launcherPivot(c, tuning);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: p.x + cos * tuning.barrelLength,
    y: p.y - sin * tuning.barrelLength,
    vx: cos * speed,
    vy: -sin * speed,
  };
}

/** Seconds per rocket sub-step. */
export const SUB_DT = DT / SUBSTEPS;

/** Semi-implicit Euler for one sub-step. Shared by `step` and `predictTrajectory`. */
export function integrate(
  r: { x: number; y: number; vx: number; vy: number },
  gravity: number,
) {
  r.vy += gravity * SUB_DT;
  r.x += r.vx * SUB_DT;
  r.y += r.vy * SUB_DT;
}

/** True once a rocket has left the arena for good (off the sides or below the bottom). */
export function isOffscreen(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return x < -80 || x > width + 80 || y > height + 60;
}

function triangle(u: number, span: number): number {
  if (span <= 0) return 0;
  const period = 2 * span;
  const m = ((u % period) + period) % period;
  return m <= span ? m : period - m;
}

/** Gate centre at an absolute tick (gates move on a fixed, input-independent path). */
export function gatePositionAt(g: GateView, tick: number): Vec2 {
  const elapsed = tick - g.spawnTick;
  const x =
    g.minX + triangle(g.x0 - g.minX + g.vx * elapsed * DT, g.maxX - g.minX);
  const y =
    g.baseY +
    g.bobAmp *
      Math.sin(g.bobPhase + (2 * Math.PI * elapsed) / g.bobPeriodTicks);
  return { x, y };
}

export function insideGate(
  gx: number,
  gy: number,
  g: GateView,
  x: number,
  y: number,
): boolean {
  return Math.abs(x - gx) <= g.width / 2 && Math.abs(y - gy) <= g.height / 2;
}

/** Crate centre at an absolute tick (crates bob in place). */
export function crateYAt(
  baseY: number,
  bobPhase: number,
  spawnTick: number,
  tick: number,
): number {
  return baseY + 6 * Math.sin(bobPhase + (tick - spawnTick) * DT * 2.2);
}
