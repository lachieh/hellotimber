// Plan 15 Task 8: the security-code and welcome-note boot gates of the stock phone (D9, D10).
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { paintWidget, welcomeNoteLines } from "../src/display/widgets";
import { StockEeprom } from "../src/firmware/eeprom";
import { SECURITY_RECORD } from "../src/firmware/security";
import {
  GATE_BLANK_MS,
  GATED_WELCOME_END_MS,
  SELF_TEST_MS,
  WELCOME_BLANK_MS,
  WELCOME_NOTE_MS,
} from "../src/firmware/boot";
import { createMemoryStorage, createStockPhone, missingStockGlyphs } from "../src/index";
import { GATE_HANDS_TIMELINE } from "../src/resources";
import type { StockStorage } from "../src/index";
import { expectLcd } from "./support/golden.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";
import { seededStorage, stockRig, type Rig } from "./support/rig.ts";

/** Holds power until the phone turns on (the kernel's 800 ms long press). */
function powerOn(rig: Rig): void {
  rig.press("power", 1000);
}

/** At the power-on prompt: the self-test and the 42 ms blank have passed. */
function atPrompt(rig: Rig): void {
  powerOn(rig);
  rig.advance(SELF_TEST_MS + GATE_BLANK_MS);
}

function type(rig: Rig, keys: string): void {
  for (const key of keys) rig.press(key as "0");
}

const PROMPT = () => goldenImage("boot/security-gate-keys", "00-prompt");
const STANDBY = () => goldenImage("standby/standby", "01-standby");

function recentSims(storage: StockStorage): readonly string[] {
  return new StockEeprom(storage).read(SECURITY_RECORD).recentSims;
}

describe("boot timing constants", () => {
  it("holds the gates where boot/power-on's self-test ends", () => {
    const rows = loadGolden("boot/power-on").timeline!;
    expect(SELF_TEST_MS).toBe(rows[4]!.startMs - rows[0]!.startMs);
    expect(SELF_TEST_MS).toBe(4094);
  });

  it("plays the hands after the gate at boot/security-gate's steps", () => {
    const rows = loadGolden("boot/security-gate").timeline!;
    expect(GATE_HANDS_TIMELINE.steps.map((step) => step.durationMs)).toEqual(
      rows.slice(21).map((row) => row.durationMs),
    );
  });

  it("ends the gated welcome note 6357.9 ms after Code accepted appears, either note", () => {
    for (const id of ["boot/welcome-note", "boot/welcome-note-long"]) {
      const rows = loadGolden(id).timeline!;
      const last = rows[rows.length - 1]!;
      expect(
        Math.abs(last.startMs + last.durationMs - rows[11]!.startMs - GATED_WELCOME_END_MS),
      ).toBeLessThanOrEqual(1);
    }
    const ungated = loadGolden("boot/welcome-note-ungated").timeline!;
    expect([ungated[4]!.durationMs, ungated[5]!.durationMs]).toEqual([
      WELCOME_BLANK_MS,
      WELCOME_NOTE_MS,
    ]);
  });
});

