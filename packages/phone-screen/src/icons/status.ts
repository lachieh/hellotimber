import { bitmapFromArt } from "../bitmap";
import type { Bitmap } from "../bitmap";
import type { Framebuffer } from "../framebuffer";

export const SIGNAL_ICON: Bitmap = bitmapFromArt([
  "#.#.#",
  ".###.",
  "..#..",
  "..#..",
  "..#..",
  "..#..",
]);

export const BATTERY_ICON: Bitmap = bitmapFromArt([
  "..#..",
  "#####",
  "#...#",
  "#...#",
  "#...#",
  "#####",
]);

export const VOICEMAIL_ICON: Bitmap = bitmapFromArt([
  ".##...##.",
  "#..#.#..#",
  "#..#.#..#",
  ".##...##.",
  "...###...",
  "..#...#..",
]);

export const SMS_ICON: Bitmap = bitmapFromArt([
  "########",
  "#......#",
  "##....##",
  "#.#..#.#",
  "#..##..#",
  "########",
]);

/** Existing public names for the signal and message status sprites. */
export const ANTENNA_ICON = SIGNAL_ICON;
export const ENVELOPE_ICON = SMS_ICON;

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

const SIGNAL_BARS = [
  [0, 24, 2],
  [0, 16, 2],
  [0, 8, 3],
  [0, 0, 4],
] as const;

const BATTERY_BARS = [
  [82, 24, 2],
  [82, 16, 2],
  [81, 8, 3],
  [80, 0, 4],
] as const;

function drawLevel(
  fb: Framebuffer,
  level: 0 | 1 | 2 | 3 | 4,
  bars: readonly (readonly [x: number, y: number, width: number])[],
): void {
  for (let index = 0; index < level; index++) {
    const [x, y, width] = bars[index]!;
    fb.fillRect(x, y, width, 6, 1);
  }
}

export function drawSignalLevel(fb: Framebuffer, level: 0 | 1 | 2 | 3 | 4): void {
  drawLevel(fb, level, SIGNAL_BARS);
  fb.blitBitmap(SIGNAL_ICON, 0, 32);
}

export function drawBatteryLevel(fb: Framebuffer, level: 0 | 1 | 2 | 3 | 4): void {
  drawLevel(fb, level, BATTERY_BARS);
  fb.blitBitmap(BATTERY_ICON, 79, 32);
}
