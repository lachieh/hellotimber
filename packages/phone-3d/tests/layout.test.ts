import { describe, expect, it } from "vite-plus/test";
import { KEY_NODES, KEY_TRAVEL_FRAC, STATIC_NODES } from "../src/layout";
import { ALL_KEYS } from "../src/types";

describe("v3 node map", () => {
  it("maps every physical key to exactly one GLB node", () => {
    expect(Object.keys(KEY_NODES).sort()).toEqual([...ALL_KEYS].sort());
    const nodeNames = Object.values(KEY_NODES);
    expect(new Set(nodeNames).size).toBe(17);
  });

  it("node names are glTF-safe and disjoint from the static nodes", () => {
    const all = [...Object.values(KEY_NODES), ...STATIC_NODES];
    for (const n of all) expect(n).toMatch(/^[a-z0-9_]+$/);
    expect(new Set(all).size).toBe(all.length);
  });

  it("static nodes cover the required assembly parts", () => {
    for (const required of ["body", "island", "screen", "screen_glass"]) {
      expect(STATIC_NODES).toContain(required);
    }
  });

  it("key travel is a small fraction of the model height", () => {
    expect(KEY_TRAVEL_FRAC).toBeGreaterThan(0);
    expect(KEY_TRAVEL_FRAC).toBeLessThan(0.02);
  });
});
