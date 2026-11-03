// Plan 32 Phase 0: the layer fence. Source under `src/services` and `src/kit` imports only in
// the allowed direction; files still elsewhere (the v6.39 firmware and unmoved modules) are
// unrestricted. The known violations are listed in `layers-baseline.json`: an unlisted violation
// fails, and a listed one that no longer exists fails too, so the list stays exact. Moving a
// module into a layer may list its remaining imports of unmoved modules (LAYERS_UPDATE=1 rewrites
// the list; review the diff). Phase 0 ends with an empty list.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const SRC = path.resolve(import.meta.dirname, "../src");
const BASELINE = path.resolve(import.meta.dirname, "layers-baseline.json");

type Layer =
  | { kind: "services" }
  | { kind: "ui" }
  | { kind: "system" }
  | { kind: "app"; app: string }
  | { kind: "kit-firmware" }
  | { kind: "free" };

function layerOf(rel: string): Layer {
  if (rel.startsWith("services/")) return { kind: "services" };
  if (rel.startsWith("kit/ui/")) return { kind: "ui" };
  if (rel.startsWith("kit/system/")) return { kind: "system" };
  if (rel.startsWith("kit/apps/")) return { kind: "app", app: rel.split("/")[2]! };
  if (rel.startsWith("kit/")) return { kind: "kit-firmware" };
  return { kind: "free" };
}

function allowed(from: Layer, to: Layer): boolean {
  switch (from.kind) {
    case "free":
      return true;
    case "services":
      return to.kind === "services";
    case "ui":
      return to.kind === "ui";
    case "system":
      return to.kind === "system" || to.kind === "ui" || to.kind === "services";
    case "app":
      return (
        (to.kind === "app" && to.app === from.app) ||
        to.kind === "system" ||
        to.kind === "ui" ||
        to.kind === "services"
      );
    case "kit-firmware":
      return to.kind !== "free";
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

function resolve(fromDir: string, spec: string): string | undefined {
  const base = path.resolve(fromDir, spec);
  for (const c of [base, `${base}.ts`, path.join(base, "index.ts")]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return undefined;
}

const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']*)["']/g;

/** Every `<file> -> <import>` edge that crosses the fence, as paths relative to `src`. */
function violations(): string[] {
  const out: string[] = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file);
    const from = layerOf(rel);
    if (from.kind === "free") continue;
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(SPEC)) {
      const target = resolve(path.dirname(file), match[1]!);
      if (target === undefined) continue;
      const toRel = path.relative(SRC, target);
      if (toRel.startsWith("..")) continue;
      if (!allowed(from, layerOf(toRel))) out.push(`${rel} -> ${toRel}`);
    }
  }
  return [...new Set(out)].sort();
}

describe("plan 32 layer fence", () => {
  it("adds no import that crosses the layers, and the baseline holds no fixed edge", () => {
    const found = violations();
    if (process.env.LAYERS_UPDATE === "1") {
      fs.writeFileSync(BASELINE, `${JSON.stringify(found, null, 2)}\n`);
    }
    const baseline: string[] = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    expect({
      new: found.filter((v) => !baseline.includes(v)),
      fixed: baseline.filter((v) => !found.includes(v)),
    }).toEqual({ new: [], fixed: [] });
  });
});
