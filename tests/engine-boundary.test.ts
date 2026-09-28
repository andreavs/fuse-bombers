import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * The engine boundary: `src/engine/` is a deterministic simulation that imports nothing outside itself — no
 * `render/`, no `app/`, no Phaser, no npm or Node packages. Rendering and app code import the engine, never the
 * reverse. A new cross-layer import is a design question (which layer owns this?), not an exception to add here.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const engineDir = path.join(root, "src", "engine");

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(file);
      return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")
        ? [file]
        : [];
    })
    .sort();
}

/** Every module specifier a file names: imports, re-exports, dynamic imports, `require` and `import()` types. */
export function importsOf(fileName: string, text: string): string[] {
  const file = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    )
      found.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(file) === "require") &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    )
      found.push(node.arguments[0].text);
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    )
      found.push(node.argument.literal.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return [...new Set(found)];
}

/** Why `specifier`, imported from the engine file `source`, crosses the boundary; undefined when it stays inside. */
export function boundaryViolation(
  source: string,
  specifier: string,
): string | undefined {
  if (!specifier.startsWith("."))
    return `${specifier} is a package; the engine imports only its own modules`;
  const target = path.resolve(path.dirname(source), specifier);
  const relative = path.relative(engineDir, target);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    return `${specifier} resolves outside src/engine/`;
  return undefined;
}

function violations(): string[] {
  return sourceFiles(engineDir).flatMap((file) =>
    importsOf(file, readFileSync(file, "utf8")).flatMap((specifier) => {
      const reason = boundaryViolation(file, specifier);
      return reason ? [`${path.relative(root, file)}: ${reason}`] : [];
    }),
  );
}

test("src/engine/ imports nothing outside itself", () => {
  assert.deepEqual(
    violations(),
    [],
    "move the concept into the engine, or have render/app import the engine instead",
  );
});

test("the boundary guard catches every import form", () => {
  assert.deepEqual(
    importsOf(
      "sample.ts",
      `import {a} from "../app/a.js"; export {b} from "./b.js"; import type {C} from "phaser";
       const d = import("./d.js"); type E = import("./e.js").E; import "./f.js";`,
    ),
    ["../app/a.js", "./b.js", "phaser", "./d.js", "./e.js", "./f.js"],
  );
});

test("the boundary guard rejects render, app and packages and accepts engine-relative imports", () => {
  const source = path.join(engineDir, "world.ts");
  const nested = path.join(engineDir, "physics", "rocket.ts");
  for (const specifier of [
    "../render/title-scene.js",
    "../app/main.js",
    "../../tests/helper.js",
    "phaser",
    "node:fs",
  ])
    assert.ok(boundaryViolation(source, specifier), specifier);
  assert.ok(boundaryViolation(nested, "../../render/scene.js"));
  for (const specifier of ["./rng.js", "./physics/rocket.js"])
    assert.equal(boundaryViolation(source, specifier), undefined, specifier);
  assert.equal(boundaryViolation(nested, "../world.js"), undefined);
});
