import "@fontsource/press-start-2p/latin.css";
import "./tokens.css";
import "./style.css";
import "./screens.css";
import Phaser from "phaser";
import { ARENA_HEIGHT, ARENA_WIDTH } from "../engine/index.js";
import { RoundScene, type RoundSceneData } from "../render/round-scene.js";
import { createAudio } from "./audio/index.js";
import { Flow } from "./flow.js";
import { createBrowserInput } from "./input/index.js";

const params = new URLSearchParams(window.location.search);
/** Music and effects; `?mute` disables them for this load. */
const audio = createAudio();

/**
 * Boots the game: the Phaser round scene fills the window and the match flow's DOM screens sit on top.
 * Debug flags: `?seed=N` fixes the matches, `?speed=N` runs everything N times as fast, `?touch` forces touch
 * zones, `?debug` exposes `window.fuseBombers = { game, flow, audio }` for browser tests. `?mute` silences audio.
 */
async function boot(): Promise<void> {
  // Phaser rasterises text once, so the pixel font must be ready before the first scene draws.
  try {
    await document.fonts.load('16px "Press Start 2P"');
  } catch {
    // The monospace fallback is still readable; start without the pixel font rather than not at all.
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    backgroundColor: "#0b1020",
    banner: false,
    audio: { noAudio: true }, // Sound is ./audio's, not Phaser's.
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
  game.scene.add(RoundScene.KEY, RoundScene);
  // Every (re)start of the round scene needs the audio attached again; the attract round behind the lobby stays
  // silent so the lobby music plays.
  let detachAudio: (() => void) | undefined;
  let attractMode = true;
  const attachAudio = (): void => {
    detachAudio?.();
    const scene = game.scene.getScene(RoundScene.KEY);
    detachAudio = scene && !attractMode ? audio.attachRound(scene) : undefined;
  };
  // Scenes get their event emitter when the game boots.
  game.events.once(Phaser.Core.Events.READY, attachAudio);
  const root = document.createElement("div");
  root.id = "screen";
  document.body.append(root);
  audio.mountToggle(); // After `#screen`, so screens.css can hide it mid-round.
  const flow = new Flow({
    input: createBrowserInput(window, { forceTouch: params.has("touch") }),
    root,
    seed: Number(params.get("seed")) || Math.floor(Math.random() * 2 ** 31),
    speed: Number(params.get("speed")) || 1,
    show: (source, players, attract) => {
      const data: RoundSceneData = { source, players };
      game.scene.start(RoundScene.KEY, data);
      attractMode = attract;
      attachAudio();
    },
    music: (kind) => audio.music(kind),
  });
  if (params.has("debug"))
    Object.assign(window, { fuseBombers: { game, flow, runner: flow, audio } }); // `runner.view` for browser-check.mjs
}

boot().catch((error: unknown) => {
  console.error("Fuse Bombers failed to start", error);
});

// Developer aid: a readout of the one-button input layer.
if (params.has("inputdebug")) {
  import("./input/debug.js")
    .then(({ startInputDebug }) => startInputDebug())
    .catch((error: unknown) => {
      console.error("Input debug overlay failed to start", error);
    });
}
