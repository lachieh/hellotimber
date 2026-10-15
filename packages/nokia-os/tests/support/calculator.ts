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
import { expect } from "vite-plus/test";
import { expectLcd, expectTimeline, lcdMismatch, timingToleranceMs } from "./golden.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { standbyRig, type Rig } from "./rig.ts";
import { expectSoundTimeline, loadSoundGolden, playSound } from "./sound.ts";
import { soundRig } from "./sound-scenarios.ts";

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

// ---------------------------------------------------------------- sound (Task 7)

/** The Foreign rate prompt from the first screen (`FOREIGN`), and the Options list (`menu`). */
export const FOREIGN = "menu up menu menu +500";
export const DOMESTIC = "menu up menu down menu +500";

/**
 * The calculator on a phone in `state` (plan 16's sound setup: factory with C held and 1 s of
 * standby, or virgin), then `setup` played: the golden's keys follow at once, the DSP awake.
 */
export function soundCalculator(state: "factory" | "virgin", setup: string): Rig {
  const rig = soundRig(state);
  openCalculator(rig);
  play(rig, setup);
  return rig;
}

/** Plays sound golden `id`'s keys after `setup` on the calculator and compares the events. */
export function calculatorSound(
  id: string,
  setup: string,
  state: "factory" | "virgin" = "factory",
): void {
  const golden = loadSoundGolden(id);
  const rig = soundCalculator(state, setup);
  expectSoundTimeline(playSound(rig, golden), golden, `${id}: ${setup}, then ${golden.note}`);
}

const NOTE_SETUPS = {
  "out-of-range": "9 9 9 9 9 * * * 9 9 9 9 9",
  "divide-by-zero": "7 * * * * 0",
} as const;

const RATE_SLUGS = [..."0123456789".split(""), "star", "hash", "up", "down", "c", "menu"];

/** Every calculator sound golden's scenario (the D9 escape keys wait on plan 22). */
export const CALCULATOR_SOUND_SCENARIOS: Readonly<Record<string, (id: string) => void>> = {
  "sound/calculator/keys": (id) => calculatorSound(id, ""),
  "sound/note/calculator-out-of-range": (id) => calculatorSound(id, NOTE_SETUPS["out-of-range"]),
  "sound/note/calculator-divide-by-zero": (id) =>
    calculatorSound(id, NOTE_SETUPS["divide-by-zero"]),
  "sound/calculator/divide-by-zero-virgin": (id) =>
    calculatorSound(id, NOTE_SETUPS["divide-by-zero"], "virgin"),
  "sound/calculator/note-key": (id) => calculatorSound(id, NOTE_SETUPS["out-of-range"]),
  "sound/calculator/rate-saved": (id) => calculatorSound(id, `${FOREIGN} c@1500`),
  ...Object.fromEntries(
    RATE_SLUGS.map((slug) => [
      `sound/calculator/keys-rate-${slug}`,
      (id: string) => calculatorSound(id, `${FOREIGN} 1`),
    ]),
  ),
  ...Object.fromEntries(
    ["up", "down", "c", "menu"].map((slug) => [
      `sound/calculator/keys-options-${slug}`,
      (id: string) => calculatorSound(id, "menu"),
    ]),
  ),
};

// ---------------------------------------------------------------- acceptance (Task 8)

/** The rate prompts a case's keys open (`FOREIGN`/`DOMESTIC`, then no OK). */
function endsInRateEntry(keys: string): boolean {
  const at = Math.max(keys.lastIndexOf(FOREIGN), keys.lastIndexOf(DOMESTIC));
  return (
    at >= 0 &&
    !keys
      .slice(at)
      .replace(/^menu up menu( down)? menu \+500/, "")
      .includes("menu")
  );
}

/**
 * The rate entry's blink phase in a still follows the harness's tap timing (its emulator settle,
 * which the captures do not record): the entry's own recordings time the blink, so a still of
 * the entry may show the other phase within one blink step of the shot.
 */
const BLINK_STEP_MS = 480;

