# Working on Fuse Bombers

Fuse Bombers is a one-screen party artillery game for 2–6 local players (humans and bots). The design is in
[docs/design.md](docs/design.md). It is a static site (no backend) built with TypeScript, Vite and Phaser 4, deployed
to GitHub Pages at <https://andreavs.github.io/fuse-bombers/>. Tooling is borrowed from `andeplane/fuse-riders`, but
this repo is deliberately much simpler: one package, no server, no netcode.

## Layout

| Path          | Owns                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `src/engine/` | Deterministic, fixed-step, seeded simulation: terrain, castles, rockets, gates, crates, fuse, bots.   |
| `src/render/` | Phaser scenes that draw the engine's state. No game rules or authoritative timers.                    |
| `src/app/`    | Entry (`main.ts`), menus/lobby, input (keyboard, gamepad, touch), audio, match flow, CSS tokens.      |
| `tests/`      | `node:test` suites run by `tsx --test tests/*.test.ts`. Engine tests go in `tests/engine*.test.ts`.   |
| `public/`     | Static assets served as-is (`music/`, `sprites/`). See [docs/credits.md](docs/credits.md) for origin. |
| `docs/`       | Design and credits.                                                                                   |

## The engine boundary

`src/engine/` imports nothing outside itself: no `render/`, no `app/`, no Phaser, no npm or `node:` packages, and no
DOM globals (`window`, `document`, `performance`, `Date.now`, `Math.random`). Randomness comes from a seeded RNG in the
engine, time from the fixed step. `render/` and `app/` import the engine, never the reverse.
[tests/engine-boundary.test.ts](tests/engine-boundary.test.ts) fails on a cross-layer import; fix it by moving the
concept to the layer that owns it, not by adding an exception. Bots use the same one-button input as humans and get no
privileged physics.

## Commands

Use pnpm (version pinned in `package.json`; `corepack pnpm …` works without a global install).

```sh
pnpm install
pnpm dev            # Vite dev server on http://localhost:5173/
pnpm build          # tsc --noEmit && vite build (this is also the type check)
pnpm test           # tsx --test tests/*.test.ts
pnpm lint           # eslint (small type-aware rule set)
pnpm format         # prettier --write . ; CI runs format:check
pnpm flow-check     # Playwright: lobby → match → pause → winner → play again → lobby (local only, needs Chromium)
```

Conventions: TypeScript strict with `noUncheckedIndexedAccess`; relative imports use the `.js` extension
(`import { x } from "./world.js"`); reference files in `public/` through `import.meta.env.BASE_URL` so they work under
the `/fuse-bombers/` Pages base. Open the game with `?mute` when testing so you do not blast audio.

## Pull requests

- One PR per issue, on a branch named `claude/<topic>`. Put `Closes #N` in the PR body.
- Before opening, run `pnpm build && pnpm test && pnpm lint && pnpm format:check`, and for visible changes check the
  page in `pnpm dev`. Say in the PR what you verified and what you could not.
- CI (`.github/workflows/ci.yml`) runs format, lint, build and test; `verify` is the single gate to wait on. Watch it
  with one `gh pr checks <n> --watch`, not a polling loop.
- Merging to main deploys to GitHub Pages (`.github/workflows/pages.yml`). Do not merge unless the user asks.
- For gameplay, feel or visual changes, leave the PR open with playtesting instructions; green CI is not the user's
  acceptance of how it plays.
