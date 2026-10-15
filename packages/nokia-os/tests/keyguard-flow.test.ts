// The keyguard over the kernel (plan 25 D4, Task 7): the stock phone routes a locked phone's keys
// to the keyguard and shows its screens, while the kernel stays at standby underneath.
import type { PhoneSnapshot } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { paintWidget } from "../src/display/widgets";
import {
  KEYGUARD_HINT_LEAD_MS,
  KEYGUARD_TIMES,
  KEYGUARD_UNLOCK_LEAD_MS,
} from "../src/firmware/features/keyguard";
import { createMemoryStorage } from "../src/index";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";
import { lockedRig } from "./support/keyguard.ts";
import { standbyRig } from "./support/rig.ts";

const LOCKED_STANDBY = goldenImage("keyguard/standby", "standby");

describe("locking", () => {
  it("shows Keypad locked at the * key-down, then the locked standby; the kernel stays at standby", () => {
    const rig = standbyRig();
    rig.press("navi");
    rig.advance(300);
    expect(rig.phone.screen.kind).toBe("menu-carousel");
    rig.press("*");
    expect(rig.phone.path).toBe("standby");
    expectLcd(rig.paint(), goldenImage("keyguard/lock", "d"), "Keypad locked");
    rig.advance(KEYGUARD_TIMES.lockNoteMs);
    expectLcd(rig.paint(), LOCKED_STANDBY, "the locked standby");
  });

  it("locks only from the carousel Menu opened at standby, within the window", () => {
    const cases: [string, (rig: ReturnType<typeof standbyRig>) => void][] = [
      ["▼ between", (rig) => rig.press("down")],
      ["after the window", (rig) => rig.advance(2700)],
      [
        "Read on a notice",
        (rig) => {
          rig.phone.setNotice({ text: "1 message received", softkey: "Read" });
          rig.advance(10);
        },
      ],
    ];
    for (const [name, between] of cases) {
      const rig = standbyRig();
      if (name === "Read on a notice") between(rig);
      rig.press("navi");
      rig.advance(300);
      if (name !== "Read on a notice") between(rig);
      rig.press("*");
      rig.advance(KEYGUARD_TIMES.lockNoteMs + 100);
      expect(rig.phone.screen.kind === "custom" && rig.phone.screen.appId, name).not.toBe(
        "keyguard",
      );
    }
  });
});

describe("the locked phone", () => {
  it("keeps the kernel at standby: its clock keeps updating in the locked standby", () => {
    let clock = "10:10";
    const rig = standbyRig({ clock: () => clock });
    rig.press("navi");
    rig.advance(300);
    rig.press("*");
    rig.advance(KEYGUARD_TIMES.lockNoteMs + 10);
    clock = "10:11";
    rig.advance(10);
    const standby = rig.phone.screen;
    const expected = new Framebuffer();
    paintWidget(expected, {
      kind: "keyguard",
      screen: "locked-standby",
      standby: { kind: "standby", carrier: "Orange F", clock: "10:11", signal: 4, battery: 4 },
    });
    expect(standby.kind).toBe("custom");
    expect(rig.paint().pixels).toEqual(expected.pixels);
  });

  it("never lets the kernel see its keys: a digit shows the hint and opens no number entry", () => {
    const rig = lockedRig();
    rig.press("5");
    rig.advance(KEYGUARD_HINT_LEAD_MS);
    expectLcd(rig.paint(), goldenImage("keyguard/hint", "c"), "the hint");
    rig.advance(KEYGUARD_TIMES.hintMs);
    expect(rig.phone.path).toBe("standby");
    expectLcd(rig.paint(), LOCKED_STANDBY, "back to the locked standby");
  });

  it("stays on through the power key held 10 s (keyguard/power-key-held)", () => {
    const rig = lockedRig();
    rig.press("power", 10_000);
    rig.advance(5_000);
    expect(rig.phone.screen.kind).toBe("custom");
    expectLcd(rig.paint(), LOCKED_STANDBY, "still locked, still on");
  });

  it("reports each of its frames to subscribers", () => {
    const rig = lockedRig();
    const seen: PhoneSnapshot[] = [];
    const unsubscribe = rig.phone.subscribe((snapshot) => seen.push(snapshot));
    rig.press("5");
    rig.advance(KEYGUARD_HINT_LEAD_MS + KEYGUARD_TIMES.hintMs);
    unsubscribe();
    // The lead, the hint's nine steps (its first image twice, then the partial draw) and the
    // locked standby.
    const frames = new Set(seen.map((s) => (s.screen.kind === "custom" ? s.screen.frame : s)));
    expect(frames.size).toBe(1 + 9 + 1);
    expect(seen.every((s) => s.path === "standby" && s.poweredOn)).toBe(true);
  });
});

describe("unlocking", () => {
  it("returns the kernel's own standby after Keypad active", () => {
    const rig = lockedRig();
    rig.press("navi");
    rig.advance(300);
    rig.press("*");
    rig.advance(KEYGUARD_UNLOCK_LEAD_MS + KEYGUARD_TIMES.activeNoteMs - 1);
    expect(rig.phone.screen.kind).toBe("custom");
    rig.advance(1);
    expect(rig.phone.screen.kind).toBe("standby");
    // Unlocked: Menu opens the carousel again.
    rig.press("navi");
    rig.advance(100);
    expect(rig.phone.screen.kind).toBe("menu-carousel");
  });

  it("is what a cold power-on gives: the keyguard lives in RAM (keyguard/power-cycle)", () => {
    const storage = createMemoryStorage();
    const locked = standbyRig({ storage });
    locked.press("navi");
    locked.advance(300);
    locked.press("*");
    locked.advance(KEYGUARD_TIMES.lockNoteMs);
    const cold = standbyRig({ storage });
    expectLcd(cold.paint(), goldenImage("keyguard/power-cycle", "standby"), "cold power-on");
  });
});