/** Every image of still fixture `id`: its case replayed from a fresh phone, then compared. */
export function stillScenario(id: string): void {
  const golden = loadGolden(id);
  const cases = casesOf(id);
  expect(cases.map((c) => c.image)).toEqual(golden.images.map((image) => image.name));
  for (const { image, c } of cases) {
    const ref = goldenImage(id, image);
    const rig = caseRig(c);
    const context = `${c.name}: ${c.setup === undefined ? "" : `${c.setup}, `}${c.keys || "(first screen)"}`;
    if (!endsInRateEntry(c.keys)) {
      play(rig, c.keys);
      expectLcd(rig.paint(), ref, context);
      continue;
    }
    const tokens = c.keys.split(" ");
    play(rig, tokens.slice(0, -1).join(" "));
    const shown = rig.record(BLINK_STEP_MS * 2, () => play(rig, tokens.at(-1)!));
    const at = shown.triggerMs;
    const near = shown.frames.filter(
      (frame, i) =>
        frame.startMs <= at + BLINK_STEP_MS &&
        (shown.frames[i + 1]?.startMs ?? Infinity) > at - BLINK_STEP_MS,
    );
    if (near.some((frame) => lcdMismatch(frame.pixels, ref, context) === undefined)) continue;
    expectLcd(rig.paint(), ref, `${context} (either blink phase within ${BLINK_STEP_MS} ms)`);
  }
}

/** A key of a recording: down at a golden row's start (or `ms` after the trigger), held `holdMs`. */
export interface RecordingKey {
  readonly at: number | { readonly ms: number };
  readonly key: PhoneKey;
  readonly holdMs?: number;
}

/**
 * A timeline golden from `rig`: frame `trigger-frame - 1` on screen, the trigger key (held
 * `holdMs`), then each later key down on the row its effect starts (D8: no redraw latency) and
 * up after its hold. Frame starts are aligned on the trigger.
 */
export function recordingScenario(
  id: string,
  rig: Rig,
  trigger: RecordingKey,
  later: readonly RecordingKey[] = [],
): void {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const t = golden.triggerFrame as number;
  expectLcd(rig.paint(), goldenImage(id, rows[t - 1]!.image), `${id}: before the trigger`);
  const origin = rows[t]!.startMs;
  const last = rows[rows.length - 1]!;
  const span = last.startMs + last.durationMs - origin + 100;
  const schedule = later.flatMap(({ at, key, holdMs = 0 }) => {
    const atMs = typeof at === "number" ? rows[at]!.startMs - origin : at.ms;
    return [
      { atMs, run: () => rig.hold(key) },
      { atMs: atMs + holdMs, run: () => rig.release(key) },
    ];
  });
  const release = trigger.holdMs ?? 0;
  if (release > 0) schedule.push({ atMs: release, run: () => rig.release(trigger.key) });
  const recording = rig.record(
    span,
    () => (release > 0 ? rig.hold(trigger.key) : rig.press(trigger.key)),
    schedule,
  );
  const keys = [trigger, ...later].map((k) => `${k.key}${k.holdMs ? `~${k.holdMs}` : ""}`);
  expectTimeline(recording, golden, `${id}: ${keys.join(", ")}`);
}

/**
 * A rate entry key recording (`calculator/keys-rate-*`): the cursor's blink runs from the prompt
 * and not from the key, so frames are compared at their time after the key (golden time 0), the
 * key's own redraw at the key (its latency not reproduced), by the fidelity standard (the
 * firmware's blink steps vary 477-494 ms between recordings).
 */
export function keyAlignedScenario(id: string, rig: Rig, key: PhoneKey): void {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const t = golden.triggerFrame as number;
  const last = rows[rows.length - 1]!;
  expectLcd(rig.paint(), goldenImage(id, rows[0]!.image), `${id}: before the key`);
  const recording = rig.record(last.startMs + last.durationMs, () => rig.press(key));
  // The golden's last frame was cut off by the recording's end: a blink within the tolerance
  // of that end may fall either side of it and is not compared.
  const lastEnd = last.startMs + last.durationMs;
  const end = recording.triggerMs + lastEnd - timingToleranceMs(lastEnd);
  const after = recording.frames.filter(
    (frame) => frame.startMs >= recording.triggerMs && frame.startMs < end,
  );
  // A key that changes nothing at once leaves the frame before it on screen.
  const frames = t === 0 ? [recording.frames[0]!, ...after] : after;
  rows.slice(t === 0 ? 0 : 1).forEach((row, i) => {
    const frame = frames[i];
    const context = `${id} row ${row.frame} (image ${row.image})`;
    expect(frame, `${context}: never shown`).toBeDefined();
    expectLcd({ pixels: frame!.pixels }, goldenImage(id, row.image), context);
    if (row.frame <= t) return;
    const actual = frame!.startMs - recording.triggerMs;
    expect(
      Math.abs(actual - row.startMs),
      `${context}: at ${actual} ms, golden ${row.startMs} ms`,
    ).toBeLessThanOrEqual(timingToleranceMs(row.startMs));
  });
  expect(frames.length, `${id}: frames after the golden's last`).toBe(
    rows.length - (t === 0 ? 0 : 1),
  );
}
