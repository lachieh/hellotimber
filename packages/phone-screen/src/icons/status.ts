import { bitmapFromArt } from "../bitmap";
import type { Bitmap } from "../bitmap";
import type { Framebuffer } from "../framebuffer";

/** Antenna glyph topping the signal stack (left edge). */
export const ANTENNA_ICON: Bitmap = bitmapFromArt(["#.#.#", ".###.", "..#..", "..#..", "..#.."]);

/** Battery glyph topping the battery stack (right edge). */
export const BATTERY_ICON: Bitmap = bitmapFromArt(["..#..", "#####", "#...#", "#...#", "#####"]);

/** Message-received envelope (spec §2 status icon; no ScreenModel field yet). */
export const ENVELOPE_ICON: Bitmap = bitmapFromArt([
  "########",
  "#......#",
  "##....##",
  "#.#..#.#",
  "#..##..#",
  "#......#",
  "#......#",
  "########",
]);

/** Keyguard padlock (spec §2 status icon; no ScreenModel field yet). */
export const KEYGUARD_ICON: Bitmap = bitmapFromArt([
  "..####..",
  ".#....#.",
  ".#....#.",
  "########",
  "########",
  "###..###",
  "###..###",
  "########",
]);

const RUNG_W = 3;
const RUNG_H = 4;
const RUNG_PITCH = 5; // 4px rung + 1px gap
const RUNG_BOTTOM_Y = 27; // bottom rung top edge; stack grows upward to y=12
const SIGNAL_X = 0;
const BATTERY_X = 81;

function drawRungs(fb: Framebuffer, x: number, level: number): void {
  for (let i = 0; i < level; i++) {
    fb.fillRect(x, RUNG_BOTTOM_Y - i * RUNG_PITCH, RUNG_W, RUNG_H, 1);
  }
}

/** Left-edge signal indicator: antenna glyph + 0–4 rungs growing upward. */
export function drawSignalLevel(fb: Framebuffer, level: 0 | 1 | 2 | 3 | 4): void {
  fb.blitBitmap(ANTENNA_ICON, 0, 0);
  drawRungs(fb, SIGNAL_X, level);
}

/** Right-edge battery indicator: battery glyph + 0–4 rungs growing upward. */
export function drawBatteryLevel(fb: Framebuffer, level: 0 | 1 | 2 | 3 | 4): void {
  fb.blitBitmap(BATTERY_ICON, 79, 0);
  drawRungs(fb, BATTERY_X, level);
}
