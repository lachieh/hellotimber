import type { ScreenModel } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { paintStockScreen, stockMenu } from "../src/index";
import { STOCK_MENU_ICONS } from "../src/resources";
import { expectLcd, lcdMismatch, type GoldenImageRef } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";

type Carousel = Extract<ScreenModel, { kind: "menu-carousel" }>;

function paint(screen: ScreenModel): Framebuffer {
  const fb = new Framebuffer();
  fb.clear(1);
  paintStockScreen(fb, screen);
  return fb;
}

/** The literal carousel model for slot `index`, as the kernel emits it. */
function carousel(
  index: number,
  iconFrame: number,
  indicator?: Carousel["menuIndicator"],
): Carousel {
  const { entry, graphic } = stockMenu.entries[index]!;
  return {
    kind: "menu-carousel",
    label: entry.label,
    menuNumber: entry.order.value,
    total: stockMenu.entries.length,
    iconId: graphic.id,
    iconFrame,
    menuIndicator: indicator ?? { segments: [entry.order.value], awaitingNext: false },
  };
}

function diffCount(fb: Framebuffer, golden: GoldenImageRef): number {
  let count = 0;
  golden.image.pixels.forEach((pixel, i) => {
    if (pixel !== fb.pixels[i]) count++;
  });
  return count;
}

describe("stock carousel", () => {
  stockMenu.entries.forEach(({ entry, graphic }, index) => {
    const nn = String(entry.order.value).padStart(2, "0");
    const id = `menu/${nn}-${graphic.id}`;
    const golden = goldenImage(id, `${nn}-${graphic.id}`);

    it(`${id} matches exactly one icon frame`, () => {
      const frames = STOCK_MENU_ICONS[graphic.id]!.frames.map((_, frame) => frame);
      const matches = frames.filter(
        (frame) => lcdMismatch(paint(carousel(index, frame)).pixels, golden, id) === undefined,
      );
      if (matches.length !== 1) {
        // Report the closest frame's difference.
        const best = frames.reduce((a, b) =>
          diffCount(paint(carousel(index, a)), golden) <=
          diffCount(paint(carousel(index, b)), golden)
            ? a
            : b,
        );
        expectLcd(
          paint(carousel(index, best)),
          golden,
          `carousel ${entry.label}, iconFrame ${best}`,
        );
      }
      expect(matches).toHaveLength(1);
    });
  });

  it("paints the first-digit dots while awaiting the first shortcut digit (menu/01-phone-book.anim c)", () => {
    expectLcd(
      paint(carousel(0, 0, { segments: [1], awaitingNext: false, awaitingFirst: true })),
      goldenImage("menu/01-phone-book.anim", "c"),
      "carousel Phone book, awaitingFirst",
    );
  });

  it("shows the first icon frame for a graphic without a timeline frame", () => {
    const { iconFrame: _, ...still } = carousel(0, 0);
    expect(Array.from(paint(still).pixels)).toEqual(Array.from(paint(carousel(0, 0)).pixels));
  });

  it("rejects an unknown icon or frame", () => {
    expect(() => paint({ ...carousel(0, 0), iconId: "sim-services" })).toThrow(/sim-services/);
    expect(() => paint(carousel(0, 99))).toThrow(/frame 99/);
  });
});
