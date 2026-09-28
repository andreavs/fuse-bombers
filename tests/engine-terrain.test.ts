import test from "node:test";
import assert from "node:assert/strict";
import { arcFor, gatePositionAt, launchState } from "../src/engine/geometry.js";
import { hashSeed, int, random, range, weighted } from "../src/engine/rng.js";
import {
  carveCrater,
  castlePositions,
  generateTerrain,
  highestGround,
  surfaceAt,
} from "../src/engine/terrain.js";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  DEFAULT_TUNING,
} from "../src/engine/tuning.js";
import type { Gate } from "../src/engine/types.js";

function arena(seed: number, players: number, peakScale = 1) {
  const rng = { rng: hashSeed(seed) };
  const xs = castlePositions(rng, players);
  return { xs, terrain: generateTerrain(rng, xs, peakScale) };
}

test("the seeded RNG is deterministic and stays in range", () => {
  const a = { rng: hashSeed(99) };
  const b = { rng: hashSeed(99) };
  const seq = Array.from({ length: 50 }, () => random(a));
  assert.deepEqual(
    seq,
    Array.from({ length: 50 }, () => random(b)),
  );
  assert.ok(seq.every((x) => x >= 0 && x < 1));
  assert.notEqual(hashSeed(99), hashSeed(99, 1));
  assert.notEqual(hashSeed(99), hashSeed(100));
  const r = { rng: 1 };
  const ints = new Set<number>();
  for (let i = 0; i < 500; i++) {
    const x = range(r, -3, 5);
    assert.ok(x >= -3 && x < 5);
    ints.add(int(r, 2, 4));
  }
  assert.deepEqual([...ints].sort(), [2, 3, 4]);
  const picks = { a: 0, b: 0 };
  for (let i = 0; i < 2000; i++) {
    const item = weighted(r, ["a", "b"] as const, (x) => (x === "a" ? 3 : 1));
    picks[item]++;
  }
  assert.ok(picks.a > 2 * picks.b, JSON.stringify(picks));
  assert.equal(
    weighted(r, ["only"], () => 0),
    "only",
  );
});

test("castles are spread across the width, edges inward", () => {
  for (let n = 2; n <= 6; n++) {
    const { xs } = arena(n, n);
    assert.equal(xs.length, n);
    for (let i = 1; i < n; i++)
      assert.ok((xs[i] ?? 0) - (xs[i - 1] ?? 0) > 150, xs.join(","));
    assert.ok((xs[0] ?? 0) >= 110 && (xs[0] ?? 0) < 200);
    assert.ok((xs[n - 1] ?? 0) <= ARENA_WIDTH - 110);
    assert.ok((xs[n - 1] ?? 0) > ARENA_WIDTH - 200);
  }
});

test("terrain has flat pads under castles and tall peaks between them", () => {
  for (let n = 2; n <= 6; n++) {
    const { xs, terrain } = arena(7 * n, n);
    assert.equal(terrain.surface.length, ARENA_WIDTH);
    for (const y of terrain.surface)
      assert.ok(y >= 290 && y < terrain.bedrock, `surface ${y}`);
    for (let i = 0; i < n; i++) {
      const x = xs[i] ?? 0;
      const pad = highestGround(terrain, x - 32, x + 32);
      assert.ok(surfaceAt(terrain, x) - pad < 2, "pad is flat");
      const next = xs[i + 1];
      if (next === undefined) continue;
      const peak = highestGround(terrain, x + 40, next - 40);
      const low = Math.max(pad, highestGround(terrain, next - 32, next + 32));
      assert.ok(peak < low - 60, `peak between ${i} and ${i + 1} at ${peak}`);
    }
  }
});

test("peakScale lowers the peaks and zero leaves rolling hills", () => {
  const full = arena(5, 4).terrain;
  const tame = arena(5, 4, 0).terrain;
  assert.ok(
    highestGround(tame, 0, ARENA_WIDTH) >
      highestGround(full, 0, ARENA_WIDTH) + 100,
  );
});

test("crater carving lowers the surface but never below bedrock", () => {
  const { terrain } = arena(11, 2);
  const x = 800;
  const y0 = terrain.surface[x] ?? 0;
  const changed = carveCrater(terrain, x + 0.5, y0, 20);
  assert.ok(changed && changed.x0 <= x && changed.x1 >= x);
  assert.ok(Math.abs((terrain.surface[x] ?? 0) - (y0 + 20)) < 0.5);
  assert.equal(terrain.version, 1);
  for (let i = 0; i < 100; i++)
    carveCrater(terrain, x, terrain.surface[x] ?? 0, 30);
  assert.equal(terrain.surface[x], terrain.bedrock);
  assert.equal(carveCrater(terrain, x, terrain.bedrock, 10), null);
  assert.ok(surfaceAt(terrain, -5) > ARENA_HEIGHT, "outside is a pit");
});

test("arcs are mirrored for left-facing castles and launch follows the angle", () => {
  const t = DEFAULT_TUNING;
  const [rl, rh] = arcFor("right", t);
  const [ll, lh] = arcFor("left", t);
  assert.ok(Math.abs(rl + lh - Math.PI) < 1e-12);
  assert.ok(Math.abs(rh + ll - Math.PI) < 1e-12);
  assert.ok(rh < Math.PI / 2 && ll > Math.PI / 2);
  const [wl, wh] = arcFor("both", t);
  assert.ok(wl < rh && wh > ll);
  const up = launchState({ x: 100, y: 500 }, t, Math.PI / 2);
  assert.ok(Math.abs(up.vx) < 1e-9 && up.vy === -t.launchSpeed);
  assert.equal(up.y, 500 - t.launcherHeight - t.barrelLength);
});

test("gates drift inside their range and bob around their base height", () => {
  const gate: Gate = {
    id: 1,
    multiplier: 2,
    x: 0,
    y: 0,
    width: 22,
    height: 110,
    spawnTick: 100,
    expireTick: 10_000,
    x0: 700,
    vx: 30,
    minX: 600,
    maxX: 800,
    baseY: 300,
    bobAmp: 14,
    bobPeriodTicks: 200,
    bobPhase: 0,
  };
  assert.deepEqual(gatePositionAt(gate, 100), { x: 700, y: 300 });
  for (let tick = 100; tick < 3000; tick += 7) {
    const p = gatePositionAt(gate, tick);
    assert.ok(p.x >= 600 && p.x <= 800);
    assert.ok(Math.abs(p.y - 300) <= 14 + 1e-9);
  }
});
