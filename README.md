# Fuse Bombers

A one-screen party artillery game for 2–6 players (humans and bots). See [docs/design.md](docs/design.md).

Play it at <https://andreavs.github.io/fuse-bombers/>.

## How to play

Every player has one button: `Q`, `C`, `M`, `P`, any arrow key, `Num0`, a gamepad face button, or a tap zone on a
touch screen. In the lobby, press yours to join (again to leave); empty seats are played by bots (click a bot to
change its level, `B` for all). `2`–`6` sets the player count, `R` the rounds to win, and `Enter`/`Space` starts. In a
round, press your button to fire as your launcher sweeps. `Esc` pauses. On a gamepad, Start starts and pauses (or
hold your button for a second in the lobby to start); on a touch screen, tap START and the `II` corner button.

Debug flags: `?seed=N`, `?speed=N` (fast-forward), `?touch` (force touch zones), `?debug` (`window.fuseBombers`).

## Development

```sh
pnpm install
pnpm dev    # http://localhost:5173/
pnpm build && pnpm test && pnpm lint && pnpm format:check
```

See [AGENTS.md](AGENTS.md) for the layout, the engine boundary rule and the PR workflow, and
[docs/credits.md](docs/credits.md) for what was borrowed from fuse-riders.
