// Plan 32 Phase 0: the kit's layer fence. `ui` imports only `ui`; `system` imports `system` and
// `ui`; an app under `apps/<app>` imports its own app, `system` and `ui`. Of the workspace
// packages, `ui` may use phone-core and phone-screen; `system` and the apps may also use
// phone-services. Relative imports stay inside this package.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const SRC = path.resolve(import.meta.dirname, "../src");

type Layer = { kind: "ui" } | { kind: "system" } | { kind: "app"; app: string };

function layerOf(rel: string): Layer {
  if (rel.startsWith("ui/")) return { kind: "ui" };
  if (rel.startsWith("system/")) return { kind: "system" };
  if (rel.startsWith("apps/")) return { kind: "app", app: rel.split("/")[1]! };
  throw new Error(`${rel} is in no layer (ui, system or apps/<app>)`);
}

function allowed(from: Layer, to: Layer): boolean {
  switch (from.kind) {
    case "ui":
      return to.kind === "ui";
    case "system":
      return to.kind === "system" || to.kind === "ui";
    case "app":
      return (to.kind === "app" && to.app === from.app) || to.kind === "system" || to.kind === "ui";
  }
}

const UI_PACKAGES = ["@hellotimber/phone-core", "@hellotimber/phone-screen"];
const PACKAGES = [...UI_PACKAGES, "@hellotimber/phone-services"];

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

const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;

/** Every `<file> -> <import>` edge that crosses the fence, with paths relative to `src`. */
function violations(): string[] {
  const out: string[] = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file);
    const from = layerOf(rel);
    for (const match of fs.readFileSync(file, "utf8").matchAll(SPEC)) {
      const spec = match[1]!;
      if (spec.startsWith("@hellotimber/")) {
        const name = spec.split("/").slice(0, 2).join("/");
        if (!(from.kind === "ui" ? UI_PACKAGES : PACKAGES).includes(name)) {
          out.push(`${rel} -> ${spec}`);
        }
        continue;
      }
      if (!spec.startsWith(".")) continue;
      const target = resolve(path.dirname(file), spec);
      const toRel = target === undefined ? undefined : path.relative(SRC, target);
      if (toRel === undefined || toRel.startsWith("..") || !allowed(from, layerOf(toRel))) {
        out.push(`${rel} -> ${spec}`);
      }
    }
  }
  return [...new Set(out)].sort();
}

describe("nokia-kit layer fence", () => {
  it("imports only down the layers: apps -> system -> ui", () => {
    expect(violations()).toEqual([]);
  });
});
