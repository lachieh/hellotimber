// Drive the stock Composer as plan 27's captures did (`gen_v639_plan27.py`).
import type { PhoneKey } from "@hellotimber/phone-core";
import {
  COMPOSER_CASES,
  COMPOSER_SETUPS,
  OPEN_COMPOSER,
  openSlot,
  stillFixtureOf,
  type ComposerCase,
} from "../../scripts/capture-sets/27-composer.ts";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import type { ComposerModel } from "../../src/display/widgets";
import { recordTimeline } from "./acceptance.ts";
import { goto } from "./drive.ts";
import { expectLcd, expectTimeline, PROBE_TOLERANCE_MS } from "./golden.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { seededStorage, standbyRig, type Rig } from "./rig.ts";
import { composerLines } from "../../src/composer/layout";
import { COMPOSER_LIMIT } from "../../src/composer/notation";
import {
  composerHeld,
  composerKeyDown,
  isNoteKey,
  type ComposerState,
} from "../../src/composer/editor";

/** Task 0 H (provisional until COMPOSER_TIMINGS): a hold's times from its key-down. */
const HOLD = { dotMs: 771, clearMs: 465, repeatFirstMs: 778, repeatEveryMs: 196 } as const;

const KEY_NAMES: Readonly<Record<string, PhoneKey>> = { menu: "navi" };

function phoneKey(name: string): PhoneKey {
  return KEY_NAMES[name] ?? (name as PhoneKey);
}

/**
 * The editor engine through harness tokens (`1`, `1@1500`, `+500`): each key's down, and for a
 * held key what its hold does (a note key's dot, C's clear, ▲/▼'s repeats) by its duration.
 */
export function replayComposerKeys(start: ComposerState, keys: string): { state: ComposerState } {
  let state = start;
  for (const token of keys.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("+")) continue;
    const held = /^(.+)[@~](\d+)$/.exec(token);
    const key = phoneKey(held ? held[1]! : token);
    const ms = held ? Number(held[2]) : 42;
    const before = state.tokens.length;
    state = composerKeyDown(state, key).state;
    if (isNoteKey(key) && ms >= HOLD.dotMs && state.tokens.length > before) {
      state = composerHeld(state, key).state;
    } else if (key === "c" && ms >= HOLD.clearMs) {
      state = composerHeld(state, key).state;
    } else if (key === "up" || key === "down") {
      for (let t = HOLD.repeatFirstMs; t < ms; t += HOLD.repeatEveryMs) {
        state = composerKeyDown(state, key).state;
      }
    }
  }
  return { state };
}

/**
 * The editor's view after each key of `keys` from `start`: the engine's state and the layout's
 * top, scrolled key by key as the editor does.
 */
export function replayComposerView(
  start: ComposerState,
  keys: string,
): { state: ComposerState; top: number } {
  let state = start;
  let top = composerLines(state.tokens, state.cursor).top;
  for (const token of keys.split(/\s+/).filter(Boolean)) {
    state = replayComposerKeys(state, token).state;
    top = composerLines(state.tokens, state.cursor, top).top;
  }
  return { state, top };
}

/** The editor's model for `state` with the cursor in its shown phase. */
export function composerModel(state: ComposerState, top: number): ComposerModel {
  const layout = composerLines(state.tokens, state.cursor, top);
  const line = layout.cursorAt.line - layout.top;
  return {
    kind: "composer",
    lines: layout.lines.slice(layout.top, layout.top + 3),
    cursor: { line, x: layout.cursorAt.x },
    counter: String(COMPOSER_LIMIT - state.tokens.length),
    softkey: state.tokens.length === 0 ? "Back" : "Options",
  };
}

/**
 * Select on an empty slot (plan 14's `tree/05-tones/5-4-k.leaf`): the editor and its blink, the
 * frames within PROBE_TOLERANCE_MS (the firmware's blink runs a step 7-11 ms late now and then;
 * nokia-os steps evenly, plan 27 Task 8).
 */
export function composerLeafScenario(id: string): void {
  const golden = loadGolden(id);
  const number = /5-4-\d/.exec(id)![0];
  const rig = standbyRig();
  goto(rig, number);
  rig.advance(592);
  const t = golden.triggerFrame as number;
  expectLcd(rig.paint(), goldenImage(id, golden.timeline![t - 1]!.image), `${number} highlighted`);
  const recording = recordTimeline(rig, golden, () => rig.press("navi"));
  expectTimeline(recording, golden, `${number} highlighted, Select`, {
    toleranceMs: PROBE_TOLERANCE_MS,
  });
}

// ---------------------------------------------------------------- the phone (Tasks 8-12)

/**
 * A harness tap (`key`): ≈42 ms down, the emulator's settle and the 300 ms key gap, measured at
 * 605-615 ms in the composer (a mean 610 ms over 50 taps: the settle waits in 5 ms steps).
 */
const TAP_DOWN_MS = 42;
const TAP_MS = 610;
/** `hold <k> <ms>` takes 50 ms more than the hold (measured), then the generator runs 250 ms. */
const HOLD_SETTLE_MS = 300;

/**
 * Plays harness tokens (`gen_v639_plan27.py` `play`): `5` a tap, `c@1500` held then 250 ms,
 * `menu~60` pressed 60 ms (no settle), `+500` a wait.
 */
export function playComposer(rig: Rig, keys: string): void {
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
    const raw = /^(.+)~(\d+)$/.exec(token);
    if (raw !== null) {
      rig.press(phoneKey(raw[1]!), Number(raw[2]));
      continue;
    }
    rig.press(phoneKey(token), TAP_DOWN_MS);
    rig.advance(TAP_MS - TAP_DOWN_MS);
  }
}

/** A settled standby in Task 0's state: plan 15's factory image or the virgin one. */
export function composerRig(state: ComposerCase["state"], storage?: StockStorage): Rig {
  if (state === "factory") {
    const rig = standbyRig({ storage: storage ?? seededStorage({ factory: true }) });
    rig.press("c", 1500);
    rig.advance(1000);
    return rig;
  }
  const rig = standbyRig({ storage: storage ?? createMemoryStorage() });
  rig.press("c");
  rig.advance(2000);
  return rig;
}

/** The keys from standby to where `c` starts (its setup, or Menu 5 4 and the slot's Select). */
export function setupKeys(c: Pick<ComposerCase, "from" | "slot" | "setup">): string {
  if (c.setup !== undefined) {
    const keys = COMPOSER_SETUPS[c.setup];
    if (keys === undefined) throw new Error(`No setup "${c.setup}" to replay.`);
    return keys;
  }
  if (c.from === "standby") return "";
  return c.from === "slots" ? OPEN_COMPOSER : `${OPEN_COMPOSER} ${openSlot(c.slot ?? 1)}`;
}

/** Task 0's case by name. */
export function composerCase(name: string): ComposerCase {
  const found = COMPOSER_CASES.find((c) => c.name === name);
  if (found === undefined) throw new Error(`No composer case ${name}.`);
  return found;
}

/** A case replayed on a fresh phone, then compared with its still. */
export function composerStill(c: ComposerCase): void {
  const rig = composerRig(c.state);
  playComposer(rig, setupKeys(c));
  playComposer(rig, c.keys);
  const { id, image } = stillFixtureOf(c.name);
  expectLcd(
    rig.paint(),
    goldenImage(id, image),
    `${c.name}: ${c.setup ?? c.from}, ${c.keys || "(no key)"}`,
  );
}
