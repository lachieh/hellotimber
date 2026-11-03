import { missingStockGlyphs } from "@hellotimber/nokia-os";
import { ROW_TEXT_WIDTH } from "@hellotimber/nokia-kit/ui/display/list-rows";
import { STOCK_FONTS } from "@hellotimber/nokia-kit/ui/resources";
import { textWidth } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { SECTIONS } from "../src/content/sections";
import { readerPages } from "../src/home/lcd";

describe("section records", () => {
  it("cover each section once, routed by id", () => {
    expect(SECTIONS.map((s) => s.id)).toEqual([
      "about",
      "work",
      "writing",
      "now",
      "contact",
      "chat",
      "snake",
    ]);
    for (const section of SECTIONS) {
      expect(section.route).toBe(`/${section.id}`);
      expect(section.specs.length).toBeGreaterThanOrEqual(2);
      expect(section.specs.length).toBeLessThanOrEqual(4);
      expect(section.description.length).toBeLessThanOrEqual(160);
    }
  });

  it("fit their LCD forms on the stock LCD", () => {
    for (const section of SECTIONS) {
      expect(missingStockGlyphs(section.label, "large")).toEqual([]);
      if (section.kind !== "page") continue;
      const { lcd } = section;
      if (lcd.kind === "reader") {
        expect(readerPages(lcd.text).length).toBeLessThanOrEqual(4);
        continue;
      }
      for (const item of lcd.items) {
        expect(missingStockGlyphs(item.label, "small")).toEqual([]);
        expect(textWidth(STOCK_FONTS.small, item.label)).toBeLessThanOrEqual(ROW_TEXT_WIDTH);
        if (item.opens.kind === "reader") {
          expect(readerPages(item.opens.text).length).toBeLessThanOrEqual(3);
        }
      }
    }
  });
});
