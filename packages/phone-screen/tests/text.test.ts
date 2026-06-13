import { describe, expect, it } from "vite-plus/test";
import { FONT } from "../src/font/font";
import { Framebuffer } from "../src/framebuffer";
import { expectPixels, regionToArt } from "./helpers";

describe("drawText", () => {
  it("draws glyphs with a 1px gap and returns the next x", () => {
    const fb = new Framebuffer();
    const next = fb.drawText(FONT, "HI", 0, 0);
    expect(next).toBe(12);
    expectPixels(
      fb,
      0,
      0,
      `
        #...#..###.
        #...#...#..
        #...#...#..
        #####...#..
        #...#...#..
        #...#...#..
        #...#..###.
      `,
    );
  });

  it("scales glyphs 2x for the bold/large variant", () => {
    const fb = new Framebuffer();
    fb.drawText(FONT, "-", 0, 0, { scale: 2 });
    expectPixels(
      fb,
      0,
      4,
      `
        ..........
        ..........
        ##########
        ##########
        ..........
      `,
    );
  });

  it("draws with color 0 for inverted video", () => {
    const fb = new Framebuffer();
    fb.fillRect(0, 0, 7, 9, 1);
    fb.drawText(FONT, "I", 1, 1, { color: 0 });
    expectPixels(
      fb,
      0,
      0,
      `
        #######
        ##...##
        ###.###
        ###.###
        ###.###
        ###.###
        ###.###
        ##...##
        #######
      `,
    );
  });

  it("renders unknown characters as '?'", () => {
    const a = new Framebuffer();
    const b = new Framebuffer();
    a.drawText(FONT, "~", 0, 0);
    b.drawText(FONT, "?", 0, 0);
    expect(regionToArt(a, 0, 0, 5, 7)).toBe(regionToArt(b, 0, 0, 5, 7));
  });

  it("drawTextCentered centers by pixel width", () => {
    const centered = new Framebuffer();
    const manual = new Framebuffer();
    centered.drawTextCentered(FONT, "MENU", 0); // width 23 → x = (84-23)/2 = 30
    manual.drawText(FONT, "MENU", 30, 0);
    expect(regionToArt(centered, 0, 0, 84, 7)).toBe(regionToArt(manual, 0, 0, 84, 7));
  });

  it("drawTextCentered centers scaled text too", () => {
    const centered = new Framebuffer();
    const manual = new Framebuffer();
    centered.drawTextCentered(FONT, "LACHLAN", 10, { scale: 2 }); // width 82 → x = 1
    manual.drawText(FONT, "LACHLAN", 1, 10, { scale: 2 });
    expect(regionToArt(centered, 0, 10, 84, 14)).toBe(regionToArt(manual, 0, 10, 84, 14));
  });
});
