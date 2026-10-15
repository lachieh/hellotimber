// Drive the stock clock as plan 21's captures did (`gen_v639_plan21.py`): a phone on a scripted
// host clock, the generator's navigation, and each recording's keys (CLOCK_RECORDINGS) pressed on
// the rows their redraw starts (plan 14 D8: no redraw latency).
import type { PhoneKey } from "@hellotimber/phone-core";
import {
  CLOCK_RECORDINGS,
  type ClockRecording,
} from "../../scripts/capture-sets/21-clock-and-reminders.ts";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import {
  expectLcd,
  expectTimeline,
  lcdMismatch,
  PROBE_TOLERANCE_MS,
  type GoldenImageRef,
  type RecordedTimeline,
} from "./golden.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { frameAt, seededStorage, standbyRig, type Rig } from "./rig.ts";
import { play } from "./calculator.ts";
import { expectSoundTimeline, loadSoundGolden } from "./sound.ts";

export { play };

/** The host's real-time clock, which a scenario moves (the captures' `settime`). */
export interface HostClock {
  clock: string | undefined;
  date: string | undefined;
}

export interface ClockRig {
  readonly rig: Rig;
  readonly host: HostClock;
  readonly storage: StockStorage;
}

/**
 * A phone at standby on a host clock (10:10, 13.10.2026: the captures' setup), virgin or in
 * the factory state (plan 16 D7's image: Restore factory settings, Phone security Off).
 */
export function clockRig(
  options: {
    readonly state?: "virgin" | "factory";
    readonly clock?: string | undefined;
    readonly date?: string | undefined;
    readonly storage?: StockStorage;
  } = {},
): ClockRig {
  const host: HostClock = {
    clock: "clock" in options ? options.clock : "10:10",
    date: "date" in options ? options.date : "13.10.2026",
  };
  const storage =
    options.storage ??
    (options.state === "factory" ? seededStorage({ factory: true }) : createMemoryStorage());
  const rig = standbyRig({ clock: () => host.clock, date: () => host.date, storage });
  return { rig, host, storage };
}

/** The settle the generator leaves after navigating (its `idle` and the indicator's window). */
const SETTLE = "+3500";

/** Standby → Clock on page `page` (0 Alarm clock … 5 Auto update). */
export function toClock(rig: Rig, page = 0): void {
  play(rig, `menu +300 up up +2000 menu +1500 ${"down ".repeat(page)}${SETTLE}`);
}

/** Standby → Clock settings on `row` (0 Hide/Show clock, 1 Set the time, 2 Time format). */
export function toClockSettings(rig: Rig, row = 0): void {
  toClock(rig, 1);
  play(rig, `menu +1500 ${"down ".repeat(row)}${SETTLE}`);
}

/** Standby → Reminders on `row`. */
export function toReminders(rig: Rig, row = 0): void {
  play(rig, `menu +300 up up up +2000 menu +1500 ${"down ".repeat(row)}${SETTLE}`);
}

/** Standby → the alarm set to `hhmm` (the generator's `set_alarm`) → standby. */
export function setAlarm(rig: Rig, hhmm: string): void {
  toClock(rig, 0);
  play(rig, "menu +2500");
  const screen = rig.phone.screen;
  if (screen.kind !== "custom") throw new Error("Alarm clock opened no prompt or list.");
  if (rig.paint().pixels.length > 0 && isOnOffList(rig)) play(rig, "menu +2500");
  play(rig, `${hhmm.split("").join(" ")} menu +4000`);
  toStandby(rig);
}

/** Whether the screen is the alarm's On/Off rows (its soft key OK over two rows). */
function isOnOffList(rig: Rig): boolean {
  // The prompt draws a box from y 16; the rows do not.
  const pixels = rig.paint().pixels;
  let row = 0;
  for (let x = 0; x < 84; x++) row += pixels[36 * 84 + x]!;
  return row < 80;
}

/** Advances `rig` until it shows `image` (at most `maxMs`; throws if it never does). */
export function untilShows(rig: Rig, image: GoldenImageRef, maxMs = 10_000): void {
  for (let t = 0; t <= maxMs; t++) {
    if (lcdMismatch(rig.paint().pixels, image, "") === undefined) return;
    rig.advance(1);
  }
  throw new Error(`${image.id} ${image.image.name} was never shown within ${maxMs} ms.`);
}

