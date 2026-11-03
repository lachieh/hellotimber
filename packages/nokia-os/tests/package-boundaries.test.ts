// Plan 32 Phase 0: packages reach each other only through package specifiers
// (`@hellotimber/nokia-kit/...`), never a relative path into a sibling's files. Scans every
// workspace member (`packages/*` and `website`); the kit's own layers are fenced in
// packages/nokia-kit/tests/layers.test.ts.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const REPO = path.resolve(import.meta.dirname, "../../..");
const SKIP = new Set(["node_modules", "goldens", "dist", ".output", ".vercel", ".tanstack"]);
const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|vi\.mock\(\s*)["'](\.{1,2}\/[^"']*)["']/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || entry.name.startsWith(".")) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mts)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const members = [
  ...fs
    .readdirSync(path.join(REPO, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(REPO, "packages", entry.name)),
  path.join(REPO, "website"),
].filter((dir) => fs.existsSync(path.join(dir, "package.json")));

/** Every `<file> -> <specifier>` whose relative specifier leaves the file's package. */
function escapes(): string[] {
  const out: string[] = [];
  for (const member of members) {
    for (const file of walk(member)) {
      for (const match of fs.readFileSync(file, "utf8").matchAll(SPEC)) {
        const target = path.resolve(path.dirname(file), match[1]!);
        if (path.relative(member, target).startsWith("..")) {
          out.push(`${path.relative(REPO, file)} -> ${match[1]}`);
        }
      }
    }
  }
  return out.sort();
}

describe("package boundaries", () => {
  it("finds the workspace packages", () => {
    expect(members.map((dir) => path.relative(REPO, dir))).toEqual(
      expect.arrayContaining(["packages/nokia-kit", "packages/phone-services", "website"]),
    );
  });

  it("imports no sibling package by relative path", () => {
    expect(escapes()).toEqual([]);
  });
});