describe("the security gate (D9, D10)", () => {
  it("asks for the code with Phone security On and a SIM never used, then goes to standby", () => {
    const storage = seededStorage();
    const rig = stockRig({ storage });
    atPrompt(rig);
    expectLcd(rig.paint(), PROMPT(), "the power-on prompt");
    expect(rig.phone.path).toBe("standby");
    type(rig, "12345");
    rig.press("navi");
    rig.advance(10_000);
    expectLcd(rig.paint(), STANDBY(), "after Code accepted and the hands");
    expect(recentSims(storage)).toEqual(["sim-1"]);
  });

  it("boots the same SIM without the prompt once it has passed", () => {
    const storage = seededStorage();
    const first = stockRig({ storage });
    atPrompt(first);
    type(first, "12345");
    first.press("navi");
    first.advance(10_000);
    const second = stockRig({ storage });
    atPrompt(second);
    expect(second.paint().pixels).not.toEqual(PROMPT().image.pixels);
    second.advance(10_000);
    expectLcd(second.paint(), STANDBY(), "the same SIM");
  });

  it("asks again for a new SIM, and a sixth SIM evicts the oldest", () => {
    const storage = seededStorage();
    for (const sim of ["a", "b", "c", "d", "e", "f"]) {
      const rig = stockRig({ storage, sim });
      atPrompt(rig);
      expectLcd(rig.paint(), PROMPT(), `SIM ${sim}`);
      type(rig, "12345");
      rig.press("navi");
      rig.advance(10_000);
    }
    expect(recentSims(storage)).toEqual(["f", "e", "d", "c", "b"]);
    const again = stockRig({ storage, sim: "a" });
    atPrompt(again);
    expectLcd(again.paint(), PROMPT(), "SIM a, evicted");
  });

  it("does not ask with Phone security Off, and records the SIM all the same", () => {
    const storage = seededStorage({ phoneSecurity: false });
    const rig = stockRig({ storage, sim: "sim-2" });
    powerOn(rig);
    rig.advance(12_000);
    expectLcd(rig.paint(), STANDBY(), "Phone security Off");
    expect(recentSims(storage)).toEqual(["sim-2"]);
  });

  it("keeps the prompt after a wrong code, and C on the empty entry does nothing", () => {
    const rig = stockRig({ storage: seededStorage() });
    atPrompt(rig);
    type(rig, "00000");
    rig.press("navi");
    rig.advance(3000);
    expectLcd(rig.paint(), PROMPT(), "after Code error");
    rig.press("c");
    rig.press("c", 1500);
    rig.advance(2000);
    expectLcd(rig.paint(), PROMPT(), "C on the empty entry, C held");
  });

  it("records a navigate() during the gate and applies it when the boot ends", () => {
    const rig = stockRig({ storage: seededStorage() });
    atPrompt(rig);
    rig.phone.navigate("menu/settings");
    rig.advance(100);
    expectLcd(rig.paint(), PROMPT(), "navigate waits");
    expect(rig.phone.path).toBe("standby");
    type(rig, "12345");
    rig.press("navi");
    rig.advance(10_000);
    expect(rig.phone.path).toBe("menu/settings");
  });

  it("powers off during the gate, and asks again at the next power-on", () => {
    const storage = seededStorage();
    const rig = stockRig({ storage });
    atPrompt(rig);
    type(rig, "12");
    rig.press("power", 1000);
    expect(rig.phone.screen.kind).toBe("off");
    expect(recentSims(storage)).toEqual([]);
    atPrompt(rig);
    expectLcd(rig.paint(), PROMPT(), "the next power-on");
  });

  it("still asks with boot: skip, at power-on, then goes straight to standby", () => {
    const rig = stockRig({ storage: seededStorage(), boot: "skip" });
    powerOn(rig);
    rig.advance(GATE_BLANK_MS);
    expectLcd(rig.paint(), PROMPT(), "boot skipped");
    type(rig, "12345");
    rig.press("navi");
    rig.advance(1600);
    expectLcd(rig.paint(), STANDBY(), "Code accepted, no hands");
  });

  it("needs a non-empty SIM", () => {
    expect(() => createStockPhone({ carrier: "Orange F", sim: "" })).toThrow(/SIM/);
  });
});

describe("the welcome note (W)", () => {
  it("lays the note out in the large face from x 1, wrapped at a space", () => {
    expect(welcomeNoteLines("Hi")).toEqual(["Hi"]);
    expect(welcomeNoteLines("Welcome to my phone")).toEqual(["Welcome to", "my phone"]);
    const fb = new Framebuffer();
    paintWidget(fb, { kind: "welcome-note", text: "Welcome to my phone" });
    expectLcd(fb, goldenImage("boot/welcome-note-long", "m"), "Welcome to my phone");
  });

  it("draws a note with characters the large face lacks without them, and never throws", () => {
    const note = "Hi €";
    expect(missingStockGlyphs(note, "large")).toEqual(["€"]);
    expect(welcomeNoteLines(note)).toEqual(["Hi"]);
    const rig = stockRig({ storage: seededStorage({ phoneSecurity: false, welcomeNote: note }) });
    powerOn(rig);
    rig.advance(SELF_TEST_MS + WELCOME_BLANK_MS + 10);
    expectLcd(rig.paint(), goldenImage("boot/welcome-note", "m"), "the note");
  });

  it("is skipped with boot: skip", () => {
    const storage = seededStorage({ phoneSecurity: false, welcomeNote: "Hi" });
    const rig = stockRig({ storage, boot: "skip" });
    powerOn(rig);
    expectLcd(rig.paint(), STANDBY(), "boot skipped");
  });

  it("plays the hands without a note", () => {
    const storage = createMemoryStorage();
    const rig = stockRig({ storage });
    powerOn(rig);
    rig.advance(SELF_TEST_MS + 200);
    expect(rig.phone.screen.kind).toBe("boot");
  });
});
