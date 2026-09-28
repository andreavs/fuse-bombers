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

test("a NaN, infinite or negative frame time counts as no time and does not freeze the loop", () => {
  const runner = new RoundRunner({ seed: 4, controllers: [idle, idle] });
  runner.advance(STEP_MS * 1.5);
  assert.equal(runner.view.tick, 1);
  for (const bad of [NaN, Infinity, -Infinity, -STEP_MS * 3]) {
    runner.advance(bad);
    assert.equal(runner.view.tick, 1, `${bad} advances nothing`);
  }
  runner.advance(STEP_MS * 0.6); // the half step carried from before still counts
  assert.equal(runner.view.tick, 2);
  runner.advance(STEP_MS);
  assert.equal(runner.view.tick, 3);
});

test("one advance never spans two rounds: the next round starts on the following frame", () => {
  let frame: number[] = [];
  const watcher: Bot = (view) => {
    frame.push(view.tick);
    return false;
  };
  const runner = new RoundRunner({
    seed: 5,
    controllers: [watcher, createPlaceholderBot()],
    tuning: { castleHp: [0, 0, 12, 12, 12, 12, 12], fuseTime: 20 },
    aftermath: 0.5,
  });
  let current = runner.view;
  let restarts = 0;
  for (let i = 0; i < 60 * 40 && restarts < 2; i++) {
    frame = [];
    const events = runner.advance(STEP_MS * 6); // the most steps one frame runs
    const ticks = frame;
    for (let k = 1; k < ticks.length; k++)
      assert.ok(ticks[k]! > ticks[k - 1]!, `frame ${i} spans a restart`);
    for (const event of events)
      assert.ok(ticks.includes(event.tick), `${event.type} is from this frame`);
    if (runner.view === current) continue;
    restarts++;
    current = runner.view;
    // Every step of this frame ran in the new round, so its events are new-round events.
    assert.equal(ticks[0], 0);
    assert.equal(runner.view.tick, ticks.length);
  }
  assert.equal(restarts, 2, "rounds finished and restarted");
});
