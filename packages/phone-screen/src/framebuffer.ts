import type { Bitmap } from "./bitmap";

/**
 * An in-memory monochrome pixel surface: one byte per pixel, row-major,
 * 0 = clear (LCD background), 1 = set (ink). All operations are
 * bounds-safe — drawing off the edges is silently clipped.
 */
export class Framebuffer {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;

  constructor(width = 84, height = 48) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height);
  }

  getPixel(x: number, y: number): 0 | 1 {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.pixels[y * this.width + x] === 1 ? 1 : 0;
  }

  setPixel(x: number, y: number, value: 0 | 1): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.pixels[y * this.width + x] = value;
  }

  clear(value: 0 | 1 = 0): void {
    this.pixels.fill(value);
  }

  fillRect(x: number, y: number, w: number, h: number, value: 0 | 1 = 1): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.setPixel(xx, yy, value);
    }
  }

  /**
   * Stamp a bitmap's SET pixels at (x, y) — transparent blit. `value`
   * picks the ink (0 erases, for inverted-video text); `scale` expands
   * each source pixel into a scale×scale block.
   */
  blitBitmap(
    bitmap: Bitmap,
    x: number,
    y: number,
    opts: { scale?: number; value?: 0 | 1 } = {},
  ): void {
    const scale = opts.scale ?? 1;
    const value = opts.value ?? 1;
    for (let by = 0; by < bitmap.height; by++) {
      for (let bx = 0; bx < bitmap.width; bx++) {
        if (bitmap.pixels[by * bitmap.width + bx] !== 1) continue;
        if (scale === 1) this.setPixel(x + bx, y + by, value);
        else this.fillRect(x + bx * scale, y + by * scale, scale, scale, value);
      }
    }
  }
}
