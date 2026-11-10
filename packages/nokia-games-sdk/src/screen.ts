// The 84×48 1-bit frame a game draws into, and its packed form (plan 28 D19: the frame is the LCD).

import { PACKED_FRAME_BYTES, SCREEN_HEIGHT, SCREEN_WIDTH } from "./limits";

const PIXELS = SCREEN_WIDTH * SCREEN_HEIGHT;

/** The part of `start .. start + length` inside `0 .. limit`, as whole pixels. */
function span(start: number, length: number, limit: number): readonly [number, number] {
  const from = Math.floor(start);
  return [Math.max(0, from), Math.min(limit, from + Math.floor(length))];
}

export class GameScreen {
  readonly width = SCREEN_WIDTH;
  readonly height = SCREEN_HEIGHT;
  /** 4032 bytes, 0/1, row-major (phone-core Bitmap layout). */
  readonly pixels = new Uint8Array(PIXELS);

  /** 0 outside the screen. */
  get(x: number, y: number): 0 | 1 {
    return this.inside(x, y) && this.pixels[y * SCREEN_WIDTH + x] === 1 ? 1 : 0;
  }

  /** Clipped. */
  set(x: number, y: number, ink: 0 | 1 = 1): void {
    if (this.inside(x, y)) this.pixels[y * SCREEN_WIDTH + x] = ink ? 1 : 0;
  }

  clear(): void {
    this.pixels.fill(0);
  }

  fill(x: number, y: number, w: number, h: number, ink: 0 | 1 = 1): void {
    const [left, right] = span(x, w, SCREEN_WIDTH);
    const [top, bottom] = span(y, h, SCREEN_HEIGHT);
    if (left >= right) return;
    for (let row = top; row < bottom; row++) {
      this.pixels.fill(ink ? 1 : 0, row * SCREEN_WIDTH + left, row * SCREEN_WIDTH + right);
    }
  }

  invert(x: number, y: number, w: number, h: number): void {
    const [left, right] = span(x, w, SCREEN_WIDTH);
    const [top, bottom] = span(y, h, SCREEN_HEIGHT);
    for (let row = top; row < bottom; row++) {
      for (let i = row * SCREEN_WIDTH + left; i < row * SCREEN_WIDTH + right; i++) {
        this.pixels[i] = this.pixels[i] === 1 ? 0 : 1;
      }
    }
  }

  /** `#` ink, `.` paper, other characters skip. */
  blit(art: readonly string[], x: number, y: number): void {
    for (let dy = 0; dy < art.length; dy++) {
      const row = art[dy]!;
      for (let dx = 0; dx < row.length; dx++) {
        const cell = row[dx];
        if (cell === "#") this.set(x + dx, y + dy, 1);
        else if (cell === ".") this.set(x + dx, y + dy, 0);
      }
    }
  }

  /** 504 bytes: row-major, MSB first, 1 = ink. */
  pack(): Uint8Array {
    const packed = new Uint8Array(PACKED_FRAME_BYTES);
    for (let i = 0; i < PIXELS; i++) {
      if (this.pixels[i] === 1) packed[i >> 3]! |= 0x80 >> (i & 7);
    }
    return packed;
  }

  private inside(x: number, y: number): boolean {
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      x < SCREEN_WIDTH &&
      y >= 0 &&
      y < SCREEN_HEIGHT
    );
  }
}

/** A packed frame as 4032 bytes of 0/1, the layout of `GameScreen.pixels`. */
export function unpackFrame(packed: Uint8Array): Uint8Array {
  if (packed.length !== PACKED_FRAME_BYTES) {
    throw new Error(`A packed frame is ${PACKED_FRAME_BYTES} bytes, not ${packed.length}`);
  }
  const pixels = new Uint8Array(PIXELS);
  for (let i = 0; i < PIXELS; i++) pixels[i] = (packed[i >> 3]! >> (7 - (i & 7))) & 1;
  return pixels;
}
