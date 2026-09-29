// Plays one match through the real page in Chromium: two keyboard players (Q, P) and two bots, first to 2 wins,
// one pause, round after round (the humans fire now and then) up to the match winner, then play again, pause and
// quit to the lobby. Screenshots every screen and fails on console errors or a wrong flow state.
// Usage (`pnpm exec playwright install chromium` once):
//   pnpm flow-check                          # starts its own Vite dev server
//   node scripts/flow-check.mjs [url] [out]  # against a running server, e.g. "http://localhost:5173/?mute&speed=4"
// HEADED=1 opens a real window.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createServer } from "vite";

const out = process.argv[3] ?? "artifacts/flow";
mkdirSync(out, { recursive: true });
let server;
let url = process.argv[2];
if (!url) {
  server = await createServer({ server: { port: 5190, host: "127.0.0.1" } });
  await server.listen();
  url = `${server.resolvedUrls.local[0]}?mute&speed=4&seed=7`;
}
const browser = await chromium.launch({ headless: process.env.HEADED !== "1" });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const flow = (fn) => page.evaluate(fn);
const screen = () => flow(() => window.fuseBombers.flow.screen.kind);
const waitFor = (...kinds) =>
  page.waitForFunction(
    (k) => k.includes(window.fuseBombers.flow.screen.kind),
    kinds,
    { timeout: 240_000 },
  );
const check = (ok, what) => {
  if (!ok) errors.push(`flow: ${what}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
};
const seats = () =>
  flow(() =>
    window.fuseBombers.flow.lobby.seats().map((s) => `${s.name}:${s.tag}`),
  );

try {
  await page.goto(`${url}${url.includes("?") ? "&" : "?"}debug`);
  await page.waitForFunction(() =>
    window.fuseBombers?.game.scene.getScene("round")?.sys.isActive(),
  );
  await page.waitForTimeout(1500); // The attract round gets going behind the lobby.
  await page.keyboard.press("q");
  await page.keyboard.press("p");
  await page.click('[data-action="wins:-"]');
  await page.click('[data-action="bot:3"]');
  await page.waitForTimeout(400);
  await shot("lobby");
  const joined = (await seats()).join(" ");
  check(joined === "RED:Q BLUE:P GREEN:BOT YELLOW:BOT", `lobby: ${joined}`);

  await page.keyboard.press("Enter");
  await waitFor("playing");
  let [rounds, paused] = [0, false];
  for (let kind; (kind = await screen()) !== "winner";) {
    if (kind === "playing") {
      await page.keyboard.press(Math.random() < 0.5 ? "q" : "p"); // The humans fire now and then.
      if (
        !paused &&
        (await flow(() => window.fuseBombers.flow.view.tick)) > 720
      ) {
        await shot("round");
        await page.keyboard.press("Escape");
        const tick = await flow(() => window.fuseBombers.flow.view.tick);
        await page.waitForTimeout(500);
        await shot("pause");
        const still = await flow(() => window.fuseBombers.flow.view.tick);
        check(
          (await flow(() => window.fuseBombers.flow.paused)) && still === tick,
          "pause freezes the round",
        );
        await page.keyboard.press("Escape");
        check(
          !(await flow(() => window.fuseBombers.flow.paused)),
          "Esc resumes",
        );
        paused = true;
      }
    } else if (kind === "results") {
      await page.waitForTimeout(600);
      if (++rounds === 1) await shot("results");
      await page.keyboard.press("Enter");
      await waitFor("countdown", "playing");
    }
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(800);
  await shot("winner");
  const wins = await flow(() => window.fuseBombers.flow.runner.match.wins);
  check(wins.includes(2), `match over: wins ${wins.join("/")}`);
  check(paused && rounds >= 1, `${rounds} results screens and one pause`);

  await page.keyboard.press("Enter"); // Play again.
  await waitFor("countdown", "playing");
  const again = await flow(() => window.fuseBombers.flow.runner.match.wins);
  check(
    again.every((w) => w === 0),
    "play again resets the wins",
  );
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace"); // Quit to the lobby.
  await waitFor("lobby");
  await page.waitForTimeout(500);
  await shot("lobby-again");
  const kept = (await seats()).join(" ");
  check(kept === joined, `back in the lobby with the same seats: ${kept}`);
} catch (error) {
  errors.push(String(error));
} finally {
  await browser.close();
  await server?.close();
}
if (errors.length) {
  console.error(`errors:\n${errors.join("\n")}`);
  process.exit(1);
}
console.log(`no console errors; screenshots in ${out}/`);
