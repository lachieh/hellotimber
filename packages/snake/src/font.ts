import { drawArt } from "./bitmap";
import type { Bitmap } from "./types";

/** 3×5 digit font for the score bar (glyphs advance 4px: 3 wide + 1 gap). */
export const FONT_3X5: Record<string, readonly string[]> = {
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", "###", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", "..#", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
};

/** Draw a non-negative integer left-aligned at (x, y) in the 3×5 font. */
export function drawNumber(b: Bitmap, x: number, y: number, value: number): void {
  const digits = String(Math.max(0, Math.floor(value)));
  for (let i = 0; i < digits.length; i++) {
    drawArt(b, x + i * 4, y, FONT_3X5[digits[i]]);
  }
}

/** Pixel width of a number rendered by drawNumber. */
export function numberWidth(value: number): number {
  return String(Math.max(0, Math.floor(value))).length * 4 - 1;
}

/** Minimal 5×7 caps font: exactly the glyphs needed for "GAME OVER". */
export const FONT_5X7: Record<string, readonly string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
};

/** Draw caps text in the 5×7 font (6px advance; unknown chars/space skip). */
export function drawText5x7(b: Bitmap, x: number, y: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    const glyph = FONT_5X7[text[i]];
    if (glyph) drawArt(b, x + i * 6, y, glyph);
  }
}
