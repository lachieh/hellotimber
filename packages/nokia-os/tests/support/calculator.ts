// Drive the stock calculator as plan 20's captures did (`gen_v639_plan20.py`): open it from a
// settled standby with Menu, ▲×4, Select, and replay a case's harness keys (CALCULATOR_CASES).
import type { PhoneKey } from "@hellotimber/phone-core";
import {
  CALCULATOR_CASES,
  imageNameOf,
  stillFixtureOf,
  type CalculatorCase,
  type CalculatorSetup,
} from "../../scripts/capture-sets/20-calculator.ts";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import { standbyRig, type Rig } from "./rig.ts";

/** A harness tap (`key`): ≈42 ms down, the 250 ms settle and the 300 ms key gap. */
export const TAP_DOWN_MS = 42;
export const TAP_MS = 592;
/** After `hold <k> <ms>` the generator runs 250 ms. */
const HOLD_SETTLE_MS = 250;

const KEY_NAMES: Readonly<Record<string, PhoneKey>> = { menu: "navi" };

function phoneKey(name: string): PhoneKey {
  return KEY_NAMES[name] ?? (name as PhoneKey);
}

/**
 * Plays harness tokens: `5`, `menu` (a tap), `c@1500` (held, then 250 ms), `+500` (a wait).
 */
export function play(rig: Rig, keys: string): void {
  for (const token of keys.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("+")) {
      rig.advance(Number(token.slice(1)));
      continue;
    }
    const held = /^(.+)@(\d+)$/.exec(token);
    if (held !== null) {
      rig.press(phoneKey(held[1]!), Number(held[2]));
      rig.advance(HOLD_SETTLE_MS);
      continue;
    }
    rig.press(phoneKey(token), TAP_DOWN_MS);
    rig.advance(TAP_MS - TAP_DOWN_MS);
  }
}

/** Standby to the calculator's first screen (`open_calc`: Menu, ▲×4, 2 s, Select, 1.5 s). */
export function openCalculator(rig: Rig): void {
  play(rig, "menu +300 up up up up +2000 menu +1500");
}

/** The exchange rate's prompt, typed and saved (`set_rate`). */
export function setRate(direction: "foreign" | "domestic", value: string): string {
  const prompt = direction === "foreign" ? "menu up menu menu +500" : "menu up menu down menu +500";
  return `${prompt} ${digitKeys(value)} menu +3500`;
}

/** The keys that type a display string (`.` is `#`). */
export function digitKeys(value: string): string {
  return value
    .split("")
    .map((ch) => (ch === "." ? "#" : ch))
    .join(" ");
}

/** C held 1.5 s then 2 s (the generator's way to standby), as `hold c 1500ms`. */
const TO_STANDBY = "c@1500 +1750";

/**
 * A rig at the state a case starts from (its `setup`), on the calculator's first screen; for a
 * Restore case named `-done`, on the Restore factory settings page after its note.
 */
export function caseRig(c: CalculatorCase, config: { storage?: StockStorage } = {}): Rig {
  const storage = config.storage ?? createMemoryStorage();
  const setup: CalculatorSetup | undefined = c.setup;
  if (setup === undefined) {
    const rig = standbyRig({ storage });
    openCalculator(rig);
    return rig;
  }
  if (setup === "persist") {
    const before = standbyRig({ storage });
    openCalculator(before);
    play(before, `${setRate("foreign", "1.5")} ${TO_STANDBY}`);
    // `saveflash`, `reboot`: a new phone over the same EEPROM.
    const rig = standbyRig({ storage });
    openCalculator(rig);
    return rig;
  }
  if (setup === "reentry") {
    const rig = standbyRig({ storage });
    openCalculator(rig);
    play(rig, `1 2 c c c +2000 ${TO_STANDBY}`);
    openCalculator(rig);
    return rig;
  }
  // Restore factory settings (6-4, the security code 12345) after a rate was saved.
  const rig = standbyRig({ storage });
  openCalculator(rig);
  const [direction, value] =
    setup === "restore" ? (["domestic", "2"] as const) : (["foreign", "1.5"] as const);
  const prompt = direction === "foreign" ? "menu up menu menu +500" : "menu up menu down menu +500";
  // Back at `0`: C leaves to the carousel, C again to standby (the captures held C there, which
  // goes on to standby in the firmware; nokia-os's kernel swallows a key held across an exit).
  play(rig, `${setRate(direction, value)} ${prompt} menu +3500 c +1000 c +1000`);
  // Settings › Restore factory settings through the menu (the captures typed Menu 6 4; nokia-os's
  // kernel returns a shortcut-opened leaf to the carousel, not its page), 12345, OK.
  play(rig, "menu +300 down down down down down +1000 menu down down down menu +2000");
  play(rig, "1 2 3 4 5 menu +6000");
  if (c.name.endsWith("-done")) return rig;
  play(rig, TO_STANDBY);
  openCalculator(rig);
  return rig;
}

/** Task 0's case by name. */
export function calculatorCase(name: string): CalculatorCase {
  const found = CALCULATOR_CASES.find((c) => c.name === name);
  if (found === undefined) throw new Error(`No calculator case ${name}.`);
  return found;
}

/** The cases of still fixture `id`, by golden image name, in case order. */
export function casesOf(
  id: string,
): readonly { readonly image: string; readonly c: CalculatorCase }[] {
  return CALCULATOR_CASES.filter((c) => stillFixtureOf(c.name).id === id).map((c) => ({
    image: imageNameOf(c.name),
    c,
  }));
}
