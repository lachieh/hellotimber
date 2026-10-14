import { join } from "node:path";
import { rowsWindowTop, SubmenuEntry, type ScreenModel } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { readGoldenIndex } from "../scripts/golden-index.ts";
import { paintIndicator } from "../src/display/indicator";
import { paintRail, railBumpTop } from "../src/display/rail";
import { createStockMenu } from "../src/firmware/menu";
import { paintStockScreen } from "../src/index";
import { expectLcd, lcdMismatch } from "./support/golden.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";

type List = Extract<ScreenModel, { kind: "list" }>;

const INDEX = readGoldenIndex(join(import.meta.dirname, "../goldens"));

// Clock settings and Date setting show the emulator's clock and setup date (D11 test inputs).
const menu = createStockMenu({ clock: () => "10:10", date: () => "13.10.2026" });

/** Rows submenus keep a three-row circular window (createStockPhone sets `rowsWindow: 3`). */
const ROWS = 3;

/**
 * The literal list model the kernel emits for `submenu` with child `selected` highlighted and,
 * on a rows level, the window top `windowTop` (default: as entered with `selected`).
 */
function listModel(submenu: SubmenuEntry, selected: number, windowTop?: number): List {
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
    ...(submenu.presentation === "pages"
      ? {}
      : { windowTop: windowTop ?? rowsWindowTop(undefined, selected, children.length, ROWS) }),
  };
}

/** The selections and window tops of a rows level entered at `from`, then moved by `keys`. */
function walk(
  count: number,
  from: number,
  keys: readonly ("up" | "down")[],
): { selected: number; windowTop: number }[] {
  let selected = from;
  let windowTop = rowsWindowTop(undefined, from, count, ROWS);
  const states = [{ selected, windowTop }];
  for (const key of keys) {
    selected = (selected + (key === "down" ? 1 : count - 1)) % count;
    windowTop = rowsWindowTop(windowTop, selected, count, ROWS);
    states.push({ selected, windowTop });
  }
  return states;
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
      entry.id.startsWith("menu/") &&
      entry.id.endsWith(".sub") &&
      entry.status === "asserted" &&
      // Calculator's first screen is its application (plan 20), not a list.
      entry.id !== "menu/09-calculator.sub",
  );

  it("covers the ten asserted level-1 sequences", () => {
    expect(subs).toHaveLength(10);
  });

  for (const { id } of subs) {
    const golden = loadGolden(id);
    const number = Number(/menu\/(\d+)-/.exec(id)![1]);
    const submenu = menu.entries[number - 1]!.entry as SubmenuEntry;

    // Each image is one ▼ further from the first child.
    const states = walk(
      submenu.children.entries.length,
      0,
      golden.images.map(() => "down"),
    );
    golden.images.forEach((image, i) => {
      const { selected, windowTop } = states[i]!;
      it(`${id} "${image.name}"`, () => {
        const model = listModel(submenu, selected, windowTop);
        expectLcd(paint(model), { id, image }, `${submenu.label}, selected ${selected}`);
      });
    });
  }

  it("menu/01-phone-book.sub-up: ▲ keeps the window, then puts the selection on the top row and wraps (D3)", () => {
    const id = "menu/01-phone-book.sub-up";
    const golden = loadGolden(id);
    const phoneBook = menu.entries[0]!.entry as SubmenuEntry;
    const count = phoneBook.children.entries.length;
    // Item 6 was reached with ▼×5 from the entry; each image is one ▲ further.
    const states = walk(count, 0, [
      ...Array<"down">(5).fill("down"),
      ...golden.images.slice(1).map(() => "up" as const),
    ]).slice(5);
    golden.images.forEach((image, i) => {
      const { selected, windowTop } = states[i]!;
      expectLcd(
        paint(listModel(phoneBook, selected, windowTop)),
        { id, image },
        `Phone book, ▼×5, ▲×${i}: selected ${selected}, window ${windowTop}`,
      );
    });
  });

  it("draws a model without windowTop as entered (selection on the top row)", () => {
    const phoneBook = menu.entries[0]!.entry as SubmenuEntry;
    const { windowTop, ...entered } = listModel(phoneBook, 4, 4);
    expect(windowTop).toBe(4);
    expect(paint(entered).pixels).toEqual(paint(listModel(phoneBook, 4, 4)).pixels);
  });
});

describe("stock indicator while a shortcut digit is awaited (MenuIndicator.typed)", () => {
  /** Rows 0..6 at x 50..83 of `fb` against the golden image: the indicator's corner. */
  function expectIndicator(fb: Framebuffer, id: string, image: string): void {
    const corner = new Uint8Array(fb.pixels.length);
    const golden = goldenImage(id, image);
    const expected = new Uint8Array(golden.image.pixels.length);
    for (let y = 0; y < 7; y++) {
      for (let x = 50; x < 84; x++) {
        corner[y * 84 + x] = fb.pixels[y * 84 + x]!;
        expected[y * 84 + x] = golden.image.pixels[y * 84 + x]!;
      }
    }
    const message = lcdMismatch(
      corner,
      { id, image: { ...golden.image, pixels: expected } },
      "indicator corner",
    );
    if (message !== undefined) throw new Error(message);
  }

  it("draws the typed digits right-aligned before the dots (`1` and dots, P5 m1-2 d)", () => {
    const fb = new Framebuffer();
    paintIndicator(fb, { segments: [], awaitingNext: true, typed: "1" });
    expectIndicator(fb, "probe/shortcut-m1-2", "d");
  });

  it("draws the level's path and a dash for an empty typed number (`12-` and dots, P5 m1-2 i)", () => {
    const fb = new Framebuffer();
    paintIndicator(fb, { segments: [12], awaitingNext: true, typed: "" });
    expectIndicator(fb, "probe/shortcut-m1-2", "i");
  });

  it("adds no selection number to a list whose indicator is awaiting a digit", () => {
    const profiles = menu.entries[11]!.entry as SubmenuEntry;
    const model = {
      ...listModel(profiles, 0),
      menuIndicator: { segments: [12], awaitingNext: true, typed: "" },
    };
    expectLcd(paint(model), goldenImage("probe/shortcut-m1-2", "i"), "Profiles, `12-` and dots");
  });

  it("hides the carousel soft key while a typed entry is opening", () => {
    const carousel: ScreenModel = {
      kind: "menu-carousel",
      label: "Profiles",
      menuNumber: 12,
      total: 12,
      iconId: "profiles",
      menuIndicator: { segments: [12], awaitingNext: false },
    };
    const softkey = (fb: Framebuffer) => fb.pixels.slice(40 * 84);
    expect(softkey(paint(carousel)).some((p) => p === 1)).toBe(true);
    expect(softkey(paint({ ...carousel, opening: true })).every((p) => p === 0)).toBe(true);
  });

  it("hides the list soft key while a typed entry is opening", () => {
    const profiles = menu.entries[11]!.entry as SubmenuEntry;
    const shown = paint(listModel(profiles, 0));
    const opening = paint({ ...listModel(profiles, 0), opening: true });
    for (let y = 40; y < 48; y++)
      for (let x = 0; x < 84; x++) expect(opening.getPixel(x, y), `(${x}, ${y})`).toBe(0);
    expect(shown.pixels.slice(40 * 84).some((p) => p === 1)).toBe(true);
  });
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
