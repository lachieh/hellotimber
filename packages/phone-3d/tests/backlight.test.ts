import { describe, expect, it } from "vite-plus/test";
import { LED_X, LIT_FLOOR, backlightLightmap, unlitLightmap } from "../src/backlight";
import { SCREEN_DIM_TINT } from "../src/materials";

const W = 84;
const H = 48;
const map = backlightLightmap(W, H);
const at = (x: number, y: number) => map[(y * W + x) * 4]!;

/** Centres of the row's local maxima; a run of equal values counts once, as a
 *  maximum when both neighbours of the run are lower (8-bit levels plateau). */
function peaks(row: readonly number[]): number[] {
  const found: number[] = [];
  for (let start = 0; start < row.length; ) {
    let end = start;
    while (end + 1 < row.length && row[end + 1] === row[start]) end++;
    const left = start === 0 ? -Infinity : row[start - 1]!;
    const right = end === row.length - 1 ? -Infinity : row[end + 1]!;
    if (row[start]! > left && row[start]! > right) found.push((start + end) / 2);
    start = end + 1;
  }
  return found;
}

describe("backlightLightmap", () => {
  it("is opaque white light, one RGBA texel per pixel", () => {
    expect(map).toHaveLength(W * H * 4);
    for (let i = 0; i < map.length; i += 4) {
      expect(map[i + 1]).toBe(map[i]);
      expect(map[i + 2]).toBe(map[i]);
      expect(map[i + 3]).toBe(255);
    }
  });

  it("puts the three LEDs evenly along the top edge", () => {
    expect(LED_X).toEqual([1 / 6, 1 / 2, 5 / 6]);
  });

  it("has exactly three hotspots along the top row, at the LEDs", () => {
    const top = peaks(Array.from({ length: W }, (_, x) => at(x, 0)));
    expect(top).toHaveLength(3);
    LED_X.forEach((fx, i) => {
      // Texel x covers [x, x + 1); its centre is x + 0.5.
      expect(Math.abs(top[i]! + 0.5 - fx * W)).toBeLessThanOrEqual(1);
    });
  });

  it("keeps the hotspots subtle: the top row dips between LEDs but stays bright", () => {
    const peak = at(W / 2, 0);
    const valley = at(W / 3, 0);
    expect(valley).toBeLessThan(peak);
    expect(valley).toBeGreaterThan(peak * 0.8);
  });

  it("darkens every column from top to bottom", () => {
    for (let x = 0; x < W; x++) {
      for (let y = 1; y < H; y++) expect(at(x, y)).toBeLessThanOrEqual(at(x, y - 1));
      expect(at(x, H - 1)).toBeLessThan(at(x, 0));
    }
  });

  it("peaks at full light and never falls below LIT_FLOOR", () => {
    let max = 0;
    let min = 255;
    for (let i = 0; i < map.length; i += 4) {
      max = Math.max(max, map[i]!);
      min = Math.min(min, map[i]!);
    }
    expect(max).toBe(255);
    expect(LIT_FLOOR).toBeGreaterThan(0.5);
    expect(LIT_FLOOR).toBeLessThan(1);
    expect(min).toBeGreaterThanOrEqual(Math.floor(LIT_FLOOR * 255));
  });

  it("is deterministic", () => {
    expect(backlightLightmap(W, H)).toEqual(map);
  });
});

describe("unlitLightmap", () => {
  it("is one texel at the unlit level (the dim tint)", () => {
    const tint = [1, 3, 5].map((i) => Number.parseInt(SCREEN_DIM_TINT.slice(i, i + 2), 16));
    expect([...unlitLightmap()]).toEqual([...tint, 255]);
  });
});
