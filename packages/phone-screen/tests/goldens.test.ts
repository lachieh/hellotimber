import { describe, expect, it } from "vite-plus/test";
import { FALLBACK_ICON, MENU_ICONS } from "../src/icons/menu-icons";
import { HANDS_FRAMES } from "../src/icons/boot";
import {
  BATTERY_ICON,
  KEYGUARD_ICON,
  SIGNAL_ICON,
  SMS_ICON,
  VOICEMAIL_ICON,
} from "../src/icons/status";
import { CLOCK_FONT } from "../src/font/clock";
import { FONT } from "../src/font/font";
import { Framebuffer } from "../src/framebuffer";
import { renderList } from "../src/render/list";
import { renderStandby } from "../src/render/standby";
import { REFERENCE_MENU_LIST_FRAME, REFERENCE_STANDBY_FRAME } from "./fixtures/reference-frames";
import { expectFramebuffer } from "./helpers";

describe("pixel assets", () => {
  it("all font and sprite fixtures have integral dimensions and binary pixels", () => {
    const assets = [
      ...FONT.glyphs.values(),
      ...CLOCK_FONT.glyphs.values(),
      ...HANDS_FRAMES,
      ...MENU_ICONS.values(),
      FALLBACK_ICON,
      SIGNAL_ICON,
      BATTERY_ICON,
      VOICEMAIL_ICON,
      SMS_ICON,
      KEYGUARD_ICON,
    ];
    for (const asset of assets) {
      expect(Number.isInteger(asset.width)).toBe(true);
      expect(Number.isInteger(asset.height)).toBe(true);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      expect(asset.pixels).toHaveLength(asset.width * asset.height);
      expect([...asset.pixels].every((pixel) => pixel === 0 || pixel === 1)).toBe(true);
    }
  });
});

describe("literal reference frames", () => {
  it("pins all 4,032 standby pixels", () => {
    const fb = new Framebuffer();
    renderStandby(fb, {
      kind: "standby",
      carrier: "LACHLAN",
      clock: "21:51",
      signal: 4,
      battery: 4,
      indicators: { voicemail: true, message: true },
    });
    expectFramebuffer(fb, REFERENCE_STANDBY_FRAME);
  });

  it("pins all 4,032 Search / Add name / Erase menu pixels", () => {
    const fb = new Framebuffer();
    renderList(fb, {
      kind: "list",
      title: "Phone book",
      items: ["Search", "Add name", "Erase"],
      selected: 1,
      softkey: "Select",
      menuIndicator: { segments: [1, 3], awaitingNext: false },
    });
    expectFramebuffer(fb, REFERENCE_MENU_LIST_FRAME);
  });

  it("reports the first differing coordinate and a readable row diff", () => {
    const fb = new Framebuffer();
    renderStandby(fb, {
      kind: "standby",
      carrier: "LACHLAN",
      clock: "21:51",
      signal: 4,
      battery: 4,
      indicators: { voicemail: true, message: true },
    });
    const fixture = REFERENCE_STANDBY_FRAME.map((row) => row);
    fixture[2] = `${fixture[2]![0] === "#" ? "." : "#"}${fixture[2]!.slice(1)}`;
    expect(() => expectFramebuffer(fb, fixture)).toThrow(
      /framebuffer differs first at \(0,2\)[\s\S]*expected[\s\S]*actual[\s\S]*diff/,
    );
  });
});
