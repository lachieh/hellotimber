import { describe, expect, it } from "vite-plus/test";
import { bitmapFromArt } from "../src/bitmap";
import { Framebuffer } from "../src/framebuffer";
import { expectPixels, regionToArt } from "./helpers";

describe("bitmapFromArt", () => {
  it("parses string-art into a one-byte-per-pixel row-major bitmap", () => {
    const b = bitmapFromArt(["#.#", ".#."]);
    expect(b.width).toBe(3);
    expect(b.height).toBe(2);
    expect(Array.from(b.pixels)).toEqual([1, 0, 1, 0, 1, 0]);
    expect(b.pixels).toBeInstanceOf(Uint8Array);
    expect(b.pixels.length).toBe(b.width * b.height);
  });

  it("throws on ragged rows and on invalid characters", () => {
    expect(() => bitmapFromArt(["##", "#"])).toThrow(/row 1/);
    expect(() => bitmapFromArt(["#x"])).toThrow(/invalid char/);
    expect(() => bitmapFromArt([])).toThrow(/no rows/);
  });
});

describe("Framebuffer", () => {
  it("defaults to 84×48 with all pixels clear", () => {
    const fb = new Framebuffer();
    expect(fb.width).toBe(84);
    expect(fb.height).toBe(48);
    expect(fb.pixels.length).toBe(84 * 48);
    expect(fb.pixels.every((p) => p === 0)).toBe(true);
  });

  it("setPixel/getPixel round-trip; out-of-bounds is safe", () => {
    const fb = new Framebuffer();
    fb.setPixel(0, 0, 1);
    fb.setPixel(83, 47, 1);
    expect(fb.getPixel(0, 0)).toBe(1);
    expect(fb.getPixel(83, 47)).toBe(1);
    expect(fb.getPixel(1, 0)).toBe(0);
    fb.setPixel(-1, 0, 1);
    fb.setPixel(84, 0, 1);
    fb.setPixel(0, 48, 1);
    expect(fb.getPixel(-1, 0)).toBe(0);
    expect(fb.getPixel(84, 0)).toBe(0);
    expect(fb.pixels.filter((p) => p === 1)).toHaveLength(2);
  });

  it("clear fills every pixel", () => {
    const fb = new Framebuffer();
    fb.clear(1);
    expect(fb.pixels.every((p) => p === 1)).toBe(true);
    fb.clear();
    expect(fb.pixels.every((p) => p === 0)).toBe(true);
  });

  it("fillRect draws a clipped solid rectangle", () => {
    const fb = new Framebuffer();
    fb.fillRect(1, 1, 3, 2);
    expectPixels(
      fb,
      0,
      0,
      `
        .....
        .###.
        .###.
        .....
      `,
    );
    fb.fillRect(2, 2, 1, 1, 0); // erase one pixel
    expectPixels(
      fb,
      1,
      1,
      `
        ###
        #.#
      `,
    );
    fb.fillRect(82, 46, 10, 10); // clips at the edges without throwing
    expect(fb.getPixel(83, 47)).toBe(1);
  });

  it("blitBitmap is transparent: only set pixels are written", () => {
    const fb = new Framebuffer();
    fb.fillRect(0, 0, 5, 3, 1);
    fb.blitBitmap(bitmapFromArt(["..#..", ".....", "..#.."]), 0, 0, { value: 0 });
    expectPixels(
      fb,
      0,
      0,
      `
        ##.##
        #####
        ##.##
      `,
    );
  });

  it("blitBitmap scales each set pixel into a scale×scale block", () => {
    const fb = new Framebuffer();
    fb.blitBitmap(bitmapFromArt(["#.", ".#"]), 1, 1, { scale: 2 });
    expectPixels(
      fb,
      0,
      0,
      `
        ......
        .##...
        .##...
        ...##.
        ...##.
        ......
      `,
    );
  });

  it("regionToArt round-trips through bitmapFromArt", () => {
    const fb = new Framebuffer();
    fb.blitBitmap(bitmapFromArt(["#.#", ".#."]), 10, 10);
    expect(regionToArt(fb, 10, 10, 3, 2)).toBe("#.#\n.#.");
  });
});
