import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vite-plus/test";

/**
 * D13: the 2048 source is an import-free factory, so the same code runs in process and as a
 * bundled user script. It may import its own files (they bundle into the one script) and types
 * from anywhere; it reads no clock and no ambient random source.
 */
function violations(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const report = (node: ts.Node, what: string) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    found.push(`${fileName}:${line + 1} ${what}`);
  };
  /** A sibling file of the game; `../` would leave `src/2048/` for flat files. */
  const isOwnFile = (specifier: ts.Expression) =>
    ts.isStringLiteral(specifier) &&
    specifier.text.startsWith("./") &&
    !specifier.text.split("/").includes("..");
  const accessed = (node: ts.Node, object: string, property: string) =>
    (ts.isPropertyAccessExpression(node) &&
      node.expression.getText(file) === object &&
      node.name.text === property) ||
    (ts.isElementAccessExpression(node) &&
      node.expression.getText(file) === object &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === property);

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      // `import { type A }` still loads the module, so only `import type` is type-only.
      if (!node.importClause?.isTypeOnly && !isOwnFile(node.moduleSpecifier))
        report(node, `runtime import of ${node.moduleSpecifier.getText(file)}`);
      return;
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      if (!node.isTypeOnly && !isOwnFile(node.moduleSpecifier))
        report(node, `runtime re-export of ${node.moduleSpecifier.getText(file)}`);
      return;
    }
    if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly) report(node, "import = require");
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) report(node, "dynamic import");
      if (ts.isIdentifier(node.expression) && node.expression.text === "require")
        report(node, "require");
    }
    if (accessed(node, "Math", "random")) report(node, "Math.random");
    if (ts.isIdentifier(node) && (node.text === "Date" || node.text === "performance"))
      report(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe("the source check", () => {
  const check = (source: string) => violations("sample.ts", source);

  it("allows type imports, the game's own files and plain code", () => {
    expect(
      check(`
        import type { GameContext } from "@hellotimber/nokia-games-sdk";
        import { move } from "./engine";
        import { type State2048, spawn } from "./engine";
        export type { Direction } from "./engine";
        export { start } from "./engine";
        // Date, performance and Math.random() in a comment are not code.
        const text = "Math.random and Date";
        export const half = (n: number) => Math.floor(n / 2) + text.length + move.length;
      `),
    ).toEqual([]);
  });

  it("reports each forbidden source of time and randomness", () => {
    expect(check("const r = Math.random();")).toEqual(["sample.ts:1 Math.random"]);
    expect(check('const r = Math["random"]();')).toEqual(["sample.ts:1 Math.random"]);
    expect(check("const t = Date.now();")).toEqual(["sample.ts:1 Date"]);
    expect(check("\nconst t = new Date();")).toEqual(["sample.ts:2 Date"]);
    expect(check("const t = performance.now();")).toEqual(["sample.ts:1 performance"]);
    expect(check("const t = globalThis.performance.now();")).toEqual(["sample.ts:1 performance"]);
  });

  it("reports each kind of runtime import", () => {
    const sdk = '"@hellotimber/nokia-games-sdk"';
    expect(check(`import { sdk } from ${sdk};`)).toEqual([`sample.ts:1 runtime import of ${sdk}`]);
    expect(check(`import { type GameContext } from ${sdk};`)).toHaveLength(1);
    expect(check(`import ${sdk};`)).toHaveLength(1);
    expect(check('import { x } from "../index";')).toHaveLength(1);
    expect(check('import { x } from "./a/../../index";')).toHaveLength(1);
    expect(check(`export { sdk } from ${sdk};`)).toEqual([
      `sample.ts:1 runtime re-export of ${sdk}`,
    ]);
    expect(check(`export * from ${sdk};`)).toHaveLength(1);
    expect(check('const m = await import("./engine");')).toEqual(["sample.ts:1 dynamic import"]);
    expect(check('const fs = require("node:fs");')).toEqual(["sample.ts:1 require"]);
    expect(check('import fs = require("node:fs");')).toEqual(["sample.ts:1 import = require"]);
  });
});

describe("src/2048", () => {
  const root = fileURLToPath(new URL("../src/2048/", import.meta.url));
  const files = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.tsx?$/.test(name))
    .sort();

  it("holds the engine", () => {
    expect(files).toContain("engine.ts");
  });

  it("uses no Math.random, Date, performance or runtime import", () => {
    expect(files.flatMap((name) => violations(name, readFileSync(root + name, "utf8")))).toEqual(
      [],
    );
  });
});
