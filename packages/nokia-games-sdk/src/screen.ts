// The 84×48 1-bit frame a game draws into. Plan 28 Task 2 implements this test-first; until then
// every method throws.

function todo(): never {
  throw new Error("GameScreen is not implemented yet (plan 28 Task 2)");
}

export class GameScreen {
  readonly width = 84 as const;
  readonly height = 48 as const;
  /** 4032 bytes, 0/1, row-major (phone-core Bitmap layout). */
  readonly pixels = new Uint8Array(84 * 48);
  /** 0 outside the screen. */
  get(_x: number, _y: number): 0 | 1 {
    return todo();
  }
  /** Clipped. */
  set(_x: number, _y: number, _ink?: 0 | 1): void {
    todo();
  }
  clear(): void {
    todo();
  }
  fill(_x: number, _y: number, _w: number, _h: number, _ink?: 0 | 1): void {
    todo();
  }
  invert(_x: number, _y: number, _w: number, _h: number): void {
    todo();
  }
  /** `#` ink, `.` paper, other characters skip. */
  blit(_art: readonly string[], _x: number, _y: number): void {
    todo();
  }
  /** 504 bytes: row-major, MSB first, 1 = ink. */
  pack(): Uint8Array {
    return todo();
  }
}
