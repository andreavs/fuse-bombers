// Shared helpers for the engine tests (not a test file itself).

import type { RoundState } from "../src/engine/index.js";

/** A compact fingerprint of everything that matters in a state. */
export function fingerprint(state: RoundState): string {
  let terrain = 0;
  for (let i = 0; i < state.terrain.surface.length; i++) {
    terrain += (state.terrain.surface[i] ?? 0) * ((i % 7) + 1);
  }
  return JSON.stringify({
    tick: state.tick,
    phase: state.phase,
    result: state.result,
    rng: state.rng,
    terrain,
    castles: state.castles,
    rockets: state.rockets.map((r) => [r.id, r.x, r.y, r.vx, r.vy, r.power]),
    gates: state.gates.map((g) => [g.id, g.x, g.y, g.multiplier]),
    crates: state.crates.map((k) => [k.id, k.x, k.y, k.card]),
  });
}
