import "@fontsource/press-start-2p/latin.css";
import "./tokens.css";
import "./style.css";
import Phaser from "phaser";
import { TitleScene, VIEW_HEIGHT, VIEW_WIDTH } from "../render/title-scene.js";

async function boot(): Promise<void> {
  // Phaser rasterises text once, so the pixel font must be ready before the first scene draws.
  try {
    await document.fonts.load('16px "Press Start 2P"');
  } catch {
    // The monospace fallback is still readable; start without the pixel font rather than not at all.
  }
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: "#020715",
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [TitleScene],
  });
}

boot().catch((error: unknown) => {
  console.error("Fuse Bombers failed to start", error);
});

// Developer aid until the lobby exists: a readout of the one-button input layer.
if (new URLSearchParams(window.location.search).has("inputdebug")) {
  import("./input/debug.js")
    .then(({ startInputDebug }) => startInputDebug())
    .catch((error: unknown) => {
      console.error("Input debug overlay failed to start", error);
    });
}
