// Plan 18b Task 7: the T9 editor's Options, Matches, the Insert word and Spell prompts, user
// words, the Dictionary list and the virgin T9 default, on a stock phone. The goldens of the
// scenarios that leave the editor are driven from their notes (tests/support/t9.ts) with the
// shipped English dictionary; the rest are behaviours the goldens do not show.
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { readPlanIndex } from "../scripts/golden-index.ts";
import { DICTIONARY_KEY } from "../src/messages/bindings";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import { createMemoryStorage } from "../src/index";
import { englishT9 } from "../src/text/t9/english";
import { T9_USER_RECORD } from "../src/text/t9/user";
import { GOLDENS } from "./support/acceptance.ts";
import { paintWidget } from "../src/display/widgets";
import { emptyText, type TextState } from "../src/text/multitap";
import type { T9Display } from "../src/text/t9";
import { editorModel } from "../src/widgets/editor";
import { expectLcd } from "./support/golden.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";
import { keys } from "./support/probes.ts";
import { expectLcdAnyBlink } from "./support/replay.ts";
import { standbyRig, type Rig } from "./support/rig.ts";
import {
  expectT9Still,
  expectT9Timeline,
  parseT9Note,
  playT9,
  t9PhoneTarget,
  T9_KNOWN_GAPS,
  T9_TOLERANCES,
  type T9Recording,
} from "./support/t9.ts";

/** The scenarios beyond the editor: Options, prompts, the Dictionary, the page, persistence. */
const PHONE_SCENARIOS = [
  "first",
  "options-empty",
  "g-options",
  "g-matches",
  "g-matches-single",
  "g-spell",
  "g-insert-word",
  "g-userwords-two",
  "insert-word-empty",
  "dictionary-list",
  "dictionary-off-on",
  "g-persist-dict",
];

const IDS = readPlanIndex(GOLDENS, "18b")
  .map((entry) => entry.id)
  .filter((id) => PHONE_SCENARIOS.includes(id.split("/")[1]!) || id === "t9/g-delete/06-c5");

/** Plays golden `id`'s note on a stock phone with the English dictionary and compares it. */
export function t9PhoneScenario(id: string): void {
  const golden = loadGolden(id);
  const { base, steps } = parseT9Note(golden.note ?? "");
  const target = t9PhoneTarget(base);
  let recording: T9Recording | undefined;
  let keyed = false;
  playT9(target, steps, (recorded, step) => {
    recording = recorded;
    keyed = step.kind === "record" && step.key !== undefined;
  });
  const context = `${id}: ${golden.note}`;
  if (golden.timeline === undefined) expectT9Still(target, golden, context);
  else expectT9Timeline(recording!, golden, context, { keyed, toleranceMs: T9_TOLERANCES[id] });
}

describe("the T9 phone against its goldens", () => {
  for (const id of IDS) {
    const gap = T9_KNOWN_GAPS[id];
    (gap === undefined ? it : it.fails)(gap === undefined ? id : `${id} (known gap)`, () =>
      t9PhoneScenario(id),
    );
  }
});

const T9 = { t9: { english: englishT9 } } as const;
/** Menu, ▼ to Messages, Select (Write messages), Select. */
const WRITE = "navi wait:300 down navi wait:500 navi wait:500";
const SMS = { counter: "sms", limit: 459, layout: "sms", softkey: "Options" } as const;

/** The T9 editor holding `text` (the cursor at its end; `composing`: its last word composes). */
function t9Editor(text: string, composing?: T9Display): (cursor: boolean) => Uint8Array {
  const state: TextState = { ...emptyText("abc"), text, cursor: text.length };
  return (cursor) => {
    const fb = new Framebuffer();
    paintWidget(fb, editorModel(state, SMS, 0, cursor, { composing }).model);
    return fb.pixels;
  };
}

