import { describe, expect, it } from "vite-plus/test";
import { Framebuffer } from "../src/framebuffer";
import { FONT, textWidth } from "../src/font/font";
import { GLYPHS } from "../src/font/glyphs";
import { expectPixels } from "./helpers";

describe("glyph data", () => {
  it("every glyph is 9 rows of consistent-width '#'/'.'", () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows, `glyph '${ch}' row count`).toHaveLength(9);
      const width = rows[0]!.length;
      for (const row of rows) {
        expect(row, `glyph '${ch}' row '${row}'`).toMatch(new RegExp(`^[#.]{${width}}$`));
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
  it("is the authentic variable-width 9-row font", () => {
    expect(FONT.glyphHeight).toBe(9);
    expect(FONT.nominalAdvance).toBe(6);
    expect(FONT.glyphs.size).toBe(Object.keys(GLYPHS).length);
    // every glyph's height matches the cell; widths vary per glyph
    for (const [ch, glyph] of FONT.glyphs) {
      expect(glyph.height, `glyph '${ch}' height`).toBe(9);
      expect(glyph.width, `glyph '${ch}' width`).toBeGreaterThan(0);
    }
  });

  it("carries the authentic metrics: narrow i, wide m, bold double-stem caps", () => {
    expect(FONT.glyphs.get("i")!.width).toBe(3);
    expect(FONT.glyphs.get("m")!.width).toBe(9);
    expect(FONT.glyphs.get("M")!.width).toBe(8);
    expect(FONT.glyphs.get("A")!.width).toBe(6);
    // lowercase descenders reach below the baseline (rows 7-8)
    const g = FONT.glyphs.get("g")!;
    let descenderInk = false;
    for (let y = 7; y < 9; y++) {
      for (let x = 0; x < g.width; x++) if (g.pixels[y * g.width + x] === 1) descenderInk = true;
    }
    expect(descenderInk).toBe(true);
  });

  it("textWidth sums per-glyph advances (baked-in right bearing)", () => {
    expect(textWidth(FONT, "")).toBe(0);
    expect(textWidth(FONT, "A")).toBe(6);
    expect(textWidth(FONT, "AB")).toBe(12);
    expect(textWidth(FONT, "im")).toBe(12); // 3 + 9 — variable width
    expect(textWidth(FONT, "A", 2)).toBe(12); // scale multiplies
  });
});
