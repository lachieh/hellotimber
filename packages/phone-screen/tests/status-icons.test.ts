import { describe, expect, it } from "vite-plus/test";
import { Framebuffer } from "../src/framebuffer";
import {
  drawBatteryLevel,
  drawSignalLevel,
  ENVELOPE_ICON,
  KEYGUARD_ICON,
} from "../src/icons/status";
import { expectPixels } from "./helpers";

describe("status icons", () => {
  it("envelope and keyguard are 8×8 bitmaps", () => {
    for (const icon of [ENVELOPE_ICON, KEYGUARD_ICON]) {
      expect(icon.width).toBe(8);
      expect(icon.height).toBe(8);
      expect(icon.pixels.some((p) => p === 1)).toBe(true);
    }
  });
});

describe("drawSignalLevel", () => {
  it("draws the antenna glyph at the top-left", () => {
    const fb = new Framebuffer();
    drawSignalLevel(fb, 0);
    expectPixels(
      fb,
      0,
      0,
      `
        #.#.#
        .###.
        ..#..
        ..#..
        ..#..
      `,
    );
  });

  it("level N fills the bottom N rungs, growing upward", () => {
    const fb = new Framebuffer();
    drawSignalLevel(fb, 2);
    // rungs 0 and 1 (y 27 and 22) set, rungs 2 and 3 (y 17 and 12) clear
    expectPixels(
      fb,
      0,
      12,
      `
        ...
        ...
        ...
        ...
        ...
        ...
        ...
        ...
        ...
        ...
        ###
        ###
        ###
        ###
        ...
        ###
        ###
        ###
        ###
      `,
    );
  });

  it("level 4 fills all rungs; level 0 fills none", () => {
    const full = new Framebuffer();
    const empty = new Framebuffer();
    drawSignalLevel(full, 4);
    drawSignalLevel(empty, 0);
    expect(full.getPixel(0, 12)).toBe(1);
    expect(full.getPixel(2, 30)).toBe(1);
    expect(empty.getPixel(0, 12)).toBe(0);
    expect(empty.getPixel(2, 30)).toBe(0);
  });
});

describe("drawBatteryLevel", () => {
  it("draws the battery glyph at the top-right", () => {
    const fb = new Framebuffer();
    drawBatteryLevel(fb, 0);
    expectPixels(
      fb,
      79,
      0,
      `
        ..#..
        #####
        #...#
        #...#
        #####
      `,
    );
  });

  it("rungs stack on the right edge, growing upward", () => {
    const fb = new Framebuffer();
    drawBatteryLevel(fb, 1);
    expectPixels(
      fb,
      81,
      22,
      `
        ...
        ...
        ...
        ...
        ...
        ###
        ###
        ###
        ###
      `,
    );
  });
});
