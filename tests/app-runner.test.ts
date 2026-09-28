import test from "node:test";
import assert from "node:assert/strict";
import { createBotPlayer, type Bot } from "../src/app/bot.js";
import { RoundRunner } from "../src/app/round-runner.js";

const STEP_MS = 1000 / 60;
const idle: Bot = () => false;

test("the runner steps the engine at 60 Hz from frame times and carries the remainder", () => {
  const runner = new RoundRunner({ seed: 1, controllers: [idle, idle] });
  runner.advance(STEP_MS * 2.5);
  assert.equal(runner.view.tick, 2);
  runner.advance(STEP_MS * 0.6);
  assert.equal(runner.view.tick, 3);
  runner.advance(10_000); // a stalled tab does not fast-forward the whole gap
  assert.ok(runner.view.tick <= 3 + 6);
});

test("the runner asks bots per step and takes human presses from the input source", () => {
  const asked: number[] = [];
  const bot: Bot = (view, id) => {
    asked.push(id);
    return view.tick === 80;
  };
  let humanPresses = 0;
  const runner = new RoundRunner({
    seed: 2,
    controllers: [null, bot],
    input: {
      takePresses: (slots) => {
        assert.equal(slots, 2);
        return [++humanPresses === 90, false];
      },
    },
  });
  const fired: number[] = [];
  for (let i = 0; i < 100; i++)
    for (const event of runner.advance(STEP_MS))
      if (event.type === "fired") fired.push(event.castleId);
  assert.ok(asked.length >= 100 && asked.every((id) => id === 1));
  assert.deepEqual(fired, [1, 0]);
});

test("real bots fire, the result is recorded as the round ends, and the next round follows", () => {
  const runner = new RoundRunner({
    seed: 3,
    controllers: [createBotPlayer("hard", 0, 1), createBotPlayer("easy", 1, 2)],
    tuning: { castleHp: [0, 0, 12, 12, 12, 12, 12], fuseTime: 20 },
    aftermath: 0.5,
  });
  const first = runner.view;
  const fired = new Set<number>();
  let recordedAtEnd = false;
  for (let i = 0; i < 60 * 200 && runner.view === first; i++)
    for (const event of runner.advance(STEP_MS)) {
      if (event.type === "fired") fired.add(event.castleId);
      if (event.type === "round-over")
        recordedAtEnd = runner.match.history.length === 1;
    }
  assert.deepEqual([...fired].sort(), [0, 1], "both bots fired");
  assert.ok(recordedAtEnd, "the match saw the result as the round ended");
  assert.notEqual(runner.view, first, "a new round started");
  assert.equal(runner.view.tick, 1);
  assert.equal(runner.match.history.length, 1);
});

test("with an infinite aftermath the runner holds a finished round until nextRound()", () => {
  const runner = new RoundRunner({
    seed: 4,
    controllers: [createBotPlayer("hard", 0, 1), createBotPlayer("hard", 1, 2)],
    tuning: { castleHp: [0, 0, 8, 8, 8, 8, 8], fuseTime: 10 },
    aftermath: Infinity,
    winsToWin: 1,
  });
  const first = runner.view;
  for (let i = 0; i < 60 * 300 && !first.result; i++) runner.advance(STEP_MS);
  for (let i = 0; i < 600; i++) runner.advance(STEP_MS);
  assert.ok(first.result, "the round ended");
  assert.equal(runner.view, first, "still the finished round");
  const winner = first.result.winner;
  assert.equal(runner.match.winner, winner);
  runner.nextRound();
  assert.notEqual(runner.view, first);
  if (winner !== null)
    assert.equal(runner.match.history.length, 0, "a decided match restarts");
});
