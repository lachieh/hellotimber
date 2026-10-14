import type { ScreenModel } from "@hellotimber/phone-core";
import { bitmapFromArt, Framebuffer, textWidth } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { paintStockScreen } from "../src/index";
import { STOCK_FONTS } from "../src/resources";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";

type Standby = Extract<ScreenModel, { kind: "standby" }>;

const STANDBY: Standby = {
  kind: "standby",
  carrier: "Orange F",
  clock: "10:10",
  signal: 4,
  battery: 4,
};

function paint(screen: ScreenModel, fb = new Framebuffer()): Framebuffer {
  paintStockScreen(fb, screen);
  return fb;
}

/** Lit pixels in column x over rows y0..y1. */
function litRows(fb: Framebuffer, x: number, y0: number, y1: number): number[] {
  const rows: number[] = [];
  for (let y = y0; y <= y1; y++) if (fb.getPixel(x, y) === 1) rows.push(y);
  return rows;
}

describe("stock standby", () => {
  it("matches standby/standby (Orange F, 10:10, full signal and battery)", () => {
    expectLcd(
      paint(STANDBY),
      goldenImage("standby/standby", "01-standby"),
      "standby literal model",
    );
  });

  it("erases the ladders and icons while leaving for the menu (menu/01-phone-book.anim b)", () => {
    expectLcd(
      paint({ ...STANDBY, leaving: true }),
      goldenImage("menu/01-phone-book.anim", "b"),
      "standby, leaving: true",
    );
  });

  it("clears the previous frame before painting", () => {
    const fb = new Framebuffer();
    fb.clear(1);
    expectLcd(paint(STANDBY, fb), goldenImage("standby/standby", "01-standby"), "over a lit frame");
  });

  it("omits the clock when the host has none", () => {
    const fb = paint({ ...STANDBY, clock: undefined });
    for (let x = 40; x < 80; x++) expect(litRows(fb, x, 0, 5), `x ${x}`).toEqual([]);
  });

  // UNVERIFIED: the kernel always reports 4; lower levels drop bars from the top.
  it("drops signal and battery bars from the top for levels 0-3", () => {
    const signalRows = [
      [0, 6],
      [8, 14],
      [16, 22],
      [24, 29],
    ];
    for (const level of [0, 1, 2, 3, 4] as const) {
      const fb = paint({ ...STANDBY, signal: level, battery: level });
      const expected = signalRows
        .slice(4 - level)
        .flatMap(([a, b]) => Array.from({ length: b! - a! + 1 }, (_, i) => a! + i));
      expect(litRows(fb, 1, 0, 29), `signal ${level}`).toEqual(expected);
      expect(litRows(fb, 82, 0, 29), `battery ${level}`).toEqual(expected);
      // The antenna and battery icons stay.
      expect(fb.getPixel(0, 31), `antenna ${level}`).toBe(1);
      expect(fb.getPixel(81, 31), `battery icon ${level}`).toBe(1);
    }
  });

  it("centres the operator line and right-aligns the clock", () => {
    const fb = paint({ ...STANDBY, carrier: "Telstra", clock: "23:59" });
    const carrierX = Math.floor((84 - textWidth(STOCK_FONTS.small, "Telstra")) / 2);
    const expected = new Framebuffer();
    expected.drawText(STOCK_FONTS.small, "Telstra", carrierX, 8);
    expected.drawText(STOCK_FONTS.digits, "23:59", 78 - textWidth(STOCK_FONTS.digits, "23:59"), 0);
    for (let y = 0; y < 16; y++) {
      for (let x = 5; x < 79; x++)
        expect(fb.getPixel(x, y), `(${x}, ${y})`).toBe(expected.getPixel(x, y));
    }
  });
});

describe("custom and unsupported screens", () => {
  it("blits a custom frame verbatim", () => {
    const art = Array.from({ length: 48 }, (_, y) =>
      Array.from({ length: 84 }, (_, x) => ((x * 7 + y * 3) % 5 === 0 ? "#" : ".")).join(""),
    );
    const frame = bitmapFromArt(art);
    const fb = new Framebuffer();
    fb.clear(1);
    paint({ kind: "custom", appId: "test", frame }, fb);
    expect(Array.from(fb.pixels)).toEqual(Array.from(frame.pixels));
  });

  const unsupported: ScreenModel[] = [
    { kind: "reader", title: "T", lines: ["a"], scrollTop: 0 },
    { kind: "editor", title: "T", text: "", cursor: 0, mode: "Abc" },
    { kind: "confirm", text: "Done", softkey: "OK" },
  ];

  for (const screen of unsupported) {
    it(`marks ${screen.kind} as unsupported: a dotted border and the kind name`, () => {
      const fb = paint(screen);
      // A 1-pixel dotted border, lit where x + y is even.
      for (let x = 0; x < 84; x++) {
        expect(fb.getPixel(x, 0), `top ${x}`).toBe(x % 2 === 0 ? 1 : 0);
        expect(fb.getPixel(x, 47), `bottom ${x}`).toBe((x + 47) % 2 === 0 ? 1 : 0);
      }
      for (let y = 0; y < 48; y++) {
        expect(fb.getPixel(0, y), `left ${y}`).toBe(y % 2 === 0 ? 1 : 0);
        expect(fb.getPixel(83, y), `right ${y}`).toBe((83 + y) % 2 === 0 ? 1 : 0);
      }
      const name = new Framebuffer();
      name.drawTextCentered(STOCK_FONTS.small, screen.kind, 20);
      for (let y = 1; y < 47; y++) {
        for (let x = 1; x < 83; x++)
          expect(fb.getPixel(x, y), `(${x}, ${y})`).toBe(name.getPixel(x, y));
      }
    });
  }
});
