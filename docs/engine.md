# Engine contract

`src/engine/` is the deterministic simulation of one Fuse Bombers round (plus a tiny match tracker). It has no DOM,
Phaser, npm or `node:` imports; everything else imports it through `src/engine/index.ts`. Design intent is in
[design.md](design.md); this page is the API that render, input/lobby and bot code build on.

## World and time

- Logical arena: `ARENA_WIDTH × ARENA_HEIGHT` = **1600 × 900** pixels, **y grows downward**. Scale this box to the
  screen; never convert units inside the engine.
- Fixed step: `TICK_HZ = 60`, `DT = 1/60`. One `step()` call = one tick. The app accumulates real time and calls `step`
  the right number of times; render interpolation (if any) is the renderer's business.
- Angles are radians in math convention: `0` = pointing right, `π/2` = straight up, `π` = pointing left. A rocket fired
  at angle `a` with speed `v` starts with velocity `(cos a · v, −sin a · v)`.
- Deterministic: a round is a pure function of `RoundConfig` and the sequence of `pressed` arrays. The RNG
  (mulberry32) state lives in `state.rng`; there is no `Math.random`, `Date` or wall clock. Plain JS numbers are used,
  so the guarantee is same-machine/same-runtime (fine for local play).

## Lifecycle

```ts
import {
  createRound,
  step,
  predictTrajectory,
  type RoundView,
} from "../engine/index.js";

const round = createRound({ seed: 1234, playerCount: 4 }); // optional `tuning: Partial<Tuning>`
// every tick:
const events = step(round, pressed); // pressed[playerId] = button went DOWN this tick
render(round as RoundView, events);
if (round.result) {
  /* round over: keep stepping a second or two for the aftermath, then next round */
}
```

- `createRound(config)` → `RoundState`. Throws `RangeError` for `playerCount` outside 2..6.
- `step(state, pressed)` mutates `state` in place and returns this tick's events (also on `state.events`, replaced every
  tick). `pressed` is an **edge** per player id; missing entries count as `false`. A press only fires when the castle
  `isLoaded`. It fires at the angle the castle had _before_ this step, i.e. the angle the player was looking at.
- After `state.result` is set (`phase === "over"`) `step` keeps moving rockets and carving craters for the aftermath but
  never fires, damages or changes the result again.
- `view(state)` returns the same object typed as `RoundView` (deep read-only). Hand render and bots a `RoundView`;
  only the app loop holds the mutable `RoundState`. Everything is plain data, so `structuredClone(state)` works.

Match helper (first to N wins, default 3): `createMatch({ seed, playerCount, winsToWin? })`,
`nextRoundConfig(match)` (derives a fresh seed per round), `recordRoundResult(match, result)` → match winner or null.
Draws count for nobody.

## The view (`RoundView`)

