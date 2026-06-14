import { describe, expect, it } from "vite-plus/test";
import { KEY_HOTSPOTS } from "../src/hotspots";
import { ALL_KEYS } from "../src/types";

describe("KEY_HOTSPOTS", () => {
  it("has exactly one hotspot per physical key", () => {
    expect(KEY_HOTSPOTS).toHaveLength(ALL_KEYS.length);
    const keys = KEY_HOTSPOTS.map((h) => h.key).sort();
    expect(keys).toEqual([...ALL_KEYS].sort());
  });

  it("places every hotspot center inside the face (0..1) with a positive size", () => {
    for (const h of KEY_HOTSPOTS) {
      expect(h.cx).toBeGreaterThanOrEqual(0);
      expect(h.cx).toBeLessThanOrEqual(1);
      expect(h.cy).toBeGreaterThanOrEqual(0);
      expect(h.cy).toBeLessThanOrEqual(1);
      expect(h.w).toBeGreaterThan(0);
      expect(h.h).toBeGreaterThan(0);
    }
  });

  it("orders the digit grid top-to-bottom: 1/2/3 above 4/5/6 above 7/8/9 above */0/#", () => {
    const cy = (k: string) => KEY_HOTSPOTS.find((h) => h.key === k)!.cy;
    expect(cy("1")).toBeGreaterThan(cy("4"));
    expect(cy("4")).toBeGreaterThan(cy("7"));
    expect(cy("7")).toBeGreaterThan(cy("0"));
  });

  it("keeps C left, the rocker right, and the NaviKey centered", () => {
    const cx = (k: string) => KEY_HOTSPOTS.find((h) => h.key === k)!.cx;
    expect(cx("c")).toBeLessThan(0.5);
    expect(cx("up")).toBeGreaterThan(0.5);
    expect(cx("down")).toBeGreaterThan(0.5);
    expect(cx("navi")).toBeCloseTo(0.5, 1);
  });
});
