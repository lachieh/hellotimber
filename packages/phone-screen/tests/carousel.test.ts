import { describe, expect, it } from "vite-plus/test";
import type { ScreenModel } from "@hellotimber/phone-core";
import { FONT } from "../src/font/font";
import { Framebuffer } from "../src/framebuffer";
import { menuIcon } from "../src/icons/menu-icons";
import { renderCarousel } from "../src/render/carousel";
import { drawTextRight } from "../src/render/layout";
import { regionToArt } from "./helpers";

type CarouselScreen = Extract<ScreenModel, { kind: "menu-carousel" }>;

function carousel(overrides: Partial<CarouselScreen> = {}): CarouselScreen {
  return {
    kind: "menu-carousel",
    label: "Messages",
    menuNumber: 2,
    total: 13,
    iconId: "messages",
    ...overrides,
  };
}

describe("renderCarousel", () => {
  it("draws the label centered below the status row", () => {
    const fb = new Framebuffer();
    renderCarousel(fb, carousel());
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "Messages", 9);
    expect(regionToArt(fb, 0, 9, 80, 7)).toBe(regionToArt(expected, 0, 9, 80, 7));
  });

  it("draws the shortcut number top-right", () => {
    const fb = new Framebuffer();
    renderCarousel(fb, carousel({ menuNumber: 13 }));
    const expected = new Framebuffer();
    drawTextRight(expected, "13", 83, 0);
    expect(regionToArt(fb, 60, 0, 24, 7)).toBe(regionToArt(expected, 60, 0, 24, 7));
  });

  it("blits the menu icon centered in the content area", () => {
    const fb = new Framebuffer();
    renderCarousel(fb, carousel());
    const expected = new Framebuffer();
    expected.blitBitmap(menuIcon("messages"), 34, 18);
    expect(regionToArt(fb, 34, 18, 16, 16)).toBe(regionToArt(expected, 34, 18, 16, 16));
  });

  it("falls back to the ?-box icon for unknown iconIds", () => {
    const fb = new Framebuffer();
    renderCarousel(fb, carousel({ iconId: "nope" }));
    const expected = new Framebuffer();
    expected.blitBitmap(menuIcon("nope"), 34, 18);
    expect(regionToArt(fb, 34, 18, 16, 16)).toBe(regionToArt(expected, 34, 18, 16, 16));
  });

  it("positions the right-edge scroll thumb by menu number", () => {
    const first = new Framebuffer();
    const last = new Framebuffer();
    renderCarousel(first, carousel({ menuNumber: 1 }));
    renderCarousel(last, carousel({ menuNumber: 13 }));
    expect(first.getPixel(81, 8)).toBe(1); // thumb at the top for menu 1
    expect(first.getPixel(81, 36)).toBe(0);
    expect(last.getPixel(81, 36)).toBe(1); // thumb at the bottom for menu 13
    expect(last.getPixel(81, 8)).toBe(0);
    expect(first.getPixel(83, 20)).toBe(1); // the track line spans the content area
  });

  it("shows the Select softkey", () => {
    const fb = new Framebuffer();
    renderCarousel(fb, carousel());
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "Select", 41);
    expect(regionToArt(fb, 0, 41, 84, 7)).toBe(regionToArt(expected, 0, 41, 84, 7));
  });
});
