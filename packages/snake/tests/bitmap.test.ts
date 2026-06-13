import { describe, expect, it } from "vite-plus/test";
import { createBitmap, drawArt, fillRect, setPixel } from "../src/bitmap";
import { FONT_3X5, drawNumber } from "../src/font";
import {
  SPRITE_BODY_NOTCH,
  SPRITE_BODY_SOLID,
  SPRITE_BONUS,
  SPRITE_FOOD,
  SPRITE_HEAD,
} from "../src/sprites";
import { expectFrame } from "./pixels";

describe("bitmap", () => {
  it("creates an 84x48 zeroed buffer by default", () => {
    const b = createBitmap();
    expect(b.width).toBe(84);
    expect(b.height).toBe(48);
    expect(b.pixels).toHaveLength(84 * 48);
    expect(b.pixels.every((p) => p === 0)).toBe(true);
  });

  it("setPixel clips out-of-bounds writes", () => {
    const b = createBitmap(4, 4);
    setPixel(b, -1, 0);
    setPixel(b, 4, 0);
    setPixel(b, 0, -1);
    setPixel(b, 0, 4);
    expect(b.pixels.every((p) => p === 0)).toBe(true);
    setPixel(b, 3, 3);
    expect(b.pixels[3 * 4 + 3]).toBe(1);
  });

  it("fillRect and drawArt set the right pixels", () => {
    const b = createBitmap(8, 8);
    fillRect(b, 1, 1, 2, 2);
    drawArt(b, 4, 4, ["#.", ".#"]);
    expectFrame(
      b,
      0,
      0,
      8,
      8,
      `
      ........
      .##.....
      .##.....
      ........
      ....#...
      .....#..
      ........
      ........
    `,
    );
  });
});

describe("3x5 digit font", () => {
  it("has all ten digits, 3x5 each", () => {
    for (let d = 0; d <= 9; d++) {
      const glyph = FONT_3X5[String(d)];
      expect(glyph).toHaveLength(5);
      for (const row of glyph) expect(row).toMatch(/^[#.]{3}$/);
    }
  });

  it("draws multi-digit numbers with a 1px gap", () => {
    const b = createBitmap(16, 8);
    drawNumber(b, 1, 1, 90);
    expectFrame(
      b,
      1,
      1,
      7,
      5,
      `
      ###.###
      #.#.#.#
      ###.#.#
      ..#.#.#
      ###.###
    `,
    );
  });
});

describe("sprites", () => {
  it("are all 4x4", () => {
    for (const s of [
      SPRITE_HEAD,
      SPRITE_BODY_NOTCH,
      SPRITE_BODY_SOLID,
      SPRITE_FOOD,
      SPRITE_BONUS,
    ]) {
      expect(s).toHaveLength(4);
      for (const row of s) expect(row).toMatch(/^[#.]{4}$/);
    }
  });
});
