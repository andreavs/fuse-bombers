import test from "node:test";
import assert from "node:assert/strict";
import {
  ARENA_WIDTH,
  TICK_HZ,
  castleCenter,
  createBot,
  createRound,
  ghostOf,
  ghostPositionAt,
  isGhostLoaded,
  predictGhostBomb,
  step,
  type BotDifficulty,
  type RoundState,
  type TickEvent,
  type Tuning,
} from "../src/engine/index.js";
import {
  addRocket,
  clearSky,
  fingerprint,
  placeGate,
  playOut,
} from "./engine-helpers.js";

// Ghost bombers: eliminated players fly a blimp along the top of the arena and drop bombs.

function run(
  state: RoundState,
  ticks: number,
  inputs: (s: RoundState) => boolean[] = () => [],
): TickEvent[] {
  const all: TickEvent[] = [];
  for (let i = 0; i < ticks && !state.result; i++)
    all.push(...step(state, inputs(state)));
  return all;
}

const only = <T extends TickEvent["type"]>(events: TickEvent[], type: T) =>
  events.filter((e): e is Extract<TickEvent, { type: T }> => e.type === type);

/** A 3-player round with castle 1 destroyed by a rocket from castle 0; returns its ghost. */
function withGhost(seed = 21, tuning: Partial<Tuning> = {}) {
  const s = createRound({ seed, playerCount: 3, tuning });
  clearSky(s);
  const victim = s.castles[1];
  assert.ok(victim);
  victim.hp = 1;
  const c = castleCenter(victim, s.tuning);
  addRocket(s, { owner: 0, x: c.x, y: c.y - 40, vy: 600 });
  const events = run(s, 10);
  return { s, events, ghost: ghostOf(s, 1) };
}

test("a destroyed castle's owner becomes a ghost above the wreck", () => {
  const { s, events, ghost } = withGhost();
  const spawned = only(events, "ghost-spawned");
  assert.equal(spawned.length, 1);
  assert.ok(ghost);
  assert.equal(spawned[0]?.owner, 1);
  assert.ok(Math.abs((spawned[0]?.x ?? 0) - (s.castles[1]?.x ?? 0)) < 1);
  assert.equal(ghost.y, s.tuning.ghostY);
  assert.ok(ghost.reloadTicks > 0 && !isGhostLoaded(ghost));
  assert.equal(s.ghosts.length, 1);
  assert.equal(s.result, null, "ghosts do not end or win the round");

  const off = withGhost(21, { ghosts: false });
  assert.equal(off.ghost, undefined);
  assert.equal(only(off.events, "ghost-spawned").length, 0);
});

test("ghosts drift at constant speed and bounce between the edges", () => {
  const { s, ghost } = withGhost();
  assert.ok(ghost);
  let flips = 0;
  let dir = Math.sign(ghost.vx);
  for (let i = 0; i < TICK_HZ * 40; i++) {
    step(s);
    const p = ghostPositionAt(ghost, s.tick);
    assert.ok(Math.abs(p.x - ghost.x) < 1e-6 && p.vx === ghost.vx);
    assert.ok(ghost.x >= ghost.minX - 1e-9 && ghost.x <= ghost.maxX + 1e-9);
    if (Math.sign(ghost.vx) !== dir) flips++;
    dir = Math.sign(ghost.vx);
  }
  assert.ok(ghost.minX > 0 && ghost.maxX < ARENA_WIDTH);
  assert.ok(flips >= 2, `flips ${flips}`);
});

test("pressing drops one bomb per reload; it lands where predictGhostBomb says", () => {
  const { s, ghost } = withGhost(23);
  assert.ok(ghost);
  assert.equal(
    only(
      run(s, 1, () => [false, true]),
      "ghost-bomb-dropped",
    ).length,
    0,
  );
  while (!isGhostLoaded(ghost)) step(s);
  const predicted = predictGhostBomb(s, 1);
  assert.ok(predicted);
  const [x, vx] = [ghost.x, ghost.vx];
  const dropped = only(step(s, [false, true]).slice(), "ghost-bomb-dropped");
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0]?.x, x);
  const bomb = s.rockets.find((r) => r.id === dropped[0]?.rocketId);
  assert.ok(bomb?.ghost && bomb.vx === vx && !bomb.bomb);
  assert.ok(ghost.reloadTicks > 0);
  const events = run(s, 400, () => [false, true]);
  assert.equal(only(events, "ghost-bomb-dropped").length >= 1, true);
  const hit = only(events, "ghost-bomb-hit").find(
    (e) => e.rocketId === bomb.id,
  );
  assert.ok(hit, "the bomb blew up");
  assert.ok(Math.abs(hit.x - predicted.impact.x) < 1, `${hit.x} vs predicted`);
  assert.equal(
    s.castles[1]?.stats.ghostBombs,
    1 + only(events, "ghost-bomb-dropped").length,
  );
});