/** Any screen → standby (C held, as the generator's `to_standby`). */
export function toStandby(rig: Rig): void {
  play(rig, "c@1500 +1500");
}

const KEY_NAMES: Readonly<Record<string, PhoneKey>> = { menu: "navi" };
const phoneKey = (key: string): PhoneKey => KEY_NAMES[key] ?? (key as PhoneKey);

/** A key longer than a tap (C held): the harness's taps are 60 ms. */
const HELD_MS = 100;
/** When a key's redraw is not seen (it changed nothing), it is pressed this long after key-down. */
const LATENCY_MS = 55;

export function recordingOf(id: string): ClockRecording {
  const found = CLOCK_RECORDINGS.find((r) => r.id === id);
  if (found === undefined) throw new Error(`No plan 21 recording ${id}.`);
  return found;
}

/**
 * Plays recording `id`'s keys on `rig` (set up on its parent screen) and compares the golden:
 * frame 0 before the trigger, then every row from the trigger. Keys go down on the row their
 * redraw starts (a tap is pressed there; a held key is held for its hold); `before-recording`
 * goldens (the keys wait for a prompt's blink) start recording so the blink falls on row 1.
 * `edge` moves the host clock to that minute on the trigger instead of a key.
 */
export function clockScenario(
  id: string,
  rig: Rig,
  options: {
    readonly toleranceMs?: number;
    /**
     * Compare at each golden frame's middle instead of frame by frame (`sampleTimeline`): for
     * the ring, whose bell and text timers redraw together or 10-20 ms apart by chance.
     */
    readonly sampled?: boolean;
    readonly edge?: {
      readonly host: HostClock;
      readonly clock: string;
      readonly date?: string;
      /** Later minutes the host's clock moves to, ms after the trigger (`run_synced`'s settime). */
      readonly later?: readonly { readonly atMs: number; readonly clock: string }[];
    };
  } = {},
): void {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const recording = recordingOf(id);
  const keys = recording.keys.map(([key, down, hold]) => ({ key: phoneKey(key), down, hold }));
  const before = golden.triggerFrame === "before-recording";
  const triggerRow = before ? 1 : (golden.triggerFrame as number);
  // Before-recording: the recording starts frame 0's duration before its first change.
  const origin = rows[triggerRow]!.startMs - (before ? Math.round(rows[0]!.durationMs) : 0);
  // Without a key, the trigger is the clock's minute edge (or the recording's first change).
  const keyed = !before && options.edge === undefined && keys.length > 0;
  const later = keyed ? keys.slice(1) : keys;
  if (before) alignOnNextChange(rig, rows[0]!.durationMs, goldenImage(id, rows[0]!.image));
  else expectLcd(rig.paint(), goldenImage(id, rows[0]!.image), `${id}: before the trigger`);
  const schedule = later.flatMap(({ key, down, hold }) => {
    const row = rows.find((r) => r.startMs > down && r.startMs <= down + 150);
    const at = Math.max(1, Math.round((row?.startMs ?? down + LATENCY_MS) - origin));
    if (hold <= HELD_MS) return [{ atMs: at, run: () => rig.press(key) }];
    const down0 = Math.max(1, Math.round(down - origin));
    return [
      { atMs: down0, run: () => rig.hold(key) },
      { atMs: down0 + Math.round(hold), run: () => rig.release(key) },
    ];
  });
  const edge = options.edge;
  for (const { atMs, clock } of edge?.later ?? []) {
    schedule.push({ atMs, run: () => (edge!.host.clock = clock) });
  }
  const first = keys[0];
  if (keyed && first !== undefined && first.hold > HELD_MS) {
    schedule.push({ atMs: Math.round(first.hold), run: () => rig.release(first.key) });
  }
  const last = rows[rows.length - 1]!;
  const span = last.startMs + last.durationMs - origin + 100;
  const trigger = (): void => {
    if (options.edge !== undefined) {
      options.edge.host.clock = options.edge.clock;
      if (options.edge.date !== undefined) options.edge.host.date = options.edge.date;
    } else if (keyed && first !== undefined) {
      if (first.hold > HELD_MS) rig.hold(first.key);
      else rig.press(first.key);
    }
  };
  const recorded = before
    ? rig.record(span, undefined, schedule)
    : rig.record(span, trigger, schedule);
  const context = `${id}: ${keys.map((k) => `${k.key}@${k.down}`).join(" ") || "no keys"}`;
  if (options.sampled) {
    sampleTimeline(recorded, id, origin, context);
    return;
  }
  expectTimeline(recorded, golden, context, {
    toleranceMs: options.toleranceMs ?? PROBE_TOLERANCE_MS,
  });
}

