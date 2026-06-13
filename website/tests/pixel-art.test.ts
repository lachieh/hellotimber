import { describe, expect, it } from "vite-plus/test";
import { artToBitmap } from "../src/phone/pixel-art";

describe("artToBitmap", () => {
  it("converts string-art rows to a one-byte-per-pixel Bitmap", () => {
    const bmp = artToBitmap([".#.", "#.#", ".#."]);
    expect(bmp.width).toBe(3);
    expect(bmp.height).toBe(3);
    expect(bmp.pixels.length).toBe(9);
    expect([...bmp.pixels]).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0]);
  });
  it("pads ragged rows to the widest row with clear pixels", () => {
    const bmp = artToBitmap(["##", "#"]);
    expect(bmp.width).toBe(2);
    expect([...bmp.pixels]).toEqual([1, 1, 1, 0]);
  });
});