test("ghost bombs hit castles and carve craters, but gates and crates ignore them", () => {
  const s = createRound({ seed: 24, playerCount: 3 });
  clearSky(s);
  const t = s.tuning;
  const target = s.castles[2];
  assert.ok(target);
  s.castles[1]!.alive = false;
  const c = castleCenter(target, t);
  // A gate and a crate in the way.
  placeGate(s, c.x, c.y - 200, 10);
  s.crates.push({
    id: 998,
    card: "unit",
    x: c.x,
    y: c.y - 300,
    baseY: c.y - 300,
    bobPhase: 0,
    radius: 20,
    spawnTick: 0,
  });
  addRocket(s, { owner: 1, ghost: true, x: c.x, y: c.y - 400, vy: 60 });
  const events = run(s, 120);
  assert.equal(only(events, "gate-split").length, 0);
  assert.equal(only(events, "crate-taken").length, 0);
  const hit = only(events, "ghost-bomb-hit");
  assert.equal(hit.length, 1);
  assert.deepEqual(hit[0]?.castleIds, [2]);
  assert.equal(hit[0]?.damage, t.ghostBombDamage);
  assert.equal(target.hp, target.maxHp - t.ghostBombDamage);
  assert.equal(s.castles[1]?.stats.ghostDamage, t.ghostBombDamage);
  assert.equal(s.castles[1]?.stats.damageDealt, t.ghostBombDamage);

  // On open ground: a ghost-sized crater, no damage.
  const version = s.terrain.version;
  addRocket(s, { owner: 1, ghost: true, x: 800, y: 60, vy: 60 });
  const ground = run(s, 200);
  const crater = only(ground, "crater")[0];
  assert.equal(crater?.radius, t.ghostCraterRadius);
  assert.ok(s.terrain.version > version);
  const miss = only(ground, "ghost-bomb-hit")[0];
  assert.ok(miss && Math.abs(miss.x - crater.x) < 1e-9);
});

test("ghosts cannot win: the last castle standing wins while ghosts fly", () => {
  const { s } = withGhost(25);
  const last = s.castles[2];
  assert.ok(last);
  last.hp = 1;
  const c = castleCenter(last, s.tuning);
  addRocket(s, { owner: 0, x: c.x, y: c.y - 40, vy: 600 });
  run(s, 10);
  assert.equal(s.result?.winner, 0);
  assert.equal(s.result?.reason, "last-standing");
  assert.equal(s.ghosts.length, 2);
  const after = run(s, 600, () => [true, true, true]);
  assert.equal(
    only(after, "ghost-bomb-dropped").length,
    0,
    "no drops after the round",
  );
});

function bots(seed: number, kinds: readonly BotDifficulty[]) {
  const all = kinds.map((difficulty, playerId) =>
    createBot({ difficulty, playerId, seed }),
  );
  return (s: RoundState) => all.map((bot) => bot(s));
}

test("ghost rounds are deterministic and replay from a clone", () => {
  const kinds: BotDifficulty[] = ["hard", "normal", "easy", "hard"];
  const a = playOut({ seed: 31, playerCount: 4 }, bots(31, kinds));
  const b = playOut({ seed: 31, playerCount: 4 }, bots(31, kinds));
  assert.ok(
    a.castles.some((c) => c.stats.ghostBombs > 0),
    "no ghost dropped",
  );
  assert.equal(fingerprint(a), fingerprint(b));

  // Everyone mashes their button: castles fire and ghosts drop whenever loaded.
  const mash = (st: RoundState) => st.castles.map(() => true);
  const c = createRound({ seed: 32, playerCount: 5 });
  while (c.ghosts.length < 2 && !c.result) step(c, mash(c));
  assert.equal(c.result, null);
  const d = structuredClone(c);
  run(c, 1200, mash);
  run(d, 1200, mash);
  assert.ok(c.castles.some((k) => k.stats.ghostBombs > 0));
  assert.equal(fingerprint(d), fingerprint(c));
});

test("balance: bot rounds with ghosts end in similar time and ghosts do not dominate", () => {
  const kinds: BotDifficulty[] = [
    "normal",
    "hard",
    "easy",
    "normal",
    "hard",
    "easy",
  ];
  const lengths = { on: [] as number[], off: [] as number[] };
  let ghost = 0;
  let total = 0;
  for (const players of [3, 4, 5, 6]) {
    for (const seed of [1, 2, 3]) {
      for (const on of [true, false]) {
        const s = playOut(
          { seed, playerCount: players, tuning: { ghosts: on } },
          bots(seed, kinds.slice(0, players)),
        );
        assert.ok(
          s.result && s.result.tick < s.maxTicks,
          `${players}p seed ${seed} hit the hard stop`,
        );
        (on ? lengths.on : lengths.off).push(s.result.tick / TICK_HZ);
        if (!on) continue;
        for (const c of s.castles) {
          ghost += c.stats.ghostDamage;
          total += c.stats.damageDealt;
        }
      }
    }
  }
  const median = (xs: number[]) =>
    [...xs].sort((a, b) => a - b)[xs.length >> 1] ?? 0;
  const [on, off] = [median(lengths.on), median(lengths.off)];
  assert.ok(
    on <= off * 1.1 && on >= off * 0.6,
    `median ${on}s with ghosts vs ${off}s without`,
  );
  const share = ghost / total;
  assert.ok(share > 0.02 && share < 0.25, `ghost damage share ${share}`);
});
