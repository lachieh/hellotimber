// Plan 18b test support: the T9 goldens' key notes as steps, and their replay on anything that
// takes key edges and time (a stock phone rig, an editor in a flow rig).
//
// Each `t9/*` golden's note ends with where its scenario starts and every key pressed since
// (scripts/t9-capture-set.ts, in its key vocabulary): `From the empty T9 Write messages editor: 4
// · 6 8 6 · * held 1500 ms · wait 1600 ms · record 3000 ms · menu, recording 4000 ms · save flash
// · cold boot.` Groups are separated by ` · `; a group of keys is space-separated taps.
//
// A tap is down, TAP_DOWN_MS, up, then TAP_GAP_MS: the captures' own key timing is not in the
// goldens, and no T9 screen depends on it (no commit timeout, spec 4.1) except the cursor's blink
// phase, so stills compare against either blink phase.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { StockPhoneConfig, StockStorage } from "../../src/index";
import { TEXT_TIMINGS } from "../../src/resources";
import { englishT9 } from "../../src/text/t9/english";
import { readPlanIndex } from "../../scripts/golden-index.ts";
import { GOLDENS } from "./acceptance.ts";
import { goto } from "./drive.ts";
import { loadGolden } from "./goldens.ts";
import { standbyRig, type Rig } from "./rig.ts";
import type { Golden } from "../../scripts/golden-format.ts";
import { findGoldenImage } from "../../scripts/golden-format.ts";
import { lcdMismatch, sameTime, timelineTolerance, withoutPartialDraws } from "./golden.ts";

/**
 * Asserted T9 goldens the implementation cannot reproduce, with the reason (plan 18b Task 8:
 * known gaps run as expected failures).
 */
export const T9_KNOWN_GAPS: Readonly<Record<string, string>> = {
  "t9/g-star-free/07-star-after-space":
    "a short * at a word start after `Into ` leaves one lit pixel on the underline row at the " +
    "cursor's column (x 22, y 16) in the blink's dark phase; the spec says a short * does " +
    "nothing there, and the empty editor's second * (03-star-empty2) shows no such pixel, so its " +
    "rule (an empty composing word toggled by *?) is unknown: not reproduced, reported",
};

export const TAP_DOWN_MS = 60;
export const TAP_GAP_MS = 340;

export type T9Step =
  | { readonly kind: "tap"; readonly key: PhoneKey }
  | { readonly kind: "hold"; readonly key: PhoneKey; readonly ms: number }
  | { readonly kind: "wait"; readonly ms: number }
  /** A timeline starts: with `key`, just before it is pressed; without, on the next change. */
  | { readonly kind: "record"; readonly ms: number; readonly key?: PhoneKey }
  | { readonly kind: "save-flash" }
  | { readonly kind: "cold-boot" };

export interface T9Script {
  /** The scenario's start: the empty T9 editor of Write messages, or the Write messages page. */
  readonly base: "editor" | "page";
  readonly steps: readonly T9Step[];
}

const KEY: Readonly<Record<string, PhoneKey>> = { menu: "navi" };

