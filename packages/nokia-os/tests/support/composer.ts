// Drive the stock Composer as plan 27's captures did (`gen_v639_plan27.py`).
import type { PhoneKey } from "@hellotimber/phone-core";
import {
  COMPOSER_CASES,
  COMPOSER_RECORDING_KEYS,
  COMPOSER_SETUPS,
  composerSoundId,
  OPEN_COMPOSER,
  openSlot,
  stillFixtureOf,
  type ComposerCase,
  type ComposerRecordingKeys,
} from "../../scripts/capture-sets/27-composer.ts";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import type { ComposerModel } from "../../src/display/widgets";
import { expectLcd } from "./golden.ts";
import { goldenImage } from "./goldens.ts";
import { seededStorage, standbyRig, type Rig } from "./rig.ts";
import type { SoundGolden } from "../../scripts/sound-format.ts";
import { soundStorage } from "./sound-scenarios.ts";
import {
  expectSoundTimeline,
  KEY_LATENCY_MAX_MS,
  loadSoundGolden,
  playSound,
  type RecordedSound,
  type SoundTolerance,
} from "./sound.ts";
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

/**
 * The phone a still fixture's previous case left (`composerStill`'s `chain`): a case whose keys
 * extend it from the same start continues it, as `playComposer` plays tokens one after another
 * (`cursor/up/NN` is `cursor/up/NN-1` and one more `up +350`: 52 replays of 50 tokens otherwise).
 */
export interface StillChain {
  last?: { readonly case: ComposerCase; readonly rig: Rig };
}

/** Whether `c` starts where `previous` did and its keys continue `previous`'s. */
function continues(previous: ComposerCase, c: ComposerCase): boolean {
  const sameStart =
    previous.state === c.state &&
    previous.from === c.from &&
    previous.slot === c.slot &&
    previous.setup === c.setup;
  return sameStart && (previous.keys === "" || c.keys.startsWith(`${previous.keys} `));
}

/**
 * A case replayed on a fresh phone (or continuing `chain`'s, which it then holds), then compared
 * with its still.
 */
export function composerStill(c: ComposerCase, chain?: StillChain): void {
  const last = chain?.last;
  let rig: Rig;
  if (last !== undefined && continues(last.case, c)) {
    rig = last.rig;
    playComposer(rig, c.keys.slice(last.case.keys.length));
  } else {
    rig = composerRig(c.state);
    playComposer(rig, setupKeys(c));
    playComposer(rig, c.keys);
  }
  if (chain !== undefined) chain.last = { case: c, rig };
  const { id, image } = stillFixtureOf(c.name);
  expectLcd(
    rig.paint(),
    goldenImage(id, image),
    `${c.name}: ${c.setup ?? c.from}, ${c.keys || "(no key)"}`,
  );
}

/** The recording behind sound golden `id` (`COMPOSER_RECORDING_KEYS`). */
export function composerRecording(id: string): ComposerRecordingKeys {
  const found = COMPOSER_RECORDING_KEYS.find((r) => composerSoundId(r.dir) === id);
  if (found === undefined) throw new Error(`No composer recording for ${id}.`);
  return found;
}

/** Settings a recording's directory names (`play/gate-ring-once`, `sound/pitch/level-2`). */
const CONDITIONS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "alert-off": { "tones/incoming-call-alert": 4 },
  "ring-once": { "tones/incoming-call-alert": 2 },
  "beep-once": { "tones/incoming-call-alert": 3 },
  ascending: { "tones/incoming-call-alert": 1 },
  "keypad-off": { "tones/keypad-tones": 0 },
  "warning-off": { "tones/warning-tones": 1 },
  "vibrator-off": { "tones/vibrating-alert": 1 },
  "level-1": { "tones/ringing-volume": 0 },
  "level-2": { "tones/ringing-volume": 1 },
  "level-3": { "tones/ringing-volume": 2 },
  "level-4": {},
  "level-5": { "tones/ringing-volume": 4 },
  l1: { "tones/ringing-volume": 0 },
  l3: { "tones/ringing-volume": 2 },
};

/** The settings recording `dir` was made with (its section's `choose`, `set_volume`). */
export function recordingChoices(dir: string): Readonly<Record<string, number>> {
  const named =
    /^play\/(?:gate|entry|long)-(.+)$/.exec(dir)?.[1] ??
    /^sound\/(?:pitch|entry\/octaves)-?\/?(level-\d)$/.exec(dir)?.[1] ??
    /^sound\/tempo\/(l\d)-\d+$/.exec(dir)?.[1];
  if (named === undefined || named === "virgin") return {};
  const choices = CONDITIONS[named];
  if (choices === undefined) throw new Error(`No settings for recording ${dir}.`);
  return choices;
}

/**
 * The buzzer and vibrator events of each key's segment moved by that key's sound latency (the
 * golden's first buzzer row after the key less the phone's): nokia-os does not reproduce the
 * firmware's key-to-sound latency (D5, plan 16 D8), so a program a key starts is compared from
 * its onset. The keypad beeps keep their times.
 */
function alignKeySounds(recorded: RecordedSound, golden: SoundGolden): RecordedSound {
  const keys = golden.keys ?? [];
  const shifts = keys.map((key, i) => {
    const end = keys[i + 1]?.ms ?? Infinity;
    const row = golden.rows.find(
      (r) =>
        r.output === "buzzer" &&
        r.ms >= key.ms &&
        r.ms < Math.min(end, key.ms + KEY_LATENCY_MAX_MS),
    );
    const event = recorded.events.find(
      (e) =>
        e.output === "buzzer" &&
        e.atMs - recorded.originMs >= key.ms &&
        e.atMs - recorded.originMs < end,
    );
    if (row === undefined || event === undefined) return { from: key.ms, end, by: 0 };
    return { from: key.ms, end, by: row.ms - (event.atMs - recorded.originMs) };
  });
  return {
    ...recorded,
    events: recorded.events.map((e) => {
      if (e.output === "tone") return e;
      const t = e.atMs - recorded.originMs;
      const shift = shifts.find((s) => t >= s.from && t < s.end);
      return shift === undefined ? e : { ...e, atMs: e.atMs + shift.by };
    }),
  };
}

/**
 * Sound golden `id` replayed: a fresh phone in the recording's state and settings, its setup and
 * `before` taps, then the golden's keys from time 0, compared with plan 16's tolerances from each
 * key's sound onset (`alignKeySounds`).
 */
export function composerSound(id: string, tolerance: SoundTolerance = {}): void {
  const r = composerRecording(id);
  const storage = soundStorage(
    r.state === "factory" ? "factory" : "virgin",
    recordingChoices(r.dir),
  );
  const rig = composerRig(r.state, storage);
  playComposer(rig, setupKeys(r));
  playComposer(rig, r.before);
  const golden = loadSoundGolden(id);
  const recorded = alignKeySounds(playSound(rig, golden), golden);
  expectSoundTimeline(
    recorded,
    golden,
    `${id}: ${r.setup ?? r.from}, ${r.before || "-"}, then ${golden.note ?? ""}`,
    tolerance,
  );
}
