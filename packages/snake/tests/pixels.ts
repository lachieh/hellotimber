import { expect } from "vite-plus/test";
import type { Bitmap } from "../src/types";

/** Extract a rectangular region as string art ('#' = set, '.' = clear). */
export function frameRegion(b: Bitmap, x: number, y: number, w: number, h: number): string {
  const rows: string[] = [];
  for (let yy = y; yy < y + h; yy++) {
    let row = "";
    for (let xx = x; xx < x + w; xx++) {
      row += b.pixels[yy * b.width + xx] ? "#" : ".";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

/** Assert that a region of the bitmap matches the given string art
 * (leading/trailing whitespace per line is ignored). */
export function expectFrame(
  b: Bitmap,
  x: number,
  y: number,
  w: number,
  h: number,
  art: string,
): void {
  const expected = art
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
  expect(frameRegion(b, x, y, w, h)).toBe(expected);
}
