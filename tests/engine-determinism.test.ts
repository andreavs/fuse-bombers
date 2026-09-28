import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Complements tests/engine-boundary.test.ts (imports): the engine must not reach for ambient
// nondeterminism either. Randomness comes from the seeded RNG, time from the fixed step.

const engineDir = fileURLToPath(new URL("../src/engine", import.meta.url));

function engineFiles(dir = engineDir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return engineFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

test("the engine uses no wall clock, Math.random or DOM globals", () => {
  const banned = [
    /Math\.random/,
    /\bDate\b/,
    /\bperformance\./,
    /\bwindow\./,
    /\bdocument\./,
    /\bsetTimeout\b/,
    /\brequestAnimationFrame\b/,
  ];
  const files = engineFiles();
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of banned) {
      assert.doesNotMatch(source, pattern, `${file} uses ${pattern}`);
    }
  }
});
