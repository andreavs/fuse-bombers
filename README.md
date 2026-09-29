# Fuse Bombers

A one-screen party artillery game for 2–6 players, humans and bots, on one keyboard, a few gamepads or a touch screen.
Castles on treads lob rockets across a destructible landscape, and the rockets fly through multiplier gates to turn a
handful into a swarm.

**Play it: <https://andreavs.github.io/fuse-bombers/>**

![Four castles trading rocket volleys between the multiplier gates, the fuse burning along the top](docs/images/round.png)

## How to play

- **One button each.** Your launcher sweeps back and forth like a metronome. Press your button to fire a volley at the
  current angle; the launcher then reloads. Timing picks range and target, and a dotted guide shows the first part of
  the path.
- **Gates multiply.** Gates (×2, ×3, ×5, ×10) drift in the sky. A rocket that flies through one splits into that many
  rockets, so five rockets through a ×10 gate is fifty.
- **Crates.** Floating crates give a card to the first volley that hits them: an extra rocket per volley, a shield, a
  faster reload, a repair or a mega bomb.
- **Terrain.** Every rocket carves a crater, so the peaks between the castles wear away over the round.
- **The fuse.** The burning fuse across the top is the round timer (90 s). When it burns out, sudden death begins:
  bombs rain down and damage keeps growing. At 3 minutes the round ends on HP: the castle with the most HP wins, and
  a tie is a draw.
- **Winning.** The last castle standing wins the round (a wipe-out is a draw); if more than one is still standing at
  3 minutes, the highest HP wins (a tie is a draw). First to N round wins takes the match;
  N is 3 by default and set in the lobby (up to 9).

## Controls

In the lobby, press your button to join and press it again to leave. Seats up to the player count that nobody holds are
played by bots.

| Device   | Your button                                                   | Menus                                                                                           |
| -------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Keyboard | `Q`, `C`, `M`, `P`, any arrow key, `Num0` (or numpad `Enter`) | `Enter`/`Space` confirm, `Esc` pause or back, `Backspace` quit                                  |
| Gamepad  | Any face button (A/B/X/Y on a standard pad)                   | Start confirms and pauses, Back goes back or pauses; hold your button 1 s in the lobby to start |
| Touch    | Your coloured tap zone along the bottom edge                  | Tap the on-screen buttons; the `II` corner button pauses                                        |

Lobby shortcuts: `2`–`6` sets the player count, `R` cycles rounds to win (1–5; the `+`/`−` buttons go up to 9), `B`
cycles every bot's level, and `Enter` starts. Click a bot to change its level. Mid-round, `Esc` or a pad's Start/Back
pauses; while paused, `Enter`/`Space`/`Esc` resume and `Backspace` quits to the lobby. On the winner screen, `Enter`
plays again and `Esc` or `Backspace` returns to the lobby.

A gamepad that is unplugged and comes back at the same index is the same player. Tap zones appear on touch devices; on
a desktop, `?touch` shows them.

### URL flags

Add them to the address, for example `?mute&speed=4`.

| Flag       | Effect                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------- |
| `?mute`    | No music or sound effects for this load (`?mute=0` or `?mute=false` leaves them on).         |
| `?calm`    | Turns off screen shake and full-screen flashes (also on with the OS reduced-motion setting). |
| `?speed=N` | Runs the game and its timers N times as fast (whole numbers, 1 or more).                     |
| `?seed=N`  | Fixes the random seed so matches replay the same landscapes.                                 |
| `?touch`   | Forces the touch zones on a non-touch device.                                                |
| `?debug`   | Exposes `window.fuseBombers` (`game`, `flow`, `audio`) for browser tests.                    |

## Development

Needs Node 22.13 or newer and pnpm (version pinned in `package.json`; `corepack pnpm …` works without a global install).

```sh
pnpm install
pnpm dev          # Vite dev server on http://localhost:5173/
pnpm build        # type check (tsc --noEmit) and production build
pnpm test         # node:test suites, including the engine
pnpm lint         # eslint
pnpm format       # prettier --write (CI runs format:check)
pnpm flow-check   # Playwright: lobby to match to winner and back (local only, needs Chromium)
```

Open the dev server with `?mute` so you do not blast audio. `pnpm flow-check` needs Chromium once:
`pnpm exec playwright install chromium`.

## More

- [docs/design.md](docs/design.md): the game design.
- [AGENTS.md](AGENTS.md): code layout, the engine boundary rule and the PR workflow.
- [docs/credits.md](docs/credits.md): what was borrowed from fuse-riders, and asset origins.
