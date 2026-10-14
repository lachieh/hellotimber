// Plan 20 Task 6: the calculator's widgets as a stock flow (D4, D5, D7, D8) and node 9 on the
// stock phone. Pixels come from the calculator painter (its goldens: tests/calculator-paint).
import type { PhoneKey } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { CalculatorRate } from "../src/calculator/rate";
import { paintWidget, type WidgetModel } from "../src/display/widgets";
import { createMemoryStorage, StockEeprom } from "../src/firmware/eeprom";
import { timelineById, timelineByName } from "../src/firmware/timelines";
import { CALCULATOR_HOLD_MS, calculator, type CalculatorServices } from "../src/widgets/calculator";
import { flowRig, type FlowRig } from "./support/flow-rig.ts";
import { play } from "./support/calculator.ts";
import { standbyRig } from "./support/rig.ts";

function services(eeprom = new StockEeprom(createMemoryStorage())): CalculatorServices & {
  readonly tones: string[];
} {
  const tones: string[] = [];
  return {
    rate: new CalculatorRate(eeprom),
    noteSound: (lines) => tones.push(lines.join(" ")),
    notes: {
      "out-of-range": timelineByName("calculator-out-of-range"),
      "divide-by-zero": timelineByName("calculator-divide-by-zero"),
      "rate-saved": timelineByName("calculator-rate-saved"),
    },
    blink: timelineById("2-9", "test"),
    tones,
  };
}

function pixels(model: WidgetModel): Uint8Array {
  const fb = new Framebuffer();
  paintWidget(fb, model);
  return fb.pixels;
}

const display = (...lines: string[]): Uint8Array =>
  pixels({ kind: "calculator", screen: "display", lines, softkey: "Options" });

