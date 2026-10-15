// Plan 25's keyguard in tests: a locked phone, and the keyguard LCD goldens replayed (Task 7).
//
// The keyguard goldens' keys are the captures' `keys.csv` (each golden's note names them): the
// first key is the trigger, aligned on the golden's first changed frame (D11: the firmware's
// key-to-redraw latency is not reproduced). A later key goes down on the tick its effect starts
// in the golden (a golden row), or `ms` after the trigger when its effect is no new frame (a hint
// restarted on its own first step, a second Unlock) or when the window it falls in is what the
// golden pins (`lock-gap/2920`).
import type { PhoneKey } from "@hellotimber/phone-core";
import { expect } from "vite-plus/test";
import type { StockLightEvent } from "../../src/firmware/features/backlight";
import { KEYGUARD_TIMES } from "../../src/firmware/features/keyguard";
import { createSyntheticNetwork, type StockPhoneConfig } from "../../src/index";
import { expectLcd, expectTimeline, PROBE_TOLERANCE_MS } from "./golden.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { deliverAndLand, LIGHT_EDGE_TOLERANCE_MS } from "./lights.ts";
import { seededStorage, standbyRig, type Rig } from "./rig.ts";
import { expectSoundTimeline, loadSoundGolden, playSound } from "./sound.ts";

/** Menu, then `*` this long after it: the captures' lock (`keyguard/lock`). */
const LOCK_STAR_MS = 300;

/** After the lock note, until every LED is off: the light timeout and one light tick (D2). */
const DARK_AFTER_MS = 16_000;

/** After the lock note, with the LEDs still lit from the Menu key-down (`keyguard/lit/*`). */
const LIT_AFTER_MS = 1_000;

/** After the boot, until standby's own light is off. */
const BOOT_DARK_MS = 16_000;

/** A stock phone at a dark standby. */
export function darkStandbyRig(config: Partial<StockPhoneConfig> = {}): Rig {
  const rig = standbyRig(config);
  rig.advance(BOOT_DARK_MS);
  return rig;
}

/** A stock phone at standby, locked with Menu then `*`, its lock note played out. */
export function lockedRig(
  light: "dark" | "lit" = "dark",
  config: Partial<StockPhoneConfig> = {},
): Rig {
  const rig = standbyRig(config);
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
  const lights: StockLightEvent[] = [];
  const config = { lights: { change: (event: StockLightEvent) => void lights.push(event) } };
  const rig = from === "standby" ? darkStandbyRig(config) : lockedRig(from, config);
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
  // D10: each row's `leds` are the lights the phone reported as the frame started (both LEDs
  // switch together: 3 or 0), but at a lights edge within LIGHT_EDGE_TOLERANCE_MS of it.
  const shown = [
    recording.frames[0]!,
    ...recording.frames.filter((frame) => frame.startMs >= recording.triggerMs),
  ];
  const display = lights.filter((event) => event.light === "display");
  const leds = rows.slice(t - 1).map((row, i) => {
    const at = shown[i]!.startMs;
    const near = display.some((event) => Math.abs(event.atMs - at) <= LIGHT_EDGE_TOLERANCE_MS);
    const lit = display.filter((event) => event.atMs <= at).at(-1)?.on ?? false;
    return near ? row.leds : lit ? 3 : 0;
  });
  expect(leds, `${context}: leds by row from frame ${t - 1}`).toEqual(
    rows.slice(t - 1).map((row) => row.leds),
  );
}

/**
 * A keyguard sound golden (D12): the capture's factory phone, dark and its DSP asleep (the
 * script waited for the LEDs to go off), at standby for the lock's note, else locked; then the
 * golden's keys from time 0.
 */
export function keyguardSound(id: string): void {
  const golden = loadSoundGolden(id);
  const config = { storage: seededStorage({ factory: true }) };
  const rig =
    id === "sound/note/keypad-locked" ? darkStandbyRig(config) : lockedRig("dark", config);
  const recorded = playSound(rig, golden);
  expectSoundTimeline(recorded, golden, `${id}: ${golden.note ?? "its keys"}`);
}

// ---------------------------------------------------------------- message arrivals (K7)

/**
 * `keyguard/sms`: an SMS arriving at a dark locked standby shows its notice under the key icon
 * with `Unlock`, and lights nothing (K7).
 */
export function keyguardArrival(id: string): void {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const t = golden.triggerFrame as number;
  const lights: StockLightEvent[] = [];
  const network = createSyntheticNetwork();
  const rig = lockedRig("dark", {
    network,
    lights: { change: (event) => void lights.push(event) },
  });
  expectLcd(rig.paint(), goldenImage(id, rows[t - 1]!.image), `${id}: before the arrival`);
  const last = rows[rows.length - 1]!;
  const span = last.startMs + last.durationMs - rows[t]!.startMs + 100;
  const before = lights.length;
  const recording = rig.record(span, () => deliverAndLand((ms) => rig.advance(ms), network));
  expectTimeline(recording, golden, `${id}: an SMS arriving at a dark locked standby`);
  // D10: dark throughout, as the phone reported it.
  expect(rows.map((row) => row.leds)).toEqual(rows.map(() => 0));
  expect(lights.slice(before), `${id}: the arrival lights nothing`).toEqual([]);
}

/** `keyguard/standby-message`: a received message's notice cleared with C, then locked. */
export function lockedWithMessage(id: string): void {
  const network = createSyntheticNetwork();
  const rig = standbyRig({ network });
  deliverAndLand((ms) => rig.advance(ms), network);
  rig.press("c");
  rig.advance(1000);
  rig.press("navi");
  rig.advance(LOCK_STAR_MS);
  rig.press("*");
  rig.advance(KEYGUARD_TIMES.lockNoteMs + LIT_AFTER_MS);
  expectLcd(
    rig.paint(),
    goldenImage(id, "standby-message"),
    "the locked standby, a message waiting",
  );
}
