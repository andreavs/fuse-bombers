import test from "node:test";
import assert from "node:assert/strict";
import { createPlaceholderBot, type Bot } from "../src/app/bot.js";
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

test("both placeholder bots fire, and a finished round is followed by the next one", () => {
  const runner = new RoundRunner({
    seed: 3,
    controllers: [createPlaceholderBot(() => 0.5), createPlaceholderBot()],
    tuning: { castleHp: [0, 0, 12, 12, 12, 12, 12], fuseTime: 20 },
    aftermath: 0.5,
  });
  const first = runner.view;
  const fired = new Set<number>();
  for (let i = 0; i < 60 * 200 && runner.view === first; i++)
    for (const event of runner.advance(STEP_MS))
      if (event.type === "fired") fired.add(event.castleId);
  assert.deepEqual([...fired].sort(), [0, 1], "both bots fired");
  assert.notEqual(runner.view, first, "a new round started");
  assert.equal(runner.view.tick, 1);
  assert.equal(runner.match.history.length, 1);
});
