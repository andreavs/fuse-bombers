import "@fontsource/press-start-2p/latin.css";
import "./tokens.css";
import "./style.css";
import Phaser from "phaser";
import { ARENA_HEIGHT, ARENA_WIDTH } from "../engine/index.js";
import { css, playerColor } from "../render/palette.js";
import { RoundScene, type RoundSceneData } from "../render/round-scene.js";
import { createPlaceholderBot } from "./bot.js";
import { createBrowserInput } from "./input/index.js";
import { RoundRunner, type PressSource } from "./round-runner.js";

const PLAYERS = 4;
const params = new URLSearchParams(window.location.search);

/**
 * Until the lobby exists the page is an attract mode: four bots play round after round. `?play` hands player 1 to
 * the first button pressed (a key, a gamepad or a touch zone); `?seed=N` fixes the match;
 * `?debug` exposes `window.fuseBombers = { game, runner }` for browser tests.
 */
function startRunner(): RoundRunner {
  const play = params.has("play");
  let input: PressSource | undefined;
  if (play) {
    const browser = createBrowserInput();
    const { hub } = browser;
    hub.onPress((device) => {
      if (hub.deviceOf(0) === undefined) hub.bind(0, device);
    });
    browser.setTouchZones([{ label: "P1", color: css(playerColor(0)) }]);
    input = hub;
  }
  const bot = createPlaceholderBot();
  return new RoundRunner({
    seed: Number(params.get("seed")) || Math.floor(Math.random() * 2 ** 31),
    controllers: Array.from({ length: PLAYERS }, (_, id) =>
      play && id === 0 ? null : bot,
    ),
    input,
  });
}

async function boot(): Promise<void> {
  // Phaser rasterises text once, so the pixel font must be ready before the first scene draws.
  try {
    await document.fonts.load('16px "Press Start 2P"');
  } catch {
    // The monospace fallback is still readable; start without the pixel font rather than not at all.
  }
  const runner = startRunner();
  const data: RoundSceneData = { source: runner }; // Players get the default looks ("PLAYER N").
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    backgroundColor: "#0b1020",
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
  game.scene.add(RoundScene.KEY, RoundScene, true, data);
  if (params.has("debug"))
    Object.assign(window, { fuseBombers: { game, runner } });
}

boot().catch((error: unknown) => {
  console.error("Fuse Bombers failed to start", error);
});

// Developer aid until the lobby exists: a readout of the one-button input layer.
if (params.has("inputdebug")) {
  import("./input/debug.js")
    .then(({ startInputDebug }) => startInputDebug())
    .catch((error: unknown) => {
      console.error("Input debug overlay failed to start", error);
    });
}
