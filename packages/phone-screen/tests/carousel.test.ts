import { describe, expect, it } from "vite-plus/test";
import { FONT } from "../src/font/font";
import { Framebuffer } from "../src/framebuffer";
import { menuIcon } from "../src/icons/menu-icons";
import { renderCarousel } from "../src/render/carousel";
import { regionToArt } from "./helpers";

type CarouselScreen = Parameters<typeof renderCarousel>[1];

function carousel(overrides: Partial<CarouselScreen> = {}): CarouselScreen {
  return {
    kind: "menu-carousel",
    label: "Messages",
    menuNumber: 2,
    total: 13,
    iconId: "messages",
    menuIndicator: { segments: [2], awaitingNext: false },
    ...overrides,
  };
}

describe("renderCarousel", () => {
  it("draws the label and icon", () => {
    const fb = new Framebuffer();
    renderCarousel(fb, carousel());
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "Messages", 9);
    expected.blitBitmap(menuIcon("messages"), 34, 18);
    expect(regionToArt(fb, 0, 9, 80, 25)).toBe(regionToArt(expected, 0, 9, 80, 25));
  });

  it("uses the structured menu indicator instead of menuNumber text", () => {
    const fb = new Framebuffer();
    renderCarousel(fb, carousel({ menuIndicator: { segments: [5, 3], awaitingNext: true } }));
    expect(regionToArt(fb, 0, 0, 81, 9)).toContain("#");
    expect(fb.getPixel(82, 0)).toBe(0);
  });

  it("uses the x=82 position rail for first and last carousel items", () => {
    const first = new Framebuffer();
    const last = new Framebuffer();
    renderCarousel(first, carousel({ menuNumber: 1 }));
    renderCarousel(last, carousel({ menuNumber: 13 }));
    expect(first.getPixel(83, 8)).toBe(1);
    expect(first.getPixel(82, 8)).toBe(0);
    expect(last.getPixel(83, 33)).toBe(1);
    expect(last.getPixel(82, 33)).toBe(0);
    expect(first.getPixel(82, 20)).toBe(1);
  });

  it("shows the Select softkey", () => {
    const fb = new Framebuffer();
    renderCarousel(fb, carousel());
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "Select", 41);
    expect(regionToArt(fb, 0, 41, 84, 7)).toBe(regionToArt(expected, 0, 41, 84, 7));
  });
});