function same(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** A flow rig whose keys can be held: down, `holdMs` of ticks, up. */
function rig(own = services()): FlowRig & {
  hold(key: PhoneKey, holdMs: number): void;
  keys(text: string): void;
  shows(...lines: string[]): boolean;
} {
  const base = flowRig(() => calculator(own), { segments: [9], awaitingNext: false });
  return Object.assign(base, {
    hold(key: PhoneKey, holdMs: number) {
      base.session.onKey({ type: "down", key });
      base.advance(holdMs);
      base.session.onKey({ type: "up", key });
    },
    keys(text: string) {
      for (const key of text.split("")) {
        base.press(
          (key === "O" ? "navi" : key === "C" ? "c" : key === "v" ? "down" : key) as PhoneKey,
        );
        base.advance(10);
      }
    },
    shows: (...lines: string[]) => same(base.frame(), display(...lines)),
  });
}

describe("calculator screen (D8)", () => {
  it("shows the engine's lines over Options", () => {
    const r = rig();
    expect(r.shows("0")).toBe(true);
    r.keys("12*3");
    expect(r.shows("12", "+", "3")).toBe(true);
  });

  it("acts as a key goes down, once, however long it is held", () => {
    const r = rig();
    r.session.onKey({ type: "down", key: "7" });
    expect(r.shows("7")).toBe(true);
    r.advance(1200);
    r.session.onKey({ type: "up", key: "7" });
    expect(r.shows("7")).toBe(true);
    r.hold("*", 1200);
    expect(r.shows("7", "+")).toBe(true);
    r.hold("#", 1200);
    expect(r.shows("7", "+", "0.")).toBe(true);
  });

  it("deletes as C goes down and clears it all once held CALCULATOR_HOLD_MS", () => {
    const r = rig();
    r.keys("567");
    r.session.onKey({ type: "down", key: "c" });
    expect(r.shows("56")).toBe(true);
    r.advance(CALCULATOR_HOLD_MS - 1);
    expect(r.shows("56")).toBe(true);
    r.advance(1);
    expect(r.shows("0")).toBe(true);
    r.advance(1000);
    r.session.onKey({ type: "up", key: "c" });
    expect(r.exits).toEqual([]);
  });

  it("clears 532-544 ms after C goes down in the capture: 471-478 ms after its deletion", () => {
    // `calculator/clear-held`: the deletion redraws 61 and 66 ms after C goes down, the clear
    // 532.1 and 544.0 ms after; keys act at their down here, so the clear follows the deletion
    // by the captured gap within PROBE_TOLERANCE_MS.
    for (const gap of [532.1 - 61, 544.0 - 66]) {
      expect(Math.abs(CALCULATOR_HOLD_MS - gap)).toBeLessThan(25);
    }
  });

  it("leaves on C with nothing typed, at its down", () => {
    const r = rig();
    r.session.onKey({ type: "down", key: "c" });
    expect(r.exits).toHaveLength(1);
  });

  it("does nothing on ▲/▼", () => {
    const r = rig();
    r.keys("12");
    r.press("up");
    r.press("down");
    expect(r.shows("12")).toBe(true);
  });
});

describe("Options (D4, D5)", () => {
  const options = (r: FlowRig): Uint8Array => r.frame();
  const list = (items: string[], selected: number, windowTop = 0): Uint8Array =>
    pixels({
      kind: "options",
      items,
      selected,
      windowTop,
      indicator: { segments: [selected + 1], awaitingNext: false },
      softkey: "OK",
    });
  const EIGHT = [
    "Equals",
    "Add",
    "Subtract",
    "Multiply",
    "Divide",
    "In domestic",
    "In foreign",
    "Exchange rate",
  ];

  it("opens on its first entry, numbered by position (not the kernel's 9)", () => {
    const r = rig();
    r.keys("12O");
    expect(same(options(r), list(EIGHT, 0))).toBe(true);
    r.keys("v");
    expect(same(options(r), list(EIGHT, 1))).toBe(true);
    const op = rig();
    op.keys("12**O");
    expect(same(options(op), list(["Add", "Subtract", "Multiply", "Divide"], 0))).toBe(true);
  });

  it("runs a choice and returns to the calculator; C returns unchanged", () => {
    const r = rig();
    r.keys("12*3OO");
    expect(r.shows("15")).toBe(true);
    r.keys("OC");
    expect(r.shows("15")).toBe(true);
    r.keys("OvvvO");
    expect(r.shows("15", "*")).toBe(true);
  });

  it("replaces itself with a note, then shows the state before the choice", () => {
    const own = services();
    const r = rig(own);
    r.keys("7****0O");
    r.press("navi");
    expect(r.shows("7", "/", "0")).toBe(false);
    expect(own.tones).toEqual(["Dividing by zero not allowed"]);
    r.advance(3000);
    expect(r.shows("7", "/", "0")).toBe(true);
  });

  it("acts on OK as it goes down, and the release does nothing more", () => {
    const r = rig();
    r.keys("12O");
    r.session.onKey({ type: "down", key: "navi" });
    expect(r.shows("12")).toBe(true);
    r.session.onKey({ type: "up", key: "navi" });
    expect(r.shows("12")).toBe(true);
  });
});

describe("notes (Task 0 N)", () => {
  const noted = (): ReturnType<typeof rig> => {
    const r = rig();
    r.keys("7****0O");
    r.press("navi");
    r.advance(500);
    return r;
  };

  it("a digit dismisses the note and edits the restored operand", () => {
    const r = noted();
    r.press("5");
    expect(r.shows("7", "/", "5")).toBe(true);
  });

  it("▼ and C dismiss it unchanged", () => {
    for (const key of ["down", "c"] as const) {
      const r = noted();
      r.press(key);
      expect(r.shows("7", "/", "0")).toBe(true);
      expect(r.exits).toEqual([]);
    }
  });

  it("C held on goes to standby", () => {
    const r = noted();
    r.hold("c", 1500);
    expect(r.exits).toEqual([{ atMs: r.now, options: { to: "standby" } }]);
  });
});

describe("exchange rate (D6, D7)", () => {
  it("opens pages 8-1 and 8-2 from Options, rooted at Exchange rate", () => {
    const r = rig();
    r.keys("O");
    for (let i = 0; i < 7; i++) r.press("down");
    r.press("navi");
    const page = pixels({
      kind: "info-page",
      label: "Foreign unit\nexpressed in\ndomestic units",
      index: 0,
      count: 2,
      indicator: { segments: [8, 1], awaitingNext: false },
      softkey: "OK",
    });
    expect(same(r.frame(), page)).toBe(true);
    r.press("c");
    r.press("c");
    expect(r.shows("0")).toBe(true);
  });

  it("stores the typed rate and returns past the pages to the calculator", () => {
    const eeprom = new StockEeprom(createMemoryStorage());
    const own = services(eeprom);
    const r = rig(own);
    r.keys("O");
    for (let i = 0; i < 7; i++) r.press("down");
    r.press("navi");
    r.press("navi");
    r.advance(500);
    r.keys("1#5");
    r.press("navi");
    expect(own.rate.shown("foreign")).toBe("1.5");
    r.advance(1500);
    expect(r.shows("0")).toBe(true);
    // 10 In domestic: 15.
    r.keys("10O");
    for (let i = 0; i < 5; i++) r.press("down");
    r.press("navi");
    expect(r.shows("15")).toBe(true);
  });

  it("returns to the pages on C with the field empty", () => {
    const r = rig();
    r.keys("O");
    r.press("up");
    r.press("navi");
    r.press("navi");
    r.press("c"); // virgin 0: deleted
    r.press("c"); // empty: back to 8-1
    r.press("c"); // Options
    r.press("c"); // the calculator
    expect(r.shows("0")).toBe(true);
  });
});

describe("node 9 on the stock phone", () => {
  it("opens the calculator, keeps the rate in the phone's storage, starts at 0 each time", () => {
    const storage = createMemoryStorage();
    const phone = standbyRig({ storage });
    play(phone, "menu +300 up up up up +2000 menu +1500 1 2");
    expect(phone.phone.path).toBe("menu/calculator");
    play(phone, "menu up menu menu +500 1 # 5 menu +3500");
    expect(storage.getItem("nokia-os/calculator")).toBe(
      '{"direction":"foreign","rate":"1.5","version":1}',
    );
    play(phone, "c c c +1000 c +1000 menu +300 up up up up +2000 menu +1500");
    expect(phone.phone.path).toBe("menu/calculator");
    expect(same(phone.paint().pixels, display("0"))).toBe(true);
  });
});