/** The screen is one of `frames` (either cursor phase). */
function expectEither(rig: Rig, frame: (cursor: boolean) => Uint8Array, context: string): void {
  const pixels = rig.paint().pixels;
  const same = (other: Uint8Array) => other.every((value, i) => value === pixels[i]);
  expect(same(frame(true)) || same(frame(false)), context).toBe(true);
}

function placeholderScreen(label: string): Uint8Array {
  const fb = new Framebuffer();
  paintWidget(fb, { kind: "placeholder", label });
  return fb.pixels;
}

describe("the virgin default (D5, D6)", () => {
  it("writes in T9 English with a dictionary", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage, ...T9 });
    keys(rig, WRITE);
    expectLcdAnyBlink(rig.paint(), goldenImage("t9/first/02-editor", "02-editor"), "T9 editor");
    expect(createStockSettings(new StockEeprom(storage)).choice(DICTIONARY_KEY)).toBe(1);
  });

  it("writes in multi-tap without one; English is then the host's placeholder", () => {
    const rig = standbyRig({ t9: {} });
    keys(rig, WRITE);
    expectLcdAnyBlink(rig.paint(), goldenImage("text/editor", "editor-multitap"), "multi-tap");
    keys(rig, "navi wait:500 down*4 navi wait:500");
    expectLcd(rig.paint(), goldenImage("text/editor", "dictionary-list-off"), "Dictionary off");
    keys(rig, "down navi wait:300");
    expect(rig.paint().pixels).toEqual(placeholderScreen("English"));
  });

  it("leaves Русский and Български to plan 26's placeholders", () => {
    const rig = standbyRig(T9);
    keys(rig, `${WRITE} navi wait:500 down*7 navi wait:500 down navi wait:300`);
    expect(rig.paint().pixels).toEqual(placeholderScreen("Русский"));
    keys(rig, "c wait:300 down navi wait:300");
    expect(rig.paint().pixels).toEqual(placeholderScreen("Български"));
  });

  it("shows T9 dictionary activated for English chosen while on, then the editor", () => {
    const rig = standbyRig(T9);
    keys(rig, `${WRITE} navi wait:500 down*7 navi wait:500`);
    rig.press("navi");
    rig.advance(100);
    expectLcd(rig.paint(), goldenImage("t9/dictionary-off-on/19-on", "b"), "the note");
    keys(rig, "wait:2000");
    expectLcdAnyBlink(rig.paint(), goldenImage("t9/first/02-editor", "02-editor"), "T9 editor");
  });
});

describe("user words (D7)", () => {
  it("stores Insert word's word at once and offers it after a power cycle", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage, ...T9 });
    // Options › Insert word (5th), Hovo in multi-tap, OK.
    keys(rig, `${WRITE} navi wait:500 down*4 navi wait:500 4 4 6 6 6 8 8 8 6 6 6 wait:1600 navi`);
    expect(new StockEeprom(storage).read(T9_USER_RECORD).words).toEqual(["Hovo"]);
    const again = standbyRig({ storage, ...T9 });
    keys(again, `${WRITE} 4 6 8 6 *~60`);
    expectEither(again, t9Editor("Hovo", { text: "Hovo", question: false, keyed: 4 }), "Hovo");
  });
});

describe("Insert number and Insert symbol (the menu-tree crawl, UNVERIFIED)", () => {
  it("inserts the number typed", () => {
    const rig = standbyRig(T9);
    keys(rig, `${WRITE} navi wait:500 down*5 navi wait:500 1 2 3 navi wait:300`);
    expectEither(rig, t9Editor("123"), "123");
  });

  it("inserts the symbol used, from a table with the T9 header", () => {
    const rig = standbyRig(T9);
    keys(rig, `${WRITE} navi wait:500 down*6 navi wait:500`);
    const fb = new Framebuffer();
    paintWidget(fb, { kind: "symbols", selected: 0, t9: true });
    expect(rig.paint().pixels).toEqual(fb.pixels);
    keys(rig, "navi wait:300");
    expectEither(rig, t9Editor("."), ".");
  });
});
