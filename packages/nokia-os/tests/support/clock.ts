// Drive the stock clock as plan 21's captures did (`gen_v639_plan21.py`): a phone on a scripted
// host clock, the generator's navigation, and each recording's keys (CLOCK_RECORDINGS) pressed on
// the rows their redraw starts (plan 14 D8: no redraw latency).
import type { PhoneKey } from "@hellotimber/phone-core";
import {
  CLOCK_RECORDINGS,
  type ClockRecording,
} from "../../scripts/capture-sets/21-clock-and-reminders.ts";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import { expectLcd, expectTimeline, PROBE_TOLERANCE_MS } from "./golden.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { seededStorage, standbyRig, type Rig } from "./rig.ts";
import { play } from "./calculator.ts";

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
    readonly edge?: { readonly host: HostClock; readonly clock: string; readonly date?: string };
  } = {},
): void {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const recording = recordingOf(id);
  const keys = recording.keys.map(([key, down, hold]) => ({ key: phoneKey(key), down, hold }));
  const before = golden.triggerFrame === "before-recording";
  const triggerRow = before ? 1 : (golden.triggerFrame as number);
  const origin = rows[triggerRow]!.startMs;
  // Without a key, the trigger is the clock's minute edge (or the recording's first change).
  const keyed = !before && options.edge === undefined && keys.length > 0;
  const later = keyed ? keys.slice(1) : keys;
  if (before) alignOnNextChange(rig, rows[0]!.durationMs);
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
  expectTimeline(
    recorded,
    golden,
    `${id}: ${keys.map((k) => `${k.key}@${k.down}`).join(" ") || "no keys"}`,
    { toleranceMs: options.toleranceMs ?? PROBE_TOLERANCE_MS },
  );
}

/**
 * Advances `rig` so that its screen's next change comes `leadMs` from now: waits for one change
 * (a cursor blink edge), then for the blink's step less `leadMs` (the captures' blink steps are
 * ≈480 ms).
 */
function alignOnNextChange(rig: Rig, leadMs: number): void {
  const pixels = () => rig.paint().pixels;
  const start = pixels();
  for (let i = 0; i < 2000 && pixels().every((v, j) => v === start[j]); i++) rig.advance(1);
  rig.advance(Math.max(0, 480 - Math.round(leadMs)));
}
