import { describe, expect, it } from "vite-plus/test";
import { mulberry32 } from "../src/prng";
import { tickIntervalMs } from "../src/timing";

describe("mulberry32", () => {
  it("produces a known sequence for seed 1", () => {
    const r = mulberry32(1);
    expect(r()).toBeCloseTo(0.6270739405881613, 12);
    expect(r()).toBeCloseTo(0.002735721180215478, 12);
    expect(r()).toBeCloseTo(0.5274470399599522, 12);
  });

  it("is deterministic per seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("stays in [0, 1)", () => {
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("tickIntervalMs", () => {
  it("maps levels 1-9 to a decreasing interval", () => {
    expect(tickIntervalMs(1)).toBe(545);
    expect(tickIntervalMs(5)).toBe(325);
    expect(tickIntervalMs(9)).toBe(105);
  });

  it("clamps out-of-range speeds", () => {
    expect(tickIntervalMs(0)).toBe(545);
    expect(tickIntervalMs(99)).toBe(105);
  });
});