function key(token: string): PhoneKey {
  if (!/^([0-9*#c]|menu|up|down)$/.test(token)) throw new Error(`unknown key "${token}"`);
  return KEY[token] ?? (token as PhoneKey);
}

/** A golden note's base and steps. */
export function parseT9Note(note: string): T9Script {
  const match = /From the (empty T9 Write messages editor|Write messages page)(?:: (.*))?\.$/.exec(
    note,
  );
  if (match === null) throw new Error(`not a T9 golden note: ${note}`);
  const base = match[1]!.startsWith("empty") ? "editor" : "page";
  const steps: T9Step[] = [];
  for (const group of (match[2] ?? "").split(" · ").filter((g) => g !== "")) {
    let m: RegExpExecArray | null;
    if ((m = /^(\S+) held (\d+) ms$/.exec(group))) {
      steps.push({ kind: "hold", key: key(m[1]!), ms: Number(m[2]) });
    } else if ((m = /^wait (\d+) ms$/.exec(group))) {
      steps.push({ kind: "wait", ms: Number(m[1]) });
    } else if ((m = /^record (\d+) ms$/.exec(group))) {
      steps.push({ kind: "record", ms: Number(m[1]) });
    } else if ((m = /^(\S+), recording (\d+) ms$/.exec(group))) {
      steps.push({ kind: "record", ms: Number(m[2]), key: key(m[1]!) });
    } else if (group === "save flash") steps.push({ kind: "save-flash" });
    else if (group === "cold boot") steps.push({ kind: "cold-boot" });
    else for (const token of group.split(" ")) steps.push({ kind: "tap", key: key(token) });
  }
  return { base, steps };
}

/** What a replay drives. */
export interface T9Target {
  down(key: PhoneKey): void;
  up(key: PhoneKey): void;
  advance(ms: number): void;
  frame(): Uint8Array;
  /** `save flash` then `cold boot` (only the phone rig has them). */
  saveFlash?(): void;
  coldBoot?(): void;
}

/** A recording: the frames from `startMs` (relative), the first being the screen at the start. */
export interface T9Recording {
  readonly frames: readonly { readonly startMs: number; readonly pixels: Uint8Array }[];
}

/**
 * Plays `steps` on `target`. A record step records for its length (the key, if any, pressed 1 ms
 * in) and hands the recording to `recorded`; the last step's recording is the golden's.
 */
export function playT9(
  target: T9Target,
  steps: readonly T9Step[],
  recorded: (recording: T9Recording, step: T9Step) => void = () => {},
): void {
  for (const step of steps) {
    switch (step.kind) {
      case "tap":
        target.down(step.key);
        target.advance(TAP_DOWN_MS);
        target.up(step.key);
        target.advance(TAP_GAP_MS);
        break;
      case "hold":
        target.down(step.key);
        target.advance(step.ms);
        target.up(step.key);
        target.advance(TAP_GAP_MS);
        break;
      case "wait":
        target.advance(step.ms);
        break;
      case "record": {
        const frames = [{ startMs: 0, pixels: target.frame() }];
        const keyAt = step.key === undefined ? undefined : 1;
        // Two blink steps longer: a blink-only recording aligns on the phase the golden starts in.
        for (let t = 1; t <= step.ms + 2 * TEXT_TIMINGS.blinkMs; t++) {
          if (t === keyAt) target.down(step.key!);
          if (keyAt !== undefined && t === keyAt + TAP_DOWN_MS) target.up(step.key!);
          target.advance(1);
          const pixels = target.frame();
          if (!same(frames[frames.length - 1]!.pixels, pixels)) frames.push({ startMs: t, pixels });
        }
        recorded({ frames }, step);
        break;
      }
      case "save-flash":
        target.saveFlash?.();
        break;
      case "cold-boot":
        target.coldBoot?.();
        break;
    }
  }
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * The still golden's images against the screen now and one blink step later (either cursor
 * phase): each image must match one of them. Throws the first image's mismatch otherwise.
 */
export function expectT9Still(target: T9Target, golden: Golden, context: string): void {
  const frames = [target.frame()];
  target.advance(TEXT_TIMINGS.blinkMs);
  frames.push(target.frame());
  for (const image of golden.images) {
    const ref = { id: golden.id, image };
    const results = frames.map((pixels) => lcdMismatch(pixels, ref, context));
    if (results.some((r) => r === undefined)) continue;
    throw new Error(results[0]);
  }
}

/**
 * A timeline golden against a recording (plan 18b): the frame before the trigger is the golden's
 * row before `trigger-frame`; the changes from the trigger are its rows, aligned on the first
 * (a key's redraw latency is not reproduced, plan 14 D8), each later row starting by the
 * fidelity standard. Frames under TWO_FRAMES_MS on either side are left out.
 */
export function expectT9Timeline(
  recording: T9Recording,
  golden: Golden,
  context: string,
  { keyed }: { readonly keyed: boolean },
): void {
  const rows = golden.timeline;
  const trigger = golden.triggerFrame;
  if (rows === undefined || typeof trigger !== "number" || trigger < 1) {
    throw new Error(`${golden.id} is not a timeline golden with a numeric trigger-frame.`);
  }
  const image = (name: string) => ({ id: golden.id, image: findGoldenImage(golden, name) });
  // A recording without a key starts at an arbitrary blink phase: it aligns on the first change
  // that shows the golden's trigger row.
  let first = 1;
  if (!keyed) {
    const at = recording.frames.findIndex(
      (frame, i) =>
        i > 0 && lcdMismatch(frame.pixels, image(rows[trigger]!.image), "") === undefined,
    );
    if (at > 0) first = at;
  }
  const start = recording.frames[first - 1]!;
  const before = lcdMismatch(start!.pixels, image(rows[trigger - 1]!.image), `${context}: before`);
  if (before !== undefined) throw new Error(before);
  const origin = rows[trigger]!.startMs;
  const last = rows[rows.length - 1]!;
  const recorded = recording.frames.slice(first);
  const { golden: settled, actual: changes } = withoutPartialDraws(
    {
      frames: rows.slice(trigger).map((row, i) => ({
        ...row,
        index: trigger + i,
        pixels: image(row.image).image.pixels,
      })),
      endMs: last.startMs + last.durationMs,
    },
    { frames: recorded, endMs: Infinity },
  );
  const tolerance = timelineTolerance(settled.map((row) => row.startMs - origin));
  settled.forEach((row, i) => {
    const frame = changes[i];
    const where = `${context}: row ${row.index} (image ${row.image})`;
    if (frame === undefined) throw new Error(`${where}: never shown`);
    const mismatch = lcdMismatch(frame.pixels, image(row.image), where);
    if (mismatch !== undefined) throw new Error(mismatch);
    const expected = row.startMs - origin;
    const actual = frame.startMs - changes[0]!.startMs;
    if (!sameTime(actual, expected, tolerance(expected))) {
      throw new Error(`${where}: starts at ${actual} ms, golden ${expected} ms`);
    }
  });
}

// ---------------------------------------------------------------- the phone

/** The Write messages page settles this long before the scenario's first key. */
const PAGE_SETTLE_MS = 1500;
/** The editor's first draw after Select. */
const EDITOR_SETTLE_MS = 600;

/** A storage whose items can be copied (`save flash`). */
function copyableStorage(items = new Map<string, string>()): StockStorage & {
  readonly items: Map<string, string>;
} {
  return {
    items,
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => void items.set(k, String(v)),
    removeItem: (k) => void items.delete(k),
  };
}

/**
 * A stock phone at the scenario's base, with `config` (default: the shipped English
 * dictionary): standby, Menu, ▼ to Messages, Select (the Write messages page), and for the
 * editor base, Select. `save flash` copies its storage; `cold boot` starts a second phone over the
 * copy and brings it to the page (`g-persist-dict`: the rig's two phones over one storage).
 */
export function t9PhoneTarget(
  base: "editor" | "page",
  config: Partial<StockPhoneConfig> = { t9: { english: englishT9 } },
): T9Target & { readonly rig: () => Rig } {
  let storage = copyableStorage();
  let saved: Map<string, string> | undefined;
  const boot = (): Rig => {
    const rig = standbyRig({ ...config, storage });
    goto(rig, "2-1");
    rig.advance(PAGE_SETTLE_MS);
    return rig;
  };
  let rig = boot();
  if (base === "editor") {
    rig.press("navi", TAP_DOWN_MS);
    rig.advance(EDITOR_SETTLE_MS);
  }
  return {
    rig: () => rig,
    down: (key) => rig.hold(key),
    up: (key) => rig.release(key),
    advance: (ms) => rig.advance(ms),
    frame: () => rig.paint().pixels,
    saveFlash() {
      saved = new Map(storage.items);
    },
    coldBoot() {
      storage = copyableStorage(new Map(saved ?? storage.items));
      rig = boot();
    },
  };
}

// ---------------------------------------------------------------- acceptance (Task 8)

/**
 * Golden `id`'s scenario: its note played on a stock phone with the shipped English dictionary
 * (the goldens' key sequences are ones the open list shares with the firmware, D9), from the
 * Write messages page or its empty T9 editor; a still compared in either blink phase, a
 * recording from its trigger.
 */
export function t9Scenario(id: string): void {
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
  else {
    expectT9Timeline(recording!, golden, context, { keyed });
  }
}

const ASSERTED = readPlanIndex(GOLDENS, "18b").filter((entry) => entry.status === "asserted");

/** The scenario of every asserted plan 18b golden (tests/acceptance/18b-t9-predictive-text). */
export const T9_SCENARIOS: Readonly<Record<string, (id: string) => void>> = Object.fromEntries(
  ASSERTED.map(({ id }) => [id, t9Scenario]),
);

/** The known gaps among the asserted goldens. */
export const T9_ASSERTED_KNOWN_GAPS: Readonly<Record<string, string>> = Object.fromEntries(
  ASSERTED.flatMap(({ id }) => (T9_KNOWN_GAPS[id] === undefined ? [] : [[id, T9_KNOWN_GAPS[id]!]])),
);
