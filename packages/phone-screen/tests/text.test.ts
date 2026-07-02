import { describe, expect, it } from "vite-plus/test";
import { charAdvance, FONT, textWidth } from "../src/font/font";
import { Framebuffer } from "../src/framebuffer";
import { regionToArt } from "./helpers";

describe("drawText", () => {
  it("advances per glyph (variable width) and returns the next x", () => {
    const fb = new Framebuffer();
    const next = fb.drawText(FONT, "HI", 0, 0);
    expect(next).toBe(textWidth(FONT, "HI"));
    // identical to blitting each glyph at its own advance-accumulated x
    const manual = new Framebuffer();
    manual.blitBitmap(FONT.glyphs.get("H")!, 0, 0);
    manual.blitBitmap(FONT.glyphs.get("I")!, charAdvance(FONT, "H"), 0);
    expect(regionToArt(fb, 0, 0, 84, 9)).toBe(regionToArt(manual, 0, 0, 84, 9));
  });

  it("scales glyphs 2x for the bold/large variant", () => {
    const fb = new Framebuffer();
    const next = fb.drawText(FONT, "-", 0, 0, { scale: 2 });
    expect(next).toBe(textWidth(FONT, "-", 2));
    const manual = new Framebuffer();
    manual.blitBitmap(FONT.glyphs.get("-")!, 0, 0, { scale: 2 });
    expect(regionToArt(fb, 0, 0, 20, 18)).toBe(regionToArt(manual, 0, 0, 20, 18));
  });

  it("draws with color 0 for inverted video", () => {
    const fb = new Framebuffer();
    fb.fillRect(0, 0, 10, 11, 1);
    fb.drawText(FONT, "I", 1, 1, { color: 0 });
    const manual = new Framebuffer();
    manual.fillRect(0, 0, 10, 11, 1);
    manual.blitBitmap(FONT.glyphs.get("I")!, 1, 1, { value: 0 });
    expect(regionToArt(fb, 0, 0, 10, 11)).toBe(regionToArt(manual, 0, 0, 10, 11));
    // the ink pixels really did punch holes in the fill
    expect(regionToArt(fb, 0, 0, 10, 11)).not.toBe(regionToArt(new Framebuffer(), 0, 0, 10, 11));
  });

  it("renders unknown characters as '?'", () => {
    const a = new Framebuffer();
    const b = new Framebuffer();
    a.drawText(FONT, "~", 0, 0);
    b.drawText(FONT, "?", 0, 0);
    expect(regionToArt(a, 0, 0, 8, 9)).toBe(regionToArt(b, 0, 0, 8, 9));
  });

  it("drawTextCentered centers by pixel width", () => {
    const centered = new Framebuffer();
    const manual = new Framebuffer();
    centered.drawTextCentered(FONT, "MENU", 0);
    manual.drawText(FONT, "MENU", Math.floor((84 - textWidth(FONT, "MENU")) / 2), 0);
    expect(regionToArt(centered, 0, 0, 84, 9)).toBe(regionToArt(manual, 0, 0, 84, 9));
  });

  it("drawTextCentered centers scaled text too", () => {
    const centered = new Framebuffer();
    const manual = new Framebuffer();
    centered.drawTextCentered(FONT, "OK", 10, { scale: 2 });
    manual.drawText(FONT, "OK", Math.floor((84 - textWidth(FONT, "OK", 2)) / 2), 10, {
      scale: 2,
    });
    expect(regionToArt(centered, 0, 10, 84, 18)).toBe(regionToArt(manual, 0, 10, 84, 18));
  });
});
