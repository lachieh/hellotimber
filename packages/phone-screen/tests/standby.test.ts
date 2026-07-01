import { describe, expect, it } from "vite-plus/test";
import type { ScreenModel } from "@hellotimber/phone-core";
import { FONT, textWidth } from "../src/font/font";
import { Framebuffer } from "../src/framebuffer";
import { drawBatteryLevel, drawSignalLevel, ENVELOPE_ICON } from "../src/icons/status";
import { renderStandby } from "../src/render/standby";
import { regionToArt } from "./helpers";

type StandbyScreen = Extract<ScreenModel, { kind: "standby" }>;

function standby(overrides: Partial<StandbyScreen> = {}): StandbyScreen {
  return { kind: "standby", carrier: "LACHLAN", signal: 4, battery: 4, ...overrides };
}

describe("renderStandby", () => {
  it("draws the carrier name centered at 2x scale", () => {
    const fb = new Framebuffer();
    renderStandby(fb, standby());
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "LACHLAN", 10, { scale: 2 });
    // carrier rows only (2x glyphs: y 10–23), away from the edge bars (x 5–78)
    expect(regionToArt(fb, 5, 10, 74, 14)).toBe(regionToArt(expected, 5, 10, 74, 14));
  });

  it("truncates over-long carrier names to 7 chars at 2x", () => {
    const fb = new Framebuffer();
    renderStandby(fb, standby({ carrier: "INTERNATIONAL" }));
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "INTERN…", 10, { scale: 2 });
    // Compare the bar-free carrier region (x 5–78) like the 2x-scale test above:
    // level-4 signal/battery rungs occupy x 0–2 / 81–83 and overlap a full-width region.
    expect(regionToArt(fb, 5, 10, 74, 14)).toBe(regionToArt(expected, 5, 10, 74, 14));
  });

  it("draws signal and battery stacks at the configured levels", () => {
    const fb = new Framebuffer();
    renderStandby(fb, standby({ signal: 2, battery: 3 }));
    expect(fb.getPixel(0, 27)).toBe(1); // signal rung 0
    expect(fb.getPixel(0, 22)).toBe(1); // signal rung 1
    expect(fb.getPixel(0, 17)).toBe(0); // signal rung 2 absent
    // Probe at x 83 (the rung spans x 81–83): the 2x carrier text reaches x 82,
    // so x 81 collides with the carrier's last glyph. x 83 is carrier-free.
    expect(fb.getPixel(83, 17)).toBe(1); // battery rung 2
    expect(fb.getPixel(83, 12)).toBe(0); // battery rung 3 absent
  });

  it("shows the single softkey label 'Menu' bottom-center", () => {
    const fb = new Framebuffer();
    renderStandby(fb, standby());
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "Menu", 41);
    expect(regionToArt(fb, 0, 41, 84, 7)).toBe(regionToArt(expected, 0, 41, 84, 7));
  });

  it("a notice takes over the content area: envelope + text + its softkey", () => {
    const fb = new Framebuffer();
    renderStandby(fb, standby({ notice: { text: "1 message received", softkey: "Read" } }));
    const expected = new Framebuffer();
    drawSignalLevel(expected, 4);
    drawBatteryLevel(expected, 4);
    expected.blitBitmap(ENVELOPE_ICON, 4, 20); // icon centered on the text block
    expected.drawText(FONT, "1 message", 14, 16); // wrapped at 11 chars, 2 lines
    expected.drawText(FONT, "received", 14, 24);
    expected.drawTextCentered(FONT, "Read", 41); // notice softkey replaces Menu
    // Full-frame equality: also proves carrier and clock make way for the notice.
    expect(regionToArt(fb, 0, 0, 84, 48)).toBe(regionToArt(expected, 0, 0, 84, 48));
  });

  it("a noticed standby suppresses the clock and keeps the status bars", () => {
    const fb = new Framebuffer();
    renderStandby(
      fb,
      standby({ clock: "12:34", notice: { text: "1 message received", softkey: "Read" } }),
    );
    expect(regionToArt(fb, 40, 32, 40, 7)).toBe(regionToArt(new Framebuffer(), 40, 32, 40, 7));
    expect(fb.getPixel(0, 27)).toBe(1); // signal rung 0 still drawn
    expect(fb.getPixel(83, 27)).toBe(1); // battery rung 0 still drawn
  });

  it("draws the clock lower-right only when present", () => {
    const withClock = new Framebuffer();
    renderStandby(withClock, standby({ clock: "12:34" }));
    const expected = new Framebuffer();
    expected.drawText(FONT, "12:34", 79 - textWidth(FONT, "12:34") + 1, 32);
    expect(regionToArt(withClock, 40, 32, 44, 7)).toBe(regionToArt(expected, 40, 32, 44, 7));

    const without = new Framebuffer();
    renderStandby(without, standby());
    expect(regionToArt(without, 40, 32, 40, 7)).toBe(regionToArt(new Framebuffer(), 40, 32, 40, 7));
  });
});
