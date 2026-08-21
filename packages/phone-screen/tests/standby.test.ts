import { describe, expect, it } from "vite-plus/test";
import { CLOCK_FONT } from "../src/font/clock";
import { FONT, textWidth } from "../src/font/font";
import { Framebuffer } from "../src/framebuffer";
import { SMS_ICON, VOICEMAIL_ICON } from "../src/icons/status";
import { renderStandby } from "../src/render/standby";
import { expectPixels, regionToArt } from "./helpers";

type StandbyScreen = Parameters<typeof renderStandby>[1];

function standby(overrides: Partial<StandbyScreen> = {}): StandbyScreen {
  return { kind: "standby", carrier: "LACHLAN", signal: 4, battery: 4, ...overrides };
}

describe("renderStandby", () => {
  it("places the carrier at y=8, centered in the body font", () => {
    const fb = new Framebuffer();
    renderStandby(fb, standby());
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "LACHLAN", 8);
    expect(regionToArt(fb, 5, 8, 74, 9)).toBe(regionToArt(expected, 5, 8, 74, 9));
  });

  it("places the normal-weight 5x6 clock 21:51 at x=46..75, y=0", () => {
    const fb = new Framebuffer();
    renderStandby(fb, standby({ clock: "21:51" }));
    const expected = new Framebuffer();
    expected.drawText(CLOCK_FONT, "21:51", 46, 0);
    expect(regionToArt(fb, 43, 0, 35, 6)).toBe(regionToArt(expected, 43, 0, 35, 6));
  });

  it("renders conditional notifications in voicemail-then-SMS order", () => {
    const fb = new Framebuffer();
    renderStandby(fb, standby({ indicators: { voicemail: true, message: true } }));
    const expected = new Framebuffer();
    expected.blitBitmap(VOICEMAIL_ICON, 7, 0);
    expected.blitBitmap(SMS_ICON, 18, 0);
    expect(regionToArt(fb, 7, 0, 19, 6)).toBe(regionToArt(expected, 7, 0, 19, 6));

    const none = new Framebuffer();
    renderStandby(none, standby());
    expect(regionToArt(none, 7, 0, 19, 6)).toBe(regionToArt(new Framebuffer(), 7, 0, 19, 6));
  });

  it("keeps all notification ink in the x=7..48 status area", () => {
    const fb = new Framebuffer();
    renderStandby(fb, standby({ indicators: { voicemail: true, message: true } }));
    expect(regionToArt(fb, 49, 0, 2, 6)).toBe(regionToArt(new Framebuffer(), 49, 0, 2, 6));
  });

  it("draws signal and battery stacks at configured levels", () => {
    const fb = new Framebuffer();
    renderStandby(fb, standby({ signal: 2, battery: 3 }));
    expect(fb.getPixel(0, 24)).toBe(1);
    expect(fb.getPixel(0, 16)).toBe(1);
    expect(fb.getPixel(0, 8)).toBe(0);
    expect(fb.getPixel(83, 8)).toBe(1);
    expect(fb.getPixel(83, 0)).toBe(0);
  });

  it("shows the single Menu softkey at y=41", () => {
    const fb = new Framebuffer();
    renderStandby(fb, standby());
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "Menu", 41);
    expect(regionToArt(fb, 0, 41, 84, 7)).toBe(regionToArt(expected, 0, 41, 84, 7));
  });

  it("a notice takes over carrier, clock, and notification content while preserving ladders", () => {
    const fb = new Framebuffer();
    renderStandby(
      fb,
      standby({
        clock: "21:51",
        indicators: { voicemail: true, message: true },
        notice: { text: "1 message received", softkey: "Read" },
      }),
    );
    expect(regionToArt(fb, 7, 0, 69, 15)).not.toContain("#");
    expect(fb.getPixel(0, 24)).toBe(1);
    expect(fb.getPixel(83, 24)).toBe(1);
    const expectedSoftkey = new Framebuffer();
    expectedSoftkey.drawTextCentered(FONT, "Read", 41);
    expect(regionToArt(fb, 0, 41, 84, 7)).toBe(regionToArt(expectedSoftkey, 0, 41, 84, 7));
  });

  it("truncates carrier by measured width between the side ladders", () => {
    const fb = new Framebuffer();
    renderStandby(fb, standby({ carrier: "WWWWWWWWWWWWWWWW" }));
    for (let x = 5; x <= 78; x++) {
      void fb.getPixel(x, 8);
    }
    expect(textWidth(FONT, "WWWWWWWW…")).toBeLessThanOrEqual(74);
    expectPixels(fb, 79, 32, "..#..\n#####\n#...#\n#...#\n#...#\n#####");
  });
});
