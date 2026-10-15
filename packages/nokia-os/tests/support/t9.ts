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
import { TEXT_TIMINGS } from "../../src/resources";
import type { Golden } from "../../scripts/golden-format.ts";
import { findGoldenImage } from "../../scripts/golden-format.ts";
import { lcdMismatch } from "./golden.ts";

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
        for (let t = 1; t <= step.ms; t++) {
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
 * A timeline golden against a recording (plan 18b): the recording's first frame is the screen
 * before the trigger (the golden's row before `trigger-frame`); its changes are the rows from the
 * trigger on, aligned on the first change (a key's redraw latency is not reproduced, plan 14
 * D8), each later row starting within `toleranceMs` of the golden's.
 */
export function expectT9Timeline(
  recording: T9Recording,
  golden: Golden,
  context: string,
  toleranceMs = 2,
): void {
  const rows = golden.timeline;
  const trigger = golden.triggerFrame;
  if (rows === undefined || typeof trigger !== "number" || trigger < 1) {
    throw new Error(`${golden.id} is not a timeline golden with a numeric trigger-frame.`);
  }
  const [start, ...changes] = recording.frames;
  const image = (name: string) => ({ id: golden.id, image: findGoldenImage(golden, name) });
  const before = lcdMismatch(start!.pixels, image(rows[trigger - 1]!.image), `${context}: before`);
  if (before !== undefined) throw new Error(before);
  rows.slice(trigger).forEach((row, i) => {
    const frame = changes[i];
    const where = `${context}: row ${trigger + i} (image ${row.image})`;
    if (frame === undefined) throw new Error(`${where}: never shown`);
    const mismatch = lcdMismatch(frame.pixels, image(row.image), where);
    if (mismatch !== undefined) throw new Error(mismatch);
    const expected = row.startMs - rows[trigger]!.startMs;
    const actual = frame.startMs - changes[0]!.startMs;
    if (Math.abs(actual - expected) > toleranceMs) {
      throw new Error(`${where}: starts at ${actual} ms, golden ${expected} ms (±${toleranceMs})`);
    }
  });
}
