import { drawArt } from "./bitmap";
import type { Bitmap } from "./types";

/**
 * Bold score digits matching the 3310 UI font (bitmaps transcribed from the
 * freeware "Nokia Cellphone FC Small" by Zeh Fernando at its native 8px —
 * copied as data; this package keeps its zero-dependency rule). Variable
 * width; the right bearing column is baked into each glyph.
 */
export const DIGITS: Record<string, readonly string[]> = {
  "0": [".###..", "##.##.", "##.##.", "##.##.", "##.##.", "##.##.", ".###.."],
  "1": [".##.", "###.", ".##.", ".##.", ".##.", ".##.", ".##."],
  "2": ["####..", "...##.", "...##.", ".###..", "##....", "##....", "#####."],
  "3": ["####..", "...##.", "...##.", ".###..", "...##.", "...##.", "####.."],
  "4": ["...##.", "..###.", ".#.##.", "#..##.", "#####.", "...##.", "...##."],
  "5": ["####..", "#.....", "####..", "...##.", "...##.", "...##.", "####.."],
  "6": [".###..", "##....", "####..", "##.##.", "##.##.", "##.##.", ".###.."],
  "7": ["#####.", "...##.", "..##..", "..##..", ".##...", ".##...", ".##..."],
  "8": [".###..", "##.##.", "##.##.", ".###..", "##.##.", "##.##.", ".###.."],
  "9": [".###..", "##.##.", "##.##.", "##.##.", ".####.", "...##.", ".###.."],
};

/** Draw a non-negative integer at (x, y); `padTo` zero-pads (Snake II HUD). */
export function drawNumber(b: Bitmap, x: number, y: number, value: number, padTo = 0): void {
  const digits = String(Math.max(0, Math.floor(value))).padStart(padTo, "0");
  let cx = x;
  for (const d of digits) {
    const glyph = DIGITS[d]!;
    drawArt(b, cx, y, glyph);
    cx += glyph[0]!.length;
  }
}

/** Pixel width of a number rendered by drawNumber (bearing included). */
export function numberWidth(value: number, padTo = 0): number {
  const digits = String(Math.max(0, Math.floor(value))).padStart(padTo, "0");
  let w = 0;
  for (const d of digits) w += DIGITS[d]![0]!.length;
  return w;
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
