import { describe, expect, it } from "vite-plus/test";
import { ALL_KEYS } from "../src/types";

describe("Nokia3310Key union", () => {
  it("has exactly 17 keys", () => {
    expect(ALL_KEYS).toHaveLength(17);
  });

  it("has no duplicates", () => {
    expect(new Set(ALL_KEYS).size).toBe(ALL_KEYS.length);
  });

  it("contains the navigation cluster and the full digit grid", () => {
    for (const k of ["power", "navi", "c", "up", "down", "*", "0", "#"]) {
      expect(ALL_KEYS).toContain(k);
    }
    for (let d = 0; d <= 9; d++) expect(ALL_KEYS).toContain(String(d));
  });
});