/**
 * Checks `recorded` against golden `id` at the middle of every golden frame at least
 * 2 × PROBE_TOLERANCE_MS long (rows timed from `origin`, the trigger's): each must show that
 * frame's image there. Frames split or merged by a few ms pass; a drift or a wrong picture
 * longer than the tolerance does not.
 */
function sampleTimeline(
  recorded: RecordedTimeline,
  id: string,
  origin: number,
  context: string,
): void {
  const rows = loadGolden(id).timeline!;
  const failures: string[] = [];
  let checked = 0;
  for (const [i, row] of rows.entries()) {
    if (i === 0 || row.durationMs < 2 * PROBE_TOLERANCE_MS) continue;
    const at = row.startMs + row.durationMs / 2 - origin;
    const shown = frameAt(recorded, recorded.triggerMs + at);
    checked++;
    const mismatch = lcdMismatch(shown.pixels, goldenImage(id, row.image), `${context} row ${i}`);
    if (mismatch !== undefined) failures.push(`row ${i} (${row.image} at ${at.toFixed(0)} ms)`);
    if (failures.length === 1 && mismatch !== undefined) failures.push(mismatch);
  }
  if (failures.length > 0) {
    throw new Error(
      `Sampled timeline mismatch: ${id}: ${failures.length - 1} of ${checked} frames\n${failures.join("\n")}`,
    );
  }
}

/**
 * Advances `rig` so that its screen's next change comes `leadMs` from now: waits for a change
 * (a cursor blink edge) to the recording's first image `first`, then for the blink's step less
 * `leadMs` (the captures' blink steps are ≈480 ms).
 */
function alignOnNextChange(rig: Rig, leadMs: number, first: GoldenImageRef): void {
  const pixels = () => rig.paint().pixels;
  const changed = (from: Uint8Array) => !pixels().every((v, j) => v === from[j]);
  for (let edges = 0; edges < 3; edges++) {
    const from = pixels();
    for (let i = 0; i < 2000 && !changed(from); i++) rig.advance(1);
    if (lcdMismatch(pixels(), first, "") === undefined) break;
  }
  rig.advance(Math.max(0, 480 - Math.round(leadMs)));
}

/**
 * Sound golden `id` (an alert's sound) from `rig`: `trigger` runs `atMs` after time 0 (the
 * capture's minute edge or expiry, just before the golden's first event), then the golden's
 * rows play out; compared as plan 16's goldens are, its later passes within PASS_DRIFT (`drift`:
 * every edge, the golden being another recording than the program's).
 */
export function clockSound(
  id: string,
  rig: Rig,
  trigger: () => void,
  options: { readonly atMs?: number; readonly cycleMs?: number; readonly drift?: boolean } = {},
): void {
  const golden = loadSoundGolden(id);
  const origin = rig.now;
  const seen = rig.sounds.length;
  rig.advance(options.atMs ?? Math.max(0, golden.rows[0]!.ms - 1));
  trigger();
  rig.advance(origin + golden.rows.at(-1)!.ms + 500 - rig.now);
  expectSoundTimeline(
    { originMs: origin, endMs: rig.now, events: rig.sounds.slice(seen) },
    golden,
    `${id}: ${golden.note ?? ""}`,
    {
      ...(options.cycleMs === undefined ? {} : { cycleMs: options.cycleMs }),
      ...(options.drift ? { drift: true } : {}),
    },
  );
}
