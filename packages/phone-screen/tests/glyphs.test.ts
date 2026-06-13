import { describe, expect, it } from "vite-plus/test";
import { Framebuffer } from "../src/framebuffer";
import { FONT, textWidth } from "../src/font/font";
import { GLYPHS } from "../src/font/glyphs";
import { expectPixels } from "./helpers";

describe("glyph data", () => {
  it("every glyph is 7 rows of exactly 5 chars of '#'/'.'", () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows, `glyph '${ch}' row count`).toHaveLength(7);
      for (const row of rows) {
        expect(row, `glyph '${ch}' row '${row}'`).toMatch(/^[#.]{5}$/);
      }
    }
  });

  it("covers uppercase, digits and space", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ") {
      expect(GLYPHS[ch], `missing glyph '${ch}'`).toBeDefined();
    }
  });

  it("covers lowercase and punctuation", () => {
    for (const ch of "abcdefghijklmnopqrstuvwxyz.,:;!?'\"()+-*/#@_<>=%") {
      expect(GLYPHS[ch], `missing glyph '${ch}'`).toBeDefined();
    }
  });

  it("covers the ellipsis and arrow UI glyphs", () => {
    for (const ch of ["…", "►", "▲", "▼"]) {
      expect(GLYPHS[ch], `missing glyph '${ch}'`).toBeDefined();
    }
  });
});

describe("FONT", () => {
  it("is a compiled 5×7 font with a 1px gap", () => {
    expect(FONT.glyphWidth).toBe(5);
    expect(FONT.glyphHeight).toBe(7);
    expect(FONT.gap).toBe(1);
    expect(FONT.glyphs.size).toBe(Object.keys(GLYPHS).length);
  });

  it("compiled 'A' matches its art when blitted", () => {
    const fb = new Framebuffer();
    fb.blitBitmap(FONT.glyphs.get("A")!, 0, 0);
    expectPixels(
      fb,
      0,
      0,
      `
        .###.
        #...#
        #...#
        #####
        #...#
        #...#
        #...#
      `,
    );
  });

  it("textWidth: advance is 6px per char, no trailing gap", () => {
    expect(textWidth(FONT, "")).toBe(0);
    expect(textWidth(FONT, "A")).toBe(5);
    expect(textWidth(FONT, "AB")).toBe(11);
    expect(textWidth(FONT, "MENU", 2)).toBe(46); // (4*6-1)*2
    expect(textWidth(FONT, "NOKIA")).toBe(29);
  });
});
