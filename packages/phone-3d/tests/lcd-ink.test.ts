import { describe, expect, it } from "vite-plus/test";
import {
  INK_SHADOW_BLUR,
  INK_SHADOW_OFFSET,
  INK_SHADOW_OPACITY,
  INK_SHADOW_SCALE,
  inkMask,
  shadowMask,
} from "../src/lcd-ink";
import type { Mask } from "../src/lcd-ink";

type Rgb = readonly [number, number, number];

/** An RGBA image from rows of palette indices. */
function image(rows: readonly string[], palette: Record<string, Rgb>) {
  const width = rows[0]!.length;
  const data = new Uint8ClampedArray(width * rows.length * 4);
  rows.forEach((row, y) => {
    row.split("").forEach((c, x) => data.set([...palette[c]!, 255], (y * width + x) * 4));
  });
  return { width, height: rows.length, data };
}

const mask = (rows: readonly string[]): Mask => ({
  width: rows[0]!.length,
  height: rows.length,
  data: Uint8Array.from(rows.join(""), (c) => (c === "#" ? 255 : 0)),
});

const rowsOf = (m: Mask) =>
  Array.from({ length: m.height }, (_, y) => [...m.data.subarray(y * m.width, (y + 1) * m.width)]);

describe("inkMask", () => {
  const green = { b: [0xc7, 0xf0, 0xd8], f: [0x43, 0x52, 0x3d] } as const;

  it("is opaque where the screen shows the foreground and clear on the background", () => {
    const m = inkMask(image(["bfb", "fbf"], green), "#c7f0d8");
    expect(m.width).toBe(3);
    expect(m.height).toBe(2);
    expect(rowsOf(m)).toEqual([
      [0, 255, 0],
      [255, 0, 255],
    ]);
  });

  it("works for any palette, light ink on dark included", () => {
    const inverse = { b: [10, 10, 40], f: [250, 240, 200] } as const;
    expect(rowsOf(inkMask(image(["bf", "fb"], inverse), "#0a0a28"))).toEqual([
      [0, 255],
      [255, 0],
    ]);
  });

  it("splits in-between colours at half the foreground's distance from the background", () => {
    // Grey levels on white: the foreground is black (the farthest colour).
    const greys: Record<string, Rgb> = {
      b: [255, 255, 255],
      f: [0, 0, 0],
      n: [140, 140, 140],
      l: [115, 115, 115],
    };
    expect(rowsOf(inkMask(image(["bfnl"], greys), "#ffffff"))).toEqual([[0, 255, 0, 255]]);
  });

  it("finds no ink on a blank screen", () => {
    expect(rowsOf(inkMask(image(["bb", "bb"], green), "#c7f0d8"))).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});

describe("shadowMask", () => {
  it("upscales the mask scale× without blur", () => {
    expect(rowsOf(shadowMask(mask(["#.", ".#"]), 2, 0))).toEqual([
      [255, 255, 0, 0],
      [255, 255, 0, 0],
      [0, 0, 255, 255],
      [0, 0, 255, 255],
    ]);
  });

  it("box-blurs blur texels: one ink texel spreads evenly over its neighbourhood", () => {
    const m = shadowMask(mask(["...", ".#.", "..."]), 1, 1);
    expect(rowsOf(m)).toEqual(Array.from({ length: 3 }, () => [28, 28, 28])); // 255 / 9
  });

  it("an all-ink mask stays full inside and loses the clear border's share at the edges", () => {
    const m = shadowMask(mask(["####", "####", "####", "####"]), 2, 1);
    expect(m.width).toBe(8);
    expect(m.height).toBe(8);
    const r = rowsOf(m);
    expect(r[3]![3]).toBe(255);
    expect(r[0]![3]).toBe(170); // 6 of 9 texels inside
    expect(r[0]![0]).toBe(113); // 4 of 9
    for (const v of m.data) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});

describe("the ink shadow", () => {
  it("is subtle and falls about a third of an LCD pixel right and down", () => {
    expect(INK_SHADOW_OPACITY).toBeGreaterThan(0.1);
    expect(INK_SHADOW_OPACITY).toBeLessThanOrEqual(0.5);
    expect(INK_SHADOW_OFFSET).toBeCloseTo(1 / 3, 1);
    expect(INK_SHADOW_SCALE).toBeGreaterThanOrEqual(2);
    expect(INK_SHADOW_BLUR).toBeGreaterThanOrEqual(1);
    expect(INK_SHADOW_BLUR).toBeLessThan(INK_SHADOW_SCALE);
  });
});
