import { expect } from "vite-plus/test";
import type { Framebuffer } from "../src/framebuffer";

/** Dump a framebuffer region as '#'/'.' rows joined by newlines. */
export function regionToArt(fb: Framebuffer, x: number, y: number, w: number, h: number): string {
  const rows: string[] = [];
  for (let ry = 0; ry < h; ry++) {
    let row = "";
    for (let rx = 0; rx < w; rx++) {
      row += fb.getPixel(x + rx, y + ry) === 1 ? "#" : ".";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

/**
 * Assert that the region at (x, y) matches the ASCII art. The art is a
 * multi-line string of '#'/'.'; surrounding blank lines and per-line
 * indentation are trimmed, the first line defines the width.
 */
export function expectPixels(fb: Framebuffer, x: number, y: number, art: string): void {
  const lines = art
    .trim()
    .split("\n")
    .map((line) => line.trim());
  const expected = lines.join("\n");
  const actual = regionToArt(fb, x, y, lines[0]!.length, lines.length);
  expect(actual).toBe(expected);
}

/** Compare a complete framebuffer with literal rows and include a useful visual diff. */
export function expectFramebuffer(fb: Framebuffer, expectedRows: readonly string[]): void {
  expect(expectedRows, "fixture height").toHaveLength(fb.height);
  expectedRows.forEach((row, y) => {
    expect(row, `fixture row ${y} width`).toMatch(new RegExp(`^[#.]{${fb.width}}$`));
  });

  const actualRows = regionToArt(fb, 0, 0, fb.width, fb.height).split("\n");
  for (let y = 0; y < fb.height; y++) {
    const expected = expectedRows[y]!;
    const actual = actualRows[y]!;
    if (actual === expected) continue;
    let x = 0;
    while (expected[x] === actual[x]) x++;
    let diff = "";
    for (let index = 0; index < expected.length; index++) {
      diff += expected[index] === actual[index] ? " " : "^";
    }
    throw new Error(
      `framebuffer differs first at (${x},${y})\nexpected ${expected}\nactual   ${actual}\ndiff     ${diff}`,
    );
  }
}
