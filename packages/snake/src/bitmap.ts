import type { Bitmap } from "./types";

/** Allocate a zeroed 1bpp bitmap (defaults to the 84×48 Nokia screen). */
export function createBitmap(width = 84, height = 48): Bitmap {
  return { width, height, pixels: new Uint8Array(width * height) };
}

/** Set one pixel; silently clips out-of-bounds coordinates. */
export function setPixel(b: Bitmap, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= b.width || y >= b.height) return;
  b.pixels[y * b.width + x] = 1;
}

export function fillRect(b: Bitmap, x: number, y: number, w: number, h: number): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(b, xx, yy);
  }
}

/** Stamp string art ('#' = set, anything else = transparent) at (x, y). */
export function drawArt(b: Bitmap, x: number, y: number, art: readonly string[]): void {
  art.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === "#") setPixel(b, x + dx, y + dy);
    }
  });
}
