// The keyguard's screens (plan 25 Task 6) painted against every distinct image of the keyguard
// goldens they cover, through the stock widget painter (`paintWidget`).
import type { ScreenModel } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { paintWidget, type KeyguardModel } from "../src/display/widgets";
import { WIDGET_SPRITES, WIDGET_TIMELINE_BY_NAME, WIDGET_TIMELINES } from "../src/resources";
import { expectLcd } from "./support/golden.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";

type Standby = Extract<ScreenModel, { kind: "standby" }>;

/** The captures' standby: Orange F, 10:10, full signal and battery. */
const STANDBY: Standby = {
  kind: "standby",
  carrier: "Orange F",
  clock: "10:10",
  signal: 4,
  battery: 4,
};

function paint(model: KeyguardModel, previous?: Uint8Array): Framebuffer {
  const fb = new Framebuffer();
  paintWidget(fb, model, previous);
  return fb;
}

/** The frames of the named generated timeline, in step order. */
function framesOf(name: string) {
  const timeline = WIDGET_TIMELINES[WIDGET_TIMELINE_BY_NAME[name]!]!;
  return timeline.timeline.steps.map((step) => timeline.frames[step.frame]!);
}

/** The golden's images in timeline order from `from` (one per row). */
function imagesOf(id: string, from: number, count: number): string[] {
  return loadGolden(id)
    .timeline!.slice(from, from + count)
    .map((row) => row.image);
}

describe("plan 25's generated resources", () => {
  it("names the keyguard's timelines", () => {
    expect(Object.keys(WIDGET_TIMELINE_BY_NAME)).toEqual(
      expect.arrayContaining([
        "keyguard-emergency",
        "keyguard-hint",
        "keyguard-hint-scroll",
        "keyguard-now-press",
        "keypad-active",
        "keypad-locked",
      ]),
    );
  });
});

describe("the locked standby (K2)", () => {
  it("is standby with the key icon and Unlock (keyguard/standby)", () => {
    expectLcd(
      paint({ kind: "keyguard", screen: "locked-standby", standby: STANDBY }),
      goldenImage("keyguard/standby", "standby"),
      "locked standby",
    );
  });

  it("loses its ladders before the hint (keyguard/hint b)", () => {
    expectLcd(
      paint({ kind: "keyguard", screen: "locked-standby", standby: { ...STANDBY, leaving: true } }),
      goldenImage("keyguard/hint", "b"),
      "locked standby leaving",
    );
  });
});

describe("Keypad locked (K1)", () => {
  it("draws the note and each step of the crossed-out keypad, then the partial draw", () => {
    const frames = framesOf("keypad-locked");
    const images = imagesOf("keyguard/lock", 3, frames.length);
    let previous: Uint8Array | undefined;
    frames.forEach((frame, i) => {
      const fb = paint({ kind: "keyguard", screen: "lock-note", frame }, previous);
      expectLcd(fb, goldenImage("keyguard/lock", images[i]!), `step ${i}`);
      previous = fb.pixels;
    });
  });
});

describe("the hint (K3)", () => {
  it("draws Press Unlock and then * with each step of the keypad and finger", () => {
    const frames = framesOf("keyguard-hint");
    const images = imagesOf("keyguard/hint", 2, frames.length);
    let previous: Uint8Array | undefined;
    frames.forEach((frame, i) => {
      const fb = paint({ kind: "keyguard", screen: "hint", frame }, previous);
      expectLcd(fb, goldenImage("keyguard/hint", images[i]!), `step ${i}`);
      previous = fb.pixels;
    });
  });
});

describe("unlocking (K4, K5)", () => {
  it("shows Now press * in place of the operator and soft key (keyguard/unlock b)", () => {
    expectLcd(
      paint({ kind: "keyguard", screen: "now-press", standby: STANDBY }),
      goldenImage("keyguard/unlock", "b"),
      "now press",
    );
  });

  it("loses its ladders as the unlock starts (keyguard/unlock c)", () => {
    expectLcd(
      paint({ kind: "keyguard", screen: "now-press", standby: { ...STANDBY, leaving: true } }),
      goldenImage("keyguard/unlock", "c"),
      "now press leaving",
    );
  });

  it("draws Keypad active with Done's box and tick, then the partial draw", () => {
    const frames = framesOf("keypad-active");
    expect(frames.slice(0, 3)).toEqual(
      ["note/tick-box", "note/tick-half", "note/tick"].map((sprite) => ({
        kind: "sprite",
        sprite,
      })),
    );
    const images = imagesOf("keyguard/unlock", 3, frames.length);
    let previous: Uint8Array | undefined;
    frames.forEach((frame, i) => {
      const fb = paint({ kind: "keyguard", screen: "active-note", frame }, previous);
      expectLcd(fb, goldenImage("keyguard/unlock", images[i]!), `step ${i}`);
      previous = fb.pixels;
    });
  });
});

describe("the emergency display (K6)", () => {
  it("draws the number in the large face, right-aligned, with Call (keyguard/emergency/112 d)", () => {
    expectLcd(
      paint({ kind: "keyguard", screen: "emergency", standby: STANDBY, number: "112" }),
      goldenImage("keyguard/emergency/112", "d"),
      "112",
    );
  });

  it("throws for a number that does not fit (plan 13 D10)", () => {
    expect(() =>
      paint({ kind: "keyguard", screen: "emergency", standby: STANDBY, number: "1".repeat(20) }),
    ).toThrow(/does not fit/);
  });
});

describe("keyguard sprites", () => {
  it("crops the key icon at the top left, before the envelope", () => {
    const key = WIDGET_SPRITES["keyguard/key"]!;
    expect([key.x, key.y, key.bitmap.width, key.bitmap.height]).toEqual([7, 0, 13, 6]);
  });
});
