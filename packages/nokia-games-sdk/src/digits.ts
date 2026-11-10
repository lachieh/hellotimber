// Snake II's HUD numerals, the firmware's game digits (plan 28 D12): 4×5 cells with the ink in the
// right three columns. Transcribed from nokia-kit's generated Snake sprites (`digit/0`…`digit/9`);
// a nokia-os test pins the two equal, and the goldens stay the source of truth.

import type { GameFont } from "./contract";

const glyphs: Record<string, readonly string[]> = {
  "0": [".###", ".#.#", ".#.#", ".#.#", ".###"],
  "1": ["..#.", ".##.", "..#.", "..#.", "..#."],
  "2": [".###", "...#", ".###", ".#..", ".###"],
  "3": [".###", "...#", ".###", "...#", ".###"],
  "4": [".#.#", ".#.#", ".###", "...#", "...#"],
  "5": [".###", ".#..", ".###", "...#", ".###"],
  "6": [".###", ".#..", ".###", ".#.#", ".###"],
  "7": [".###", "...#", "..#.", "..#.", "..#."],
  "8": [".###", ".#.#", ".###", ".#.#", ".###"],
  "9": [".###", ".#.#", ".###", "...#", ".###"],
};
for (const rows of Object.values(glyphs)) Object.freeze(rows);

export const GAME_DIGITS: GameFont = Object.freeze({ height: 5, glyphs: Object.freeze(glyphs) });
