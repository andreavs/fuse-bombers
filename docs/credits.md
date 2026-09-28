# Credits

Much of this repository's scaffolding and a few assets come from
[andeplane/fuse-riders](https://github.com/andeplane/fuse-riders), copied at the time of the initial scaffold (#1).
Their original provenance (for example the prop pack's `README.md` and `generation.json`) is recorded in fuse-riders.

## Code and configuration

| Here                                              | From fuse-riders                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `tsconfig.json`, `eslint.config.js`, `.gitignore` | Root configs of the same names, trimmed to one package                      |
| `.prettierignore`, `pnpm-workspace.yaml` settings | Same files (the workspace file only keeps `onlyBuiltDependencies`)          |
| `.github/workflows/ci.yml`, `pages.yml`           | Modelled on the workflows of the same names, much simplified                |
| `src/app/tokens.css`                              | `packages/fuse-ui/src/tokens.css`, verbatim apart from the header comment   |
| `tests/engine-boundary.test.ts`                   | Import walker from `tests/fixtures/source-guards.ts` / `layer-boundaries`   |
| `index.html`                                      | Root `index.html`                                                           |
| Press Start 2P font                               | Same npm package, `@fontsource/press-start-2p` (SIL Open Font License 1.1)  |
| `AGENTS.md` / `CLAUDE.md`                         | Structure of fuse-riders' agent guide, rewritten for this much smaller repo |

## Assets

| Here                                   | From fuse-riders                                         |
| -------------------------------------- | -------------------------------------------------------- |
| `public/music/coin-op-swing.m4a`       | `public/music/coin-op-swing.m4a`                         |
| `public/music/arcade-adventure.m4a`    | `public/music/arcade-adventure.m4a`                      |
| `public/music/pixel-sax-parade.m4a`    | `public/music/pixel-sax-parade.m4a`                      |
| `public/music/final-chase.m4a`         | `public/music/final-chase.m4a` (candidate sudden-death)  |
| `public/sprites/bomb.svg`, `flame.svg` | `public/themes/clean-neon/bomb.svg`, `flame.svg`         |
| `public/sprites/crate-wood.png`        | `public/props/desert-industrial-v1/crate-small-wood.png` |
| `public/sprites/crate-amber.png`       | `public/props/desert-industrial-v1/crate-wide-amber.png` |

Fuse Riders synthesizes its sound effects in code rather than shipping SFX files, so there were none to copy.
