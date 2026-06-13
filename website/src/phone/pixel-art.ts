import type { Bitmap } from "@hellotimber/phone-core";

/** string-art rows ('#' set, anything else clear) → Bitmap (one byte/pixel). */
export function artToBitmap(rows: string[]): Bitmap {
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  const height = rows.length;
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = rows[y] ?? "";
    for (let x = 0; x < width; x++) pixels[y * width + x] = row[x] === "#" ? 1 : 0;
  }
  return { width, height, pixels };
}

// SAMPLE screensaver picture — a tiny pixel scene (drawn centered on 84×48).
export const SCREENSAVER_ART: string[] = [
  ".....######.......######........",
  "....#......#.....#......#.......",
  "....#.####.#.....#.####.#.......",
  "....#......#.....#......#.......",
  ".....######.......######........",
  "........#############...........",
  ".......#.............#..........",
  "......#...............#.........",
  ".......#############.#..........",
];
