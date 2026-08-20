import { describe, expect, it } from "vite-plus/test";
import type { ScreenModel } from "@hellotimber/phone-core";
import { FONT, textWidth } from "../src/font/font";
import { Framebuffer } from "../src/framebuffer";
import { renderList, renderReader } from "../src/render/list";
import {
  drawMenuIndicator,
  drawPositionRail,
  formatMenuIndicator,
  truncateToWidth,
} from "../src/render/layout";
import { regionToArt } from "./helpers";

type ListScreen = Parameters<typeof renderList>[1];
type ReaderScreen = Extract<ScreenModel, { kind: "reader" }>;

function list(overrides: Partial<ListScreen> = {}): ListScreen {
  return {
    kind: "list",
    title: "Phone book",
    items: ["Search", "Add name", "Erase"],
    selected: 1,
    softkey: "Select",
    menuIndicator: { segments: [1], awaitingNext: false },
    ...overrides,
  };
}

describe("renderList", () => {
  it("omits the title and uses all three content rows for firmware menu lists", () => {
    const fb = new Framebuffer();
    renderList(fb, list());
    const expected = new Framebuffer();
    expected.drawText(FONT, "Search", 2, 9);
    expected.fillRect(0, 18, 82, 10, 1);
    expected.drawText(FONT, "Add name", 2, 19, { color: 0 });
    expected.drawText(FONT, "Erase", 2, 29);
    expect(regionToArt(fb, 0, 8, 78, 31)).toBe(regionToArt(expected, 0, 8, 78, 31));
  });

  it("preserves the title behavior for generic application lists", () => {
    const fb = new Framebuffer();
    renderList(fb, list({ menuIndicator: undefined }));
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "Phone book", 0);
    expect(regionToArt(fb, 0, 0, 82, 7)).toBe(regionToArt(expected, 0, 0, 82, 7));
  });

  it("uses an exactly 10px band from x=0..77 with a three-pixel rail gap", () => {
    const fb = new Framebuffer();
    renderList(fb, list({ items: ["ABCDEFG"], selected: 0 }));
    for (let x = 0; x <= 77; x++) {
      expect(fb.getPixel(x, 8), `top padding x=${x}`).toBe(1);
      expect(fb.getPixel(x, 16), `bottom padding 1 x=${x}`).toBe(1);
      expect(fb.getPixel(x, 17), `bottom padding 2 x=${x}`).toBe(1);
    }
    for (let x = 78; x <= 80; x++) expect(fb.getPixel(x, 8), `gap x=${x}`).toBe(0);
    expect(fb.getPixel(0, 18)).toBe(0);
    expect(fb.getPixel(77, 18)).toBe(0);
    expect(fb.getPixel(81, 8)).toBe(1);
    expect(fb.getPixel(82, 8)).toBe(1);
  });

  it("fills the band before punching selected glyph ink to color 0", () => {
    const fb = new Framebuffer();
    renderList(fb, list({ items: ["I"], selected: 0 }));
    expect(fb.getPixel(2, 9)).toBe(0);
    expect(fb.getPixel(4, 9)).toBe(1);
  });

  it("truncates labels by measured width before the three-pixel rail gap", () => {
    expect(truncateToWidth(FONT, "mmmmmmmmmm", 76)).toBe("mmmmmmm…");
    const fb = new Framebuffer();
    renderList(fb, list({ items: ["mmmmmmmmmm"], selected: 0 }));
    expect(textWidth(FONT, truncateToWidth(FONT, "mmmmmmmmmm", 76))).toBeLessThanOrEqual(76);
    for (let x = 78; x <= 80; x++) {
      for (let y = 8; y <= 17; y++) expect(fb.getPixel(x, y), `gap at ${x},${y}`).toBe(0);
    }
  });
});

describe("drawPositionRail", () => {
  it.each([
    [0, 3, 8],
    [1, 3, 21],
    [2, 3, 33],
  ])("pins first/middle/last bump top for index %i", (index, total, bumpTop) => {
    const fb = new Framebuffer();
    drawPositionRail(fb, index, total);
    for (let y = 8; y <= 39; y++) {
      const connector = y === bumpTop || y === bumpTop + 6;
      const displaced = y > bumpTop && y < bumpTop + 6;
      expect(fb.getPixel(81, y), `x=81,y=${y}`).toBe(displaced ? 0 : 1);
      expect(fb.getPixel(82, y), `x=82,y=${y}`).toBe(connector ? 1 : 0);
      expect(fb.getPixel(83, y), `x=83,y=${y}`).toBe(displaced ? 1 : 0);
    }
  });
});

describe("menu indicator", () => {
  it("formats active and inactive structured hierarchy data", () => {
    expect(formatMenuIndicator({ segments: [5], awaitingNext: true })).toBe("5 • _");
    expect(formatMenuIndicator({ segments: [5, 3], awaitingNext: true })).toBe("5 • 3 • _");
    expect(formatMenuIndicator({ segments: [5, 3], awaitingNext: false })).toBe("5 • 3");
  });

  it("right-aligns to the x=83 frame edge with no gap", () => {
    const fb = new Framebuffer();
    drawMenuIndicator(fb, { segments: [5, 3], awaitingNext: true });
    const expected = new Framebuffer();
    const text = "5 • 3 • _";
    expected.drawText(FONT, text, 84 - textWidth(FONT, text), 0);
    expect(regionToArt(fb, 0, 0, 84, 9)).toBe(regionToArt(expected, 0, 0, 84, 9));
    expect(fb.getPixel(83, 6)).toBe(1);
  });
});

describe("renderReader", () => {
  function reader(overrides: Partial<ReaderScreen> = {}): ReaderScreen {
    return {
      kind: "reader",
      title: "Chat",
      lines: ["line one", "line two", "line three", "line four"],
      scrollTop: 0,
      ...overrides,
    };
  }

  it("draws title, three visible lines from scrollTop, and Back", () => {
    const fb = new Framebuffer();
    renderReader(fb, reader({ scrollTop: 1 }));
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "Chat", 0);
    expected.drawText(FONT, "line two", 1, 9);
    expected.drawText(FONT, "line three", 1, 19);
    expected.drawText(FONT, "line four", 1, 29);
    expected.drawTextCentered(FONT, "Back", 41);
    expect(regionToArt(fb, 0, 0, 78, 48)).toBe(regionToArt(expected, 0, 0, 78, 48));
  });

  it("reserves measured top-row width for a menu indicator", () => {
    const menuIndicator = { segments: [5, 3], awaitingNext: true };
    const fb = new Framebuffer();
    renderReader(fb, reader({ title: "Incoming call alert", menuIndicator }));

    const expected = new Framebuffer();
    const indicatorText = formatMenuIndicator(menuIndicator);
    const titleAreaWidth = 83 - textWidth(FONT, indicatorText);
    const title = truncateToWidth(FONT, "Incoming call alert", titleAreaWidth);
    expected.drawText(FONT, title, Math.floor((titleAreaWidth - textWidth(FONT, title)) / 2), 0);
    drawMenuIndicator(expected, menuIndicator);

    expect(regionToArt(fb, 0, 0, 81, 9)).toBe(regionToArt(expected, 0, 0, 81, 9));
  });
});
