// Helpers for hand-written probe scenarios (plan 14 Task 13, S7; the plans' acceptance files in
// tests/acceptance/). Each scenario replays the probe's keys from its `.cap` script (see the
// golden's note): stills compare one image per step; timelines press the trigger, then each later
// key on the tick its effect starts in the golden (D8: the key-to-redraw latency is not
// reproduced).
//
// Timing (plan 14 closeout decision 2): the timeline is anchored on the trigger key. A probe
// that replays another recording's timings, or presses keys after the trigger, compares frame
// starts within PROBE_TOLERANCE_MS (each such scenario says why); every other probe keeps ±2 ms.
// Pixels are always exact.
import type { PhoneKey } from "@hellotimber/phone-core";
import { expect } from "vite-plus/test";
import {
  expectLcd,
  expectTimeline,
  lcdMismatch,
  PROBE_TOLERANCE_MS,
  type TimelineTolerance,
} from "./golden.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { frameAt, standbyRig, type Rig } from "./rig.ts";

/** One harness tap (`key`): ≈42 ms down, the 250 ms settle and the 300 ms key gap. */
export const TAP_MS = 592;

/**
 * A token list: `navi`, `down*9`, `wait:1500`, `c~1000` (C held 1000 ms). Each key is a tap (or
 * the hold) followed by TAP_MS.
 */
export function keys(rig: Rig, script: string): void {
  for (const token of script.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("wait:")) {
      rig.advance(Number(token.slice(5)));
      continue;
    }
    const hold = /^(.+)~(\d+)$/.exec(token);
    if (hold !== null) {
      rig.press(hold[1] as PhoneKey, Number(hold[2]));
      rig.advance(TAP_MS);
      continue;
    }
    const [key, times = "1"] = token.split("*");
    for (let i = 0; i < Number(times); i++) {
      rig.press(key as PhoneKey);
      rig.advance(TAP_MS);
    }
  }
}

/** A rig at standby after `script`. */
export function after(script: string): Rig {
  const rig = standbyRig();
  keys(rig, script);
  return rig;
}

/**
 * A still probe: `steps[i]` runs before image `i` is compared (the probe's images in order).
 * With `toleranceMs` an image may have been on screen up to that long before or after its step
 * ends (a shot timed from a key the firmware times from its redraw).
 */
export function stills(id: string, rig: Rig, steps: readonly string[], toleranceMs = 0): void {
  const golden = loadGolden(id);
  expect(steps.length, `${id}: one step per image`).toBe(golden.images.length);
  golden.images.forEach((image, i) => {
    const context = `${id}: ${steps.slice(0, i + 1).join(" | ")}`;
    if (toleranceMs === 0) {
      keys(rig, steps[i]!);
      expectLcd(rig.paint(), { id, image }, context);
      return;
    }
    const recording = rig.record(toleranceMs, () => keys(rig, steps[i]!));
    const at = recording.triggerMs;
    const shown = [
      frameAt(recording, at - toleranceMs),
      ...recording.frames.filter(
        (frame) => frame.startMs > at - toleranceMs && frame.startMs <= at + toleranceMs,
      ),
    ];
    if (shown.some((frame) => lcdMismatch(frame.pixels, { id, image }, context) === undefined)) {
      return;
    }
    expectLcd(frameAt(recording, at), { id, image }, `${context} (±${toleranceMs} ms)`);
  });
}

/**
 * The firmware redraws 50-125 ms after a key (D8). A key pressed ahead of its first redraw is
 * pressed by the lower bound, and that redraw's start is not compared.
 */
const KEY_TO_REDRAW_MS = 50;

/**
 * A later key: pressed on the tick golden row `row` starts (its effect), at `ms`, or `ahead` of
 * the row it draws first (KEY_TO_REDRAW_MS before it; the row is then untimed). A key goes ahead
 * when its effect pre-empts a timer step that would fall inside its redraw latency.
 */
export type Later =
  | readonly [row: number, key: PhoneKey]
  | readonly [{ ms: number }, PhoneKey]
  | readonly [{ ahead: number }, PhoneKey];

/**
 * A timeline probe from `rig`: frame 0 must be on screen, then the trigger key and the later
 * keys; the recording runs until the golden's last row has been held as long as it was.
 */
export function timeline(
  id: string,
  rig: Rig,
  trigger: PhoneKey,
  later: readonly Later[] = [],
  { toleranceMs }: Pick<TimelineTolerance, "toleranceMs"> = {},
): void {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const t = golden.triggerFrame as number;
  expectLcd(rig.paint(), goldenImage(id, rows[t - 1]!.image), `${id}: before the trigger`);
  const origin = rows[t]!.startMs;
  const last = rows[rows.length - 1]!;
  const span = last.startMs + last.durationMs - origin + 100;
  const untimedRows = new Set<number>();
  const schedule = later.map(([at, key]) => {
    let atMs: number;
    if (typeof at === "number") atMs = rows[at]!.startMs - origin;
    else if ("ms" in at) atMs = at.ms;
    else {
      untimedRows.add(at.ahead);
      atMs = rows[at.ahead]!.startMs - origin - KEY_TO_REDRAW_MS;
    }
    return { atMs, run: () => rig.press(key) };
  });
  const recording = rig.record(span, () => rig.press(trigger), schedule);
  const context = `${id}: ${trigger}, then ${later.map((l) => l[1]).join(", ")}`;
  expectTimeline(recording, golden, context, {
    untimedRows,
    ...(toleranceMs === undefined ? {} : { toleranceMs }),
  });
}

/** Probe timelines compared within PROBE_TOLERANCE_MS (see the file header). */
export const JITTER = { toleranceMs: PROBE_TOLERANCE_MS } as const;

export const SNAKE = "navi down*7 navi navi wait:7000";

/** Keys on golden rows `from`, `from + 1`, …: one digit each. */
export function digitsAt(from: number, digits: string): Later[] {
  return digits.split("").map((digit, i) => [from + i, digit as PhoneKey] as const);
}
