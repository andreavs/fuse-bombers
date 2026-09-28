import test from "node:test";
import assert from "node:assert/strict";
import {
  createBot,
  isLoaded,
  TICK_HZ,
  type BotDifficulty,
  type RoundState,
} from "../src/engine/index.js";
import { fingerprint, playOut } from "./engine-helpers.js";

// Headless bot checks. Bots press the same one button as humans; these pin that the difficulties
// are ordered, that bot-only rounds finish, and that bots behave (deterministic, no wasted presses).

/** An input script where castle `id` is played by a bot of `kinds[id]`. */
function botInputs(seed: number, kinds: readonly BotDifficulty[]) {
  const bots = kinds.map((difficulty, playerId) =>
    createBot({ difficulty, playerId, seed }),
  );
  const log = { presses: 0, pressedWhileBusy: 0 };
  const inputs = (state: RoundState): boolean[] =>
    bots.map((bot, id) => {
      const press = bot(state);
      if (press) {
        log.presses++;
        if (!isLoaded(state.castles[id] ?? state.castles[0]!))
          log.pressedWhileBusy++;
      }
      return press;
    });
  return { inputs, log };
}

test("hard bots clearly beat easy bots head to head", () => {
  let hardWins = 0;
  const rounds = 12;
  for (let seed = 1; seed <= rounds; seed++) {
    const hard = seed % 2; // swap sides every round
    const kinds: BotDifficulty[] = hard ? ["easy", "hard"] : ["hard", "easy"];
    const s = playOut({ seed, playerCount: 2 }, botInputs(seed, kinds).inputs);
    if (s.result?.winner === hard) hardWins++;
  }
  assert.ok(hardWins >= 9, `hard won only ${hardWins}/${rounds}`);
});

test("bot-only 6-player rounds end within the time limit", () => {
  const mixes: BotDifficulty[][] = [
    ["hard", "hard", "hard", "hard", "hard", "hard"],
    ["easy", "normal", "hard", "easy", "normal", "hard"],
  ];
  for (const [i, kinds] of mixes.entries()) {
    const seed = 40 + i;
    const s = playOut({ seed, playerCount: 6 }, botInputs(seed, kinds).inputs);
    assert.ok(s.result, `mix ${i} did not end`);
    assert.notEqual(s.result.reason, "timeout", `mix ${i} hit the hard stop`);
    assert.ok(s.result.tick / TICK_HZ <= 180);
  }
});

test("bots only press when loaded, and fire regularly", () => {
  for (const difficulty of ["easy", "normal", "hard"] as const) {
    const { inputs, log } = botInputs(5, [difficulty, difficulty, difficulty]);
    const s = playOut({ seed: 5, playerCount: 3 }, inputs);
    assert.equal(log.pressedWhileBusy, 0, `${difficulty} pressed while busy`);
    const volleys = s.castles.reduce((n, c) => n + c.stats.volleys, 0);
    assert.equal(volleys, log.presses, `${difficulty}: a press did not fire`);
    // Reload is 2.6 s; a purposeful bot still fires at least every ~6 s on average.
    for (const c of s.castles.filter((c) => c.alive)) {
      const seconds = s.tick / TICK_HZ;
      assert.ok(
        c.stats.volleys >= seconds / 6,
        `${difficulty}: ${c.stats.volleys} volleys in ${seconds}s`,
      );
    }
  }
});

test("bots are deterministic given the seed", () => {
  const kinds: BotDifficulty[] = ["hard", "normal", "easy"];
  const a = playOut({ seed: 9, playerCount: 3 }, botInputs(9, kinds).inputs);
  const b = playOut({ seed: 9, playerCount: 3 }, botInputs(9, kinds).inputs);
  assert.equal(fingerprint(a), fingerprint(b));
});

test("a bot resets when handed a new round", () => {
  const bot = createBot({ difficulty: "hard", playerId: 0, seed: 1 });
  for (const seed of [1, 2]) {
    const s = playOut({ seed, playerCount: 2 }, (st) => [bot(st)]);
    assert.ok(s.castles[0]!.stats.volleys > 0, `no volley in round ${seed}`);
  }
});