| Field                   | Meaning                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tick`                  | Ticks simulated so far.                                                                                                                                             |
| `phase`                 | `"playing"` → `"sudden-death"` (fuse burnt out) → `"over"`.                                                                                                         |
| `result`                | `null` or `{ winner: id \| null, reason: "last-standing" \| "wipeout" \| "timeout", tick }`.                                                                        |
| `fuseTicks`, `maxTicks` | Fuse length (90 s) and hard stop (180 s). `fuseProgress(view)` gives 0..1 for the fuse bar.                                                                         |
| `terrain`               | `surface[column]` = y of the ground top per 1-px column (solid below). `version` bumps on change; `bedrock` is indestructible.                                      |
| `castles[id]`           | See below. `id` = player index, castles ordered left to right.                                                                                                      |
| `rockets[]`             | `{ id, owner, x, y, vx, vy, power, mega, bomb, gates, age }`. `owner` −1 = sudden-death bomb. `power` > 1 when the cap merged split children into it (draw bigger). |
| `gates[]`               | `{ id, multiplier, x, y, width, height, spawnTick, expireTick, … }` axis-aligned rectangle centred on `x, y`.                                                       |
| `crates[]`              | `{ id, card, x, y, radius, spawnTick }`. Cards: `unit`, `shield`, `rapid`, `repair`, `mega`.                                                                        |
| `tuning`                | The resolved `Tuning` (castle size, shield radius, reload, … everything the renderer needs).                                                                        |

Castle fields: `x, y` (ground contact, bottom centre), `hp / maxHp`, `alive`, `angle`, `arcMin / arcMax`, `sweepDir`,
`facing` (`"left" | "right" | "both"`), `reloadTicks / reloadTotalTicks` (reload ring), `units` (rockets per volley),
`shieldHp`, `megaReady`, `volleyLeft` (rockets still to leave the barrel), and `stats` (volleys, rocketsFired,
damageDealt, kills, gateSplits, crates) for an end-of-round screen. Geometry helpers: `castleCenter(c, tuning)` (hit
circle and shield centre), `launcherPivot(c, tuning)`, `launchState(c, tuning, angle)`.

## Events (`TickEvent`, discriminated on `type`)

Every event carries the `tick` that produced it.

| type                            | payload                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `fired`                         | `castleId, angle, units, mega` — a volley started (rockets leave over the next ~0.1–1 s). |
| `gate-split`                    | `gateId, multiplier, owner, x, y, created` (`created` < multiplier−1 when capped).        |
| `hit`                           | `castleId, owner, x, y, damage, shielded, splash`.                                        |
| `shield-popped`                 | `castleId`.                                                                               |
| `crater`                        | `owner, x, y, radius, x0, x1` (changed columns, inclusive). Can be many per tick.         |
| `castle-destroyed`              | `castleId, by, x, y` (`by` −1 = bomb).                                                    |
| `crate-spawned`                 | `crateId, card, x, y`.                                                                    |
| `crate-taken`                   | `crateId, card, castleId, x, y`.                                                          |
| `gate-spawned` / `gate-expired` | `gateId` (+ `multiplier` on spawn).                                                       |
| `sudden-death-started`          | —                                                                                         |
| `round-over`                    | `result`.                                                                                 |

## Prediction (aiming guide and bots)

`predictTrajectory(view, castleId, angle = current, { maxTicks = 360, stopAtGate = false })` replays exactly the physics
a rocket fired on the next `step` would get (same integrator and sub-steps, gates at their future positions, castles
and shields, current terrain), without the per-rocket random spread. Returns:

- `points`: launch point then one point per tick until impact. The dotted guide draws a prefix (e.g. the first 20).
- `impact`: `{ kind: "terrain" | "castle" | "shield" | "offscreen" | "gate" | "timeout", x, y, tick, castleId }`.
- `gates`: gates crossed in order, with `multiplier` (so a bot can value a ×10 shot), and `crates` it would collect.

`futureAngle(view, castleId, ticks)` gives the launcher angle `ticks` steps from now (the sweep is deterministic), so a
bot with reaction time R can evaluate `predictTrajectory(view, id, futureAngle(view, id, R))` and press R ticks early.
Bots get no other privileged information. Gate motion is also a pure function: `gatePositionAt(gate, tick)`.

## Rules as implemented (defaults in `DEFAULT_TUNING`)

- **Terrain**: height map with rolling hills, a tall peak between each neighbouring pair of castles (and extra hills in
  wide gaps), flattened pads under castles. Every explosion carves a circular crater (removing unsupported rock up to
  one radius above the circle); castles fall onto the highest ground under their footprint.
- **Aim**: edge castles sweep a one-sided arc (8°–82° above the horizon, mirrored) in 1.5 s; middle castles sweep
  10°–170° in 2.4 s. When all living opponents are on one side, the arc narrows to that side.
- **Volleys**: launch speed 900 px/s, gravity 500 px/s². `units` rockets (start 5, max 30) leave every 5 ticks (packed
  tighter for big volleys so a volley lasts ≤ 1 s) with ±1.2° / ±1.5 % spread. Reload 2.6 s (first shot after 1.2 s).
- **Damage**: castle 200 HP. Direct rocket hit 3; ground explosion within reach of a castle deals 50 % splash. Own
  rockets never hurt their own castle or shield. A dying castle leaves a big crater.
- **Gates**: 3 (2–3 players) or 4 (4+ players) gates of ×2/×3/×5/×10 (weights 4/3/2/1) drift slowly and bob, live
  14–22 s and respawn elsewhere. A rocket inside a gate splits into `multiplier` rockets fanned over up to 22°; every
  child remembers the gate so a lineage multiplies once per gate.
- **Rocket cap**: 1500 live rockets. Splits stop creating rockets at 1350 (the remaining 150 are reserved so volleys
  and bombs still appear) and instead multiply the `power` of the rockets that exist, so damage is conserved.
- **Crates**: 2 (3 for 4+ players) floating crates, first at 3 s, respawn 5–9 s. The first rocket to touch one gives its
  owner the card: `unit` +1 rocket per volley, `shield` +50 shield HP (max 100, radius 60), `rapid` reload ×0.75 (min
  1.2 s), `repair` +40 HP, `mega` next volley does ×3 damage with ×2.5 craters. Rockets fly on through crates.
- **Fuse**: 90 s. Then sudden death: bombs (6 damage) fall near random living castles, from one per second to ten per
  second over 40 s, scattering less and less; all damage scales by `1 + suddenDeathSeconds / 30`. Bombs can be
  multiplied by gates too. At 180 s the round is decided on HP (tie = draw).

Headless tuning with these defaults (5–8 seeds per player count; see `tests/engine-match.test.ts` for the asserted version):
"fire whenever loaded" rounds end in 100–135 s for 2–6 players, finished off by sudden death; a script that fires only
when `predictTrajectory` says it will hit (no error, no reaction time) ends 2–3 player rounds in 20–50 s and 4–6
player rounds in 55–130 s, typically losing the first castles at 15–30 s. Real players and bots with error land in
between. A full 6-player round simulates in well under 0.1 s; the worst tick seen (~1350 live rockets) took ~4 ms.
