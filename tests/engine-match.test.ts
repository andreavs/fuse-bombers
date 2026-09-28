import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  createRound,
  isLoaded,
  nextRoundConfig,
  predictTrajectory,
  recordRoundResult,
  TICK_HZ,
  type RoundState,
} from "../src/engine/index.js";
import { playOut } from "./engine-helpers.js";

const LIMIT_SECONDS = 180;

/** A simple aiming script: fire when the predicted shot lands on or near an opponent. */
function aimInputs(state: RoundState): boolean[] {
  return state.castles.map((c) => {
    if (!isLoaded(c)) return false;
    const t = predictTrajectory(state, c.id, undefined, { maxTicks: 300 });
    if (t.impact.kind === "castle" || t.impact.kind === "shield") return true;
    if (t.impact.kind === "terrain") {
      for (const o of state.castles) {
        if (o.alive && o.id !== c.id && Math.abs(o.x - t.impact.x) < 70)
          return true;
      }
    }
    return (state.tick + c.id * 37) % (4 * TICK_HZ) === 0;
  });
}

test("headless 'fire whenever loaded' rounds end within the time limit", () => {
  for (const players of [2, 3, 4, 5, 6]) {
    for (const seed of [1, 2, 3]) {
      let peak = 0;
      const s = playOut({ seed, playerCount: players }, undefined, (st) => {
        peak = Math.max(peak, st.rockets.length);
      });
      assert.ok(s.result, `round ${players}p seed ${seed} did not end`);
      const seconds = s.result.tick / TICK_HZ;
      assert.ok(
        seconds <= LIMIT_SECONDS,
        `${players}p seed ${seed} took ${seconds}s`,
      );
      assert.ok(
        seconds >= 20,
        `${players}p seed ${seed} ended suspiciously fast (${seconds}s)`,
      );
      assert.ok(peak <= s.tuning.maxRockets);
      assert.notEqual(
        s.result.reason,
        "timeout",
        `${players}p seed ${seed} needed the hard limit`,
      );
    }
  }
});

test("headless aiming rounds end within the time limit", () => {
  for (const players of [2, 6]) {
    for (const seed of [4, 5]) {
      const s = playOut({ seed, playerCount: players }, aimInputs);
      assert.ok(s.result);
      assert.ok(s.result.tick / TICK_HZ <= LIMIT_SECONDS);
    }
  }
});

test("a match is first to N round wins, with a fresh seed per round", () => {
  const match = createMatch({ seed: 77, playerCount: 3, winsToWin: 2 });
  const first = nextRoundConfig(match);
  assert.equal(first.playerCount, 3);
  assert.equal(
    recordRoundResult(match, { winner: 1, reason: "last-standing", tick: 100 }),
    null,
  );
  const second = nextRoundConfig(match);
  assert.notEqual(first.seed, second.seed);
  assert.notEqual(
    createRound(first).terrain.surface[800],
    createRound(second).terrain.surface[800],
  );
  assert.equal(
    recordRoundResult(match, { winner: null, reason: "wipeout", tick: 100 }),
    null,
  );
  assert.equal(
    recordRoundResult(match, { winner: 1, reason: "timeout", tick: 100 }),
    1,
  );
  assert.deepEqual(match.wins, [0, 2, 0]);
  assert.equal(match.history.length, 3);
  assert.throws(() => createMatch({ seed: 1, playerCount: 8 }), RangeError);
});
