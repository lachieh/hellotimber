// Plan 25's keyguard in tests: a locked phone, and the keyguard LCD goldens replayed (Task 7).
//
// The keyguard goldens' keys are the captures' `keys.csv` (each golden's note names them): the
// first key is the trigger, aligned on the golden's first changed frame (D11: the firmware's
// key-to-redraw latency is not reproduced). A later key goes down on the tick its effect starts
// in the golden (a golden row), or `ms` after the trigger when its effect is no new frame (a hint
// restarted on its own first step, a second Unlock) or when the window it falls in is what the
// golden pins (`lock-gap/2920`).
import type { PhoneKey } from "@hellotimber/phone-core";
import { KEYGUARD_TIMES } from "../../src/firmware/features/keyguard";
import { expectLcd, expectTimeline, PROBE_TOLERANCE_MS } from "./golden.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { standbyRig, type Rig } from "./rig.ts";

/** Menu, then `*` this long after it: the captures' lock (`keyguard/lock`). */
const LOCK_STAR_MS = 300;

/** After the lock note, until every LED is off: the light timeout and one light tick (D2). */
const DARK_AFTER_MS = 16_000;

/** After the lock note, with the LEDs still lit from the Menu key-down (`keyguard/lit/*`). */
const LIT_AFTER_MS = 1_000;

/** A stock phone at standby, locked with Menu then `*`, its lock note played out. */
export function lockedRig(light: "dark" | "lit" = "dark"): Rig {
  const rig = standbyRig();
  rig.press("navi");
  rig.advance(LOCK_STAR_MS);
  rig.press("*");
  rig.advance(KEYGUARD_TIMES.lockNoteMs + (light === "dark" ? DARK_AFTER_MS : LIT_AFTER_MS));
  return rig;
}

/** A key of a keyguard golden: when it goes down, which key, how long it is held (default 0). */
export type KeyguardKey = readonly [
  at: number | { readonly ms: number },
  key: PhoneKey,
  holdMs?: number,
];

export interface KeyguardCase {
  /** The phone before the trigger: at standby, or locked with the LEDs dark or lit. */
  readonly from: "standby" | "dark" | "lit";
  /** The first key and how long it is held. */
  readonly trigger: readonly [key: PhoneKey, holdMs?: number];
  readonly later?: readonly KeyguardKey[];
  /**
   * Compare frame starts within PROBE_TOLERANCE_MS (default: when keys follow the trigger, plan
   * 14's rule): the firmware runs those keys' timers from redraws whose latency differs from the
   * trigger's, and replays its notes with spreads of 5-15 ms a step.
   */
  readonly jitter?: boolean;
}

/** Replays `keyguardCase` and compares it with the timeline golden `id`. */
export function keyguardTimeline(id: string, keyguardCase: KeyguardCase): void {
  const { from, trigger, later = [], jitter = later.length > 0 } = keyguardCase;
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const t = golden.triggerFrame as number;
  const rig = from === "standby" ? standbyRig() : lockedRig(from);
  expectLcd(rig.paint(), goldenImage(id, rows[t - 1]!.image), `${id}: before the trigger`);
  const origin = rows[t]!.startMs;
  const last = rows[rows.length - 1]!;
  const span = last.startMs + last.durationMs - origin + 100;
  const [key, holdMs = 0] = trigger;
  // Every release after the trigger runs on its tick, the trigger's own included.
  const schedule = [{ atMs: holdMs, run: () => rig.release(key) }];
  for (const [at, laterKey, laterHoldMs = 0] of later) {
    const atMs = typeof at === "number" ? rows[at]!.startMs - origin : at.ms;
    schedule.push({ atMs, run: () => rig.hold(laterKey) });
    schedule.push({ atMs: atMs + laterHoldMs, run: () => rig.release(laterKey) });
  }
  const recording = rig.record(span, () => rig.hold(key), schedule);
  const context = `${id}: ${[key, ...later.map((l) => l[1])].join(", ")} from a ${from} phone`;
  expectTimeline(recording, golden, context, jitter ? { toleranceMs: PROBE_TOLERANCE_MS } : {});
}
