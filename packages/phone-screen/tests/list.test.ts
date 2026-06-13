import { describe, expect, it } from "vite-plus/test";
import type { ScreenModel } from "@hellotimber/phone-core";
import { FONT } from "../src/font/font";
import { Framebuffer } from "../src/framebuffer";
import { renderList, renderReader } from "../src/render/list";
import { regionToArt } from "./helpers";

type ListScreen = Extract<ScreenModel, { kind: "list" }>;
type ReaderScreen = Extract<ScreenModel, { kind: "reader" }>;

function list(overrides: Partial<ListScreen> = {}): ListScreen {
  return {
    kind: "list",
    title: "Phone book",
    items: ["Search", "Memory status"],
    selected: 0,
    softkey: "Select",
    ...overrides,
  };
}

describe("renderList", () => {
  it("draws the title centered on the top row and the softkey from the model", () => {
    const fb = new Framebuffer();
    renderList(fb, list());
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "Phone book", 0);
    expected.drawTextCentered(FONT, "Select", 41);
    expect(regionToArt(fb, 0, 0, 84, 7)).toBe(regionToArt(expected, 0, 0, 84, 7));
    expect(regionToArt(fb, 0, 41, 84, 7)).toBe(regionToArt(expected, 0, 41, 84, 7));
  });

  it("draws the selected item as an inverted-video bar", () => {
    const fb = new Framebuffer();
    renderList(fb, list()); // selected 0 → row at y 9, bar at y 8–16
    const expected = new Framebuffer();
    expected.fillRect(0, 8, 84, 9, 1);
    expected.drawText(FONT, "Search", 2, 9, { color: 0 });
    expect(regionToArt(fb, 0, 8, 80, 9)).toBe(regionToArt(expected, 0, 8, 80, 9));
  });

  it("draws unselected items as plain text", () => {
    const fb = new Framebuffer();
    renderList(fb, list()); // second row at y 19
    const expected = new Framebuffer();
    expected.drawText(FONT, "Memory status", 2, 19);
    expect(regionToArt(fb, 0, 18, 80, 9)).toBe(regionToArt(expected, 0, 18, 80, 9));
  });

  it("scrolls so the selection stays visible (middle row when possible)", () => {
    const items = ["One", "Two", "Three", "Four", "Five"];
    const fb = new Framebuffer();
    renderList(fb, list({ items, selected: 3 })); // top = 2 → window Three/Four/Five
    const expected = new Framebuffer();
    expected.drawText(FONT, "Three", 2, 9);
    expect(regionToArt(fb, 0, 9, 60, 7)).toBe(regionToArt(expected, 0, 9, 60, 7));
    // selected 'Four' is the middle row → inverted bar at y 18–26
    expect(fb.getPixel(0, 18)).toBe(1);
  });

  it("shows the scroll indicator only when items overflow", () => {
    const short = new Framebuffer();
    renderList(short, list());
    expect(short.getPixel(83, 20)).toBe(0);
    const long = new Framebuffer();
    renderList(long, list({ items: ["a", "b", "c", "d"], selected: 0 }));
    expect(long.getPixel(83, 20)).toBe(1);
  });

  it("truncates long labels with an ellipsis", () => {
    const fb = new Framebuffer();
    renderList(fb, list({ items: ["Extraordinarily long"], selected: 0 }));
    const expected = new Framebuffer();
    expected.fillRect(0, 8, 84, 9, 1);
    expected.drawText(FONT, "Extraordinar…", 2, 9, { color: 0 });
    expect(regionToArt(fb, 0, 8, 80, 9)).toBe(regionToArt(expected, 0, 8, 80, 9));
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

  it("draws title, three visible lines from scrollTop, and the Back softkey", () => {
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

  it("shows ▲ only when scrolled down and ▼ only when more lines remain", () => {
    const atTop = new Framebuffer();
    renderReader(atTop, reader()); // 4 lines, scrollTop 0 → more below
    const up = new Framebuffer();
    up.drawText(FONT, "▲", 79, 9);
    const down = new Framebuffer();
    down.drawText(FONT, "▼", 79, 29);
    expect(regionToArt(atTop, 79, 9, 5, 7)).toBe(regionToArt(new Framebuffer(), 79, 9, 5, 7));
    expect(regionToArt(atTop, 79, 29, 5, 7)).toBe(regionToArt(down, 79, 29, 5, 7));

    const atEnd = new Framebuffer();
    renderReader(atEnd, reader({ scrollTop: 1 })); // lines 2–4 visible → nothing below
    expect(regionToArt(atEnd, 79, 9, 5, 7)).toBe(regionToArt(up, 79, 9, 5, 7));
    expect(regionToArt(atEnd, 79, 29, 5, 7)).toBe(regionToArt(new Framebuffer(), 79, 29, 5, 7));
  });
});
