import Phaser from "phaser";

/** Logical size of the arena; Phaser's FIT scaling letterboxes it into the window. */
export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;

const NAVY = 0x020715;
const HILL = 0x0b1933;
const HILL_EDGE = 0x16e7ff;
const PINK = "#ff2e9d";
const YELLOW = "#ffe46b";

/**
 * Placeholder title screen: proves the Vite + Phaser pipeline end to end. It draws a hill silhouette and the game
 * title; real match rendering will read the engine's view instead.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(NAVY);
    this.drawHills();

    const title = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.36, "FUSE BOMBERS", {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: "64px",
        color: YELLOW,
        stroke: PINK,
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    title.setShadow(0, 0, PINK, 24, true, true);

    const prompt = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.52, "COMING SOON", {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: "20px",
        color: "#16e7ff",
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: prompt,
      alpha: 0.25,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
  }

  private drawHills(): void {
    const g = this.add.graphics();
    const points: Phaser.Math.Vector2[] = [];
    const base = VIEW_HEIGHT * 0.78;
    for (let x = 0; x <= VIEW_WIDTH; x += 16) {
      const t = x / VIEW_WIDTH;
      const y =
        base -
        60 * Math.sin(t * Math.PI * 3) -
        110 * Math.exp(-((t - 0.5) ** 2) / 0.01);
      points.push(new Phaser.Math.Vector2(x, y));
    }
    g.fillStyle(HILL, 1);
    g.beginPath();
    g.moveTo(0, VIEW_HEIGHT);
    for (const p of points) g.lineTo(p.x, p.y);
    g.lineTo(VIEW_WIDTH, VIEW_HEIGHT);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, HILL_EDGE, 0.8);
    g.strokePoints(points);
  }
}
