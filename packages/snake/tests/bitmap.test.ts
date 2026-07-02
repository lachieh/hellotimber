import { describe, expect, it } from "vite-plus/test";
import { createBitmap, drawArt, fillRect, setPixel } from "../src/bitmap";
import { FONT_3X5, drawNumber, numberWidth } from "../src/font";
import { HEAD, SPRITE_BONUS, SPRITE_FOOD } from "../src/sprites";
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
    for (const d of "0123456789") {
      const rows = FONT_3X5[d]!;
      expect(rows).toHaveLength(5);
      for (const row of rows) expect(row).toMatch(/^[#.]{3}$/);
    }
  });

  it("drawNumber advances 4px per digit and zero-pads on request", () => {
    const b = createBitmap(40, 8);
    drawNumber(b, 0, 0, 90, 4); // "0090"
    const manual = createBitmap(40, 8);
    for (let i = 0; i < 4; i++) drawArt(manual, i * 4, 0, FONT_3X5["0090"[i]!]!);
    expect(b.pixels.join("")).toBe(manual.pixels.join(""));
    expect(numberWidth(90, 4)).toBe(15);
  });
});

describe("sprites", () => {
  it("are all 4x4 (head in all four directions)", () => {
    for (const s of [HEAD.up, HEAD.right, HEAD.down, HEAD.left, SPRITE_FOOD, SPRITE_BONUS]) {
      expect(s).toHaveLength(4);
      for (const row of s) expect(row).toMatch(/^[#.]{4}$/);
    }
  });
});
