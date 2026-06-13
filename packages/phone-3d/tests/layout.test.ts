import { describe, expect, it } from "vite-plus/test";
import {
  ARC_OFFSET,
  DIGIT_COLUMN_X,
  digitKeyPosition,
  DIGIT_ROW_Y,
  KEY_LAYOUT,
  type KeyLayoutEntry,
} from "../src/layout";
import { ALL_KEYS } from "../src/types";

const EPSILON = 1e-9;

/** Strict XY bounding-box overlap (touching edges do NOT count as overlap). */
function overlapsXY(a: KeyLayoutEntry, b: KeyLayoutEntry): boolean {
  const dx = Math.abs(a.position[0] - b.position[0]);
  const dy = Math.abs(a.position[1] - b.position[1]);
  return dx < (a.size[0] + b.size[0]) / 2 - EPSILON && dy < (a.size[1] + b.size[1]) / 2 - EPSILON;
}

describe("KEY_LAYOUT", () => {
  it("has exactly 17 entries — one per physical key", () => {
    expect(KEY_LAYOUT).toHaveLength(17);
  });

  it("covers every Nokia3310Key exactly once", () => {
    const keys = KEY_LAYOUT.map((e) => e.key);
    expect(new Set(keys).size).toBe(17);
    for (const k of ALL_KEYS) expect(keys).toContain(k);
  });

  it("has strictly positive sizes everywhere", () => {
    for (const e of KEY_LAYOUT) {
      for (const dim of e.size) expect(dim).toBeGreaterThan(0);
    }
  });

  it("places every front-face key proud of the face plate (z > 1.1)", () => {
    for (const e of KEY_LAYOUT) {
      if (e.key === "power") continue; // top edge, not the front face
      expect(e.position[2]).toBeGreaterThan(1.1);
    }
  });

  it("has no overlapping XY bounding boxes between any two keys", () => {
    for (let i = 0; i < KEY_LAYOUT.length; i++) {
      for (let j = i + 1; j < KEY_LAYOUT.length; j++) {
        const a = KEY_LAYOUT[i];
        const b = KEY_LAYOUT[j];
        expect(overlapsXY(a, b), `${a.key} overlaps ${b.key}`).toBe(false);
      }
    }
  });

  it("keeps digit columns vertically aligned", () => {
    const columns: ReadonlyArray<readonly string[]> = [
      ["1", "4", "7", "*"],
      ["2", "5", "8", "0"],
      ["3", "6", "9", "#"],
    ];
    columns.forEach((col, c) => {
      for (const key of col) {
        const entry = KEY_LAYOUT.find((e) => e.key === key);
        expect(entry?.position[0]).toBe(DIGIT_COLUMN_X[c]);
      }
    });
  });

  it("arcs each digit row with the center column highest (the smile/wave)", () => {
    expect(ARC_OFFSET[1]).toBeGreaterThan(ARC_OFFSET[0]);
    expect(ARC_OFFSET[1]).toBeGreaterThan(ARC_OFFSET[2]);
    expect(ARC_OFFSET[0]).toBe(ARC_OFFSET[2]); // symmetric
    for (let row = 0; row < DIGIT_ROW_Y.length; row++) {
      const [, yLeft] = digitKeyPosition(row, 0);
      const [, yMid] = digitKeyPosition(row, 1);
      const [, yRight] = digitKeyPosition(row, 2);
      expect(yMid).toBeGreaterThan(yLeft);
      expect(yMid).toBeGreaterThan(yRight);
    }
  });

  it("abuts the rocker press zones without a gap", () => {
    const up = KEY_LAYOUT.find((e) => e.key === "up")!;
    const down = KEY_LAYOUT.find((e) => e.key === "down")!;
    expect(up.shape).toBe("rockerUp");
    expect(down.shape).toBe("rockerDown");
    expect(up.position[0]).toBe(down.position[0]);
    const upBottom = up.position[1] - up.size[1] / 2;
    const downTop = down.position[1] + down.size[1] / 2;
    expect(Math.abs(upBottom - downTop)).toBeLessThan(1e-9);
  });

  it("puts the power button on the top edge", () => {
    const power = KEY_LAYOUT.find((e) => e.key === "power")!;
    expect(power.position[1]).toBeGreaterThan(5.65); // protrudes above body top
    expect(power.shape).toBe("oval");
  });
});
