import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { TEXT_RUNS } from "../scripts/text-runs.ts";
import { paintIndicator } from "../src/display/indicator";
import { goldenImage } from "./support/goldens.ts";

/** The indicator band: rows 0..5 right of x 40 (nothing else is drawn there on menu screens). */
function band(pixels: Uint8Array): string[] {
  const rows: string[] = [];
  for (let y = 0; y <= 5; y++) {
    let row = "";
    for (let x = 40; x < 84; x++) row += pixels[y * 84 + x] === 1 ? "#" : ".";
    rows.push(row);
  }
  return rows;
}

describe("stock menu indicator", () => {
  // Every transcribed indicator in an asserted menu golden: `12` on the carousel, `7-6` on a page.
  const cases = Object.entries(TEXT_RUNS).flatMap(([id, images]) =>
    id.startsWith("menu/") && !id.endsWith("03-chat.sub") && !id.endsWith("09-calculator.sub")
      ? Object.entries(images).flatMap(([name, runs]) =>
          runs
            .filter((run) => run.font === "digits" && run.top === 0)
            .map((run) => ({ id, name, text: run.text })),
        )
      : [],
  );

  it("covers every carousel still and level-1 image", () => {
    // Carousel, then each level-1 sequence, then the Clock pages at 19:48 and 07:59.
    expect(cases.length).toBe(12 + 10 + 10 + 8 + 9 + 4 + 5 + 5 + 3 + 6 + 5 + 6 + 6);
  });

  for (const { id, name, text } of cases) {
    it(`${id} "${name}" shows ${text}`, () => {
      const fb = new Framebuffer();
      paintIndicator(fb, { segments: text.split("-").map(Number), awaitingNext: false });
      expect(band(fb.pixels)).toEqual(band(goldenImage(id, name).image.pixels));
    });
  }

  it("shows three dots while the first shortcut digit is awaited (menu/01-phone-book.anim c)", () => {
    const fb = new Framebuffer();
    paintIndicator(fb, { segments: [1], awaitingNext: true, awaitingFirst: true });
    expect(band(fb.pixels)).toEqual(band(goldenImage("menu/01-phone-book.anim", "c").image.pixels));
  });

  it("shows the level's own path and three dots while it is entering (Screen saver)", () => {
    for (const [id, segments] of [
      ["tree/05-tones/5-9.sub", [5, 9]],
      ["tree/12-profiles/12-1-2-9.sub", [12, 1, 2, 9]],
    ] as const) {
      const fb = new Framebuffer();
      paintIndicator(fb, { segments, awaitingNext: false, entering: true });
      expect(band(fb.pixels), id).toEqual(band(goldenImage(id, "01").image.pixels));
    }
  });
});
