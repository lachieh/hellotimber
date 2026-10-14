import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SubmenuEntry, type ScreenModel } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { paintIndicator } from "../src/display/indicator";
import { paintRail, railBumpTop } from "../src/display/rail";
import { createStockMenu } from "../src/firmware/menu";
import { paintStockScreen } from "../src/index";
import { expectLcd } from "./support/golden.ts";
import { loadGolden } from "./support/goldens.ts";

type List = Extract<ScreenModel, { kind: "list" }>;

interface IndexEntry {
  id: string;
  status: string;
}

const INDEX: IndexEntry[] = JSON.parse(
  readFileSync(join(import.meta.dirname, "../goldens/index.json"), "utf8"),
);

// Clock settings and Date setting show the emulator's clock and setup date (D11 test inputs).
const menu = createStockMenu({ clock: () => "10:10", date: () => "13.10.2026" });

/** The literal list model the kernel emits for `submenu` with child `selected` highlighted. */
function listModel(submenu: SubmenuEntry, selected: number): List {
  const children = submenu.children.entries;
  const orders = children.map((child) => child.order.value);
  const detail = submenu.detailOf(children[selected]!);
  return {
    kind: "list",
    title: submenu.label,
    items: children.map((child) => child.label),
    ...(orders.every((n, i) => n === i + 1) ? {} : { itemOrders: orders }),
    selected,
    softkey: "Select",
    menuIndicator: { segments: [submenu.order.value], awaitingNext: false },
    ...(submenu.presentation === "pages" ? { presentation: "pages" as const } : {}),
    ...(detail === undefined ? {} : { detail }),
  };
}

function paint(screen: ScreenModel): Framebuffer {
  const fb = new Framebuffer();
  fb.clear(1);
  paintStockScreen(fb, screen);
  return fb;
}

describe("stock submenu lists against every asserted level-1 golden", () => {
  const subs = INDEX.filter(
    (entry) =>
      entry.id.startsWith("menu/") && entry.id.endsWith(".sub") && entry.status === "asserted",
  );

  it("covers the ten asserted level-1 sequences", () => {
    expect(subs).toHaveLength(10);
  });

  for (const { id } of subs) {
    const golden = loadGolden(id);
    const number = Number(/menu\/(\d+)-/.exec(id)![1]);
    const submenu = menu.entries[number - 1]!.entry as SubmenuEntry;

    for (const image of golden.images) {
      const selected = Number(image.name) - 1;
      it(`${id} "${image.name}"`, () => {
        const model = listModel(submenu, selected);
        expectLcd(paint(model), { id, image }, `${submenu.label}, selected ${selected}`);
      });
    }
  }
});

describe("stock rail", () => {
  // Bump tops b = 7 + floor(i * 23 / (n - 1)) at the first, middle and last positions.
  const CASES: [n: number, tops: [first: number, middle: number, last: number]][] = [
    [3, [7, 18, 30]],
    [5, [7, 18, 30]],
    [6, [7, 20, 30]],
    [8, [7, 20, 30]],
    [9, [7, 18, 30]],
    [10, [7, 19, 30]],
    [12, [7, 19, 30]],
  ];

  for (const [n, [first, middle, last]] of CASES) {
    it(`places the bump for n = ${n}`, () => {
      const mid = Math.floor(n / 2);
      expect([railBumpTop(0, n), railBumpTop(mid, n), railBumpTop(n - 1, n)]).toEqual([
        first,
        middle,
        last,
      ]);
    });
  }

  it("has the captured pixel shape: track x 81, y 7..36, bump out to x 83", () => {
    const fb = new Framebuffer();
    paintRail(fb, 4, 10); // bump top 17
    const rows: string[] = [];
    for (let y = 5; y <= 38; y++) {
      let row = "";
      for (let x = 80; x < 84; x++) row += fb.getPixel(x, y) ? "#" : ".";
      rows.push(row);
    }
    expect(rows).toEqual([
      "....", // 5
      "....",
      ".#..", // 7: track top
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".##.", // 17: bump top
      "...#",
      "...#",
      "...#",
      "...#",
      "...#",
      ".##.", // 23: bump bottom
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..",
      ".#..", // 36: track bottom
      "....",
      "....",
    ]);
  });
});

describe("stock list layout rules", () => {
  const tones = menu.entries[4]!.entry as SubmenuEntry;

  it("throws for a page line wider than the page and names the label (D10)", () => {
    const model = { ...listModel(tones, 0), items: ["Ringing tone with a long name\ntone"] };
    expect(() => paint(model)).toThrow(/Ringing tone with a long name\\ntone/);
  });

  it("throws for a page label with more than three lines", () => {
    const model = { ...listModel(tones, 0), items: ["a\nb\nc\nd"] };
    expect(() => paint(model)).toThrow(/has 4 lines/);
  });

  it("shows an item's kept menu number in the indicator while the rail uses its position", () => {
    const divert = menu.entries[6]!.entry as SubmenuEntry;
    const model = listModel(divert, 4);
    expect(model.itemOrders).toEqual([1, 2, 3, 4, 6]);
    const shown = paint(model);
    const indicator = new Framebuffer();
    paintIndicator(indicator, { segments: [7, 6], awaitingNext: false });
    for (let x = 40; x < 84; x++)
      for (let y = 0; y < 6; y++)
        expect(shown.getPixel(x, y), `(${x}, ${y})`).toBe(indicator.getPixel(x, y));
    // 5th of 5 visible items: the bump sits at the bottom of the rail.
    expect(shown.getPixel(82, railBumpTop(4, 5))).toBe(1);
    expect(railBumpTop(4, 5)).toBe(30);
  });
});
