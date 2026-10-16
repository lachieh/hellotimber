// Plan 21's timings and sounds (docs/plans/21-clock-and-reminders.md Task 3), measured on the
// clock's goldens: the alerts' bell row and the ringing alarm's blink (the bell pictures are the
// `clock/bells-<n>` sprites of resource-inputs/21-clock-and-reminders.ts), the alerts' sound
// programs (one cycle each, looped) and their ascending volume, and the alerts' limits.
//
// Pure: reads goldens only through the injected loaders (extract-resources.ts and the tests).
import { findGoldenImage, LCD_WIDTH, type Golden } from "./golden-format.ts";
import type { SoundGolden, SoundRow } from "./sound-format.ts";
import { programFromRows, type SoundProgramData } from "./sound-programs.ts";

/** The bell row's rectangle (resource-inputs/21-clock-and-reminders.ts `BELLS`). */
export const BELLS = { x0: 5, x1: 78, y0: 26, y1: 35 } as const;
/** The alarm's `Alarm!` and time lines (rows 7-22 between the ladders). */
const RING_TEXT = { x0: 6, x1: 77, y0: 7, y1: 22 } as const;

export interface ClockResourceData {
  /** The bell row: sprite ids in order and the step (the firmware's ≈232 ms timer). */
  readonly bells: { readonly sprites: readonly string[]; readonly stepMs: number };
  /**
   * The ringing alarm: the bell row steps from `bellsFirstMs` after the ring starts; `Alarm!` and
   * the time first show `textFirstMs` after it and then toggle every `textMs` (the lights with
   * them).
   */
  readonly ring: {
    readonly bellsFirstMs: number;
    readonly textFirstMs: number;
    readonly textMs: number;
  };
  /** One cycle of each alert's sound at Level 1, looped; the vibrator as the factory state. */
  readonly programs: Readonly<Record<"countdown" | "reminder" | "alarm", SoundProgramData>>;
  /**
   * The alerts' volume climbs one Ringing volume level (up to the setting's) on the first note
   * that starts at or after `firstMs[alert] + k × stepMs` (k = 0, 1, …) from the sound's start:
   * one timer for the three, fitted to the factory captures' level changes.
   */
  readonly ascend: {
    readonly stepMs: number;
    readonly firstMs: Readonly<Record<"countdown" | "reminder" | "alarm", number>>;
  };
  /** The countdown's sound stops this long after it starts; its screen stays. */
  readonly countdownSoundMs: number;
  /** The alarm rings this long before its automatic snooze. */
  readonly alarmRingMs: number;
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `clock/bells-${i + 1}`);

function rowsOf(golden: Golden) {
  if (!golden.timeline) throw new Error(`${golden.id}: not a timeline`);
  return golden.timeline;
}

function crop(golden: Golden, image: string, r: typeof BELLS | typeof RING_TEXT): string {
  const { pixels } = findGoldenImage(golden, image);
  let out = "";
  for (let y = r.y0; y <= r.y1; y++)
    for (let x = r.x0; x <= r.x1; x++) out += pixels[y * LCD_WIDTH + x] ? "#" : ".";
  return out;
}

const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const round1 = (v: number) => Math.round(v * 10) / 10;

/** The bell pictures' order and step, from the countdown's alert (`clock/countdown/expire-standby`). */
function bellsOf(countdown: Golden): ClockResourceData["bells"] & { readonly crops: string[] } {
  const rows = rowsOf(countdown);
  const crops: string[] = [];
  for (const row of rows.slice(1)) {
    const c = crop(countdown, row.image, BELLS);
    if (crops.includes(c)) break;
    crops.push(c);
  }
  // Every later frame steps through the same cycle; frames of under 40 ms are partial draws.
  const kept = rows.slice(1, -1).filter((row) => {
    const known = crops.includes(crop(countdown, row.image, BELLS));
    if (!known && row.durationMs >= 40) {
      throw new Error(`${countdown.id}: frame ${row.frame} breaks the bell cycle`);
    }
    return known;
  });
  kept.forEach((row, i) => {
    if (crop(countdown, row.image, BELLS) !== crops[i % crops.length]) {
      throw new Error(`${countdown.id}: frame ${row.frame} is out of the bell cycle`);
    }
  });
  const steps = kept.slice(1).map((row, i) => row.startMs - kept[i]!.startMs);
  return { sprites: ids(crops.length), stepMs: round1(mean(steps)), crops };
}

/** The ringing alarm's two timers, from `clock/alarm/ring-factory-standby`. */
function ringOf(ring: Golden, crops: readonly string[]): ClockResourceData["ring"] {
  const rows = rowsOf(ring);
  const start = rows[1]!.startMs;
  const ringing = rows.slice(1).filter((row) => crops.includes(crop(ring, row.image, BELLS)));
  const text = ringing.map((row) => crop(ring, row.image, RING_TEXT).includes("#"));
  const toggles = ringing.filter((_, i) => i > 0 && text[i] !== text[i - 1]).map((r) => r.startMs);
  const bellSteps = ringing.filter(
    (row, i) => i > 0 && crop(ring, row.image, BELLS) !== crop(ring, ringing[i - 1]!.image, BELLS),
  );
  const intervals = toggles.slice(1).map((t, i) => t - toggles[i]!);
  return {
    bellsFirstMs: round1(bellSteps[0]!.startMs - start),
    textFirstMs: round1(toggles[0]! - start),
    textMs: round1(mean(intervals)),
  };
}

/**
 * Where a sound's volume rises: for each rise, the window (previous note start, the rising
 * note's start], from the first note; the golden's first alert only (a second alert starts at
 * Level 1 again: reminder-factory's second alert rose 395 ms later in its sound, UNVERIFIED why).
 */
function riseWindows(golden: SoundGolden): { lo: number; hi: number }[] {
  const notes = golden.rows.filter((r) => r.output === "buzzer" && r.state.kind === "sounding");
  const volume = (r: SoundRow) => (r.state.kind === "sounding" ? r.state.volume : 0);
  const start = notes[0]!.ms;
  const windows: { lo: number; hi: number }[] = [];
  for (let i = 1; i < notes.length; i++) {
    if (volume(notes[i]!) < volume(notes[i - 1]!)) break;
    if (volume(notes[i]!) > volume(notes[i - 1]!)) {
      windows.push({ lo: notes[i - 1]!.ms - start, hi: notes[i]!.ms - start });
    }
  }
  return windows;
}

/**
 * One timer step for every alert and each alert's first rise: the step (whole ms) that leaves
 * the widest feasible first-rise interval in the tightest alert, each first rise its interval's
 * middle.
 */
function ascendOf(
  sounds: Readonly<Record<"countdown" | "reminder" | "alarm", SoundGolden>>,
): ClockResourceData["ascend"] {
  const windows = Object.entries(sounds).map(([name, golden]) => ({
    name,
    rises: riseWindows(golden),
  }));
  let best: { margin: number; stepMs: number; firstMs: Record<string, number> } | undefined;
  for (let stepMs = 3000; stepMs <= 5000; stepMs++) {
    const firstMs: Record<string, number> = {};
    let margin = Infinity;
    for (const { name, rises } of windows) {
      const lo = Math.max(...rises.map((w, k) => w.lo - k * stepMs));
      const hi = Math.min(...rises.map((w, k) => w.hi - k * stepMs));
      margin = Math.min(margin, hi - lo);
      firstMs[name] = Math.round((lo + hi) / 2);
    }
    if (margin > 0 && (best === undefined || margin > best.margin)) {
      best = { margin, stepMs, firstMs };
    }
  }
  if (best === undefined) throw new Error("the alerts' volume rises fit no common step");
  const { countdown, reminder, alarm } = best.firstMs as Record<string, number>;
  return {
    stepMs: best.stepMs,
    firstMs: { countdown: countdown!, reminder: reminder!, alarm: alarm! },
  };
}

/** The sound's first cycle: its first sound to the next sound after a pause, as a program. */
function cycleOf(golden: SoundGolden, id: string): SoundProgramData {
  const sounding = golden.rows.filter((r) => r.output === "buzzer" && r.state.kind === "sounding");
  // A cycle ends at the first gap of 300 ms or more between pulses; the vibrator may switch on
  // a millisecond before a cycle's first pulse.
  let next: number | undefined;
  for (let i = 1; i < sounding.length; i++) {
    if (sounding[i]!.ms - sounding[i - 1]!.ms >= 300) {
      next = sounding[i]!.ms;
      break;
    }
  }
  if (next === undefined) throw new Error(`${golden.id}: no repeat`);
  const leadIn = (pulse: number) =>
    Math.min(
      pulse,
      ...golden.rows
        .filter((r) => r.output === "vibrator" && r.state.kind === "on")
        .map((r) => r.ms)
        .filter((ms) => ms <= pulse && pulse - ms <= 5),
    );
  const first = leadIn(sounding[0]!.ms);
  const end = leadIn(next);
  const rows: SoundRow[] = golden.rows
    .filter((r) => r.ms >= first && r.ms < end && r.output !== "tone")
    .map((r) => ({
      ...r,
      ms: r.ms - first,
      state: r.state.kind === "sounding" ? { ...r.state, volume: 6 } : r.state,
    }));
  // The cycle's end: everything off (the next cycle turns them on again).
  rows.push({ ms: end - first, output: "buzzer", state: { kind: "off" } });
  if (rows.some((r) => r.output === "vibrator" && r.state.kind === "on")) {
    rows.push({ ms: end - first, output: "vibrator", state: { kind: "off" } });
  }
  return { ...programFromRows(id, rows), loopFrom: 0 };
}

export function extractClockResources(
  load: (id: string) => Golden,
  loadSound: (id: string) => SoundGolden,
): ClockResourceData {
  const { crops, ...bells } = bellsOf(load("clock/countdown/expire-standby"));
  const ringGolden = load("clock/alarm/ring-factory-standby");
  const countdownSound = loadSound("sound/clock/countdown-factory");
  const sounds = {
    countdown: countdownSound,
    reminder: loadSound("sound/clock/reminder-factory"),
    alarm: loadSound("sound/clock/alarm-factory"),
  };
  const sounding = countdownSound.rows.filter((r) => r.output === "buzzer");
  const ringRows = rowsOf(ringGolden);
  const ringEnd = ringRows.find(
    (row, i) =>
      i > 1 && row.durationMs >= 1000 && !crops.includes(crop(ringGolden, row.image, BELLS)),
  )!;
  return {
    bells,
    ring: ringOf(ringGolden, crops),
    programs: {
      countdown: cycleOf(sounds.countdown, "clock/countdown"),
      reminder: cycleOf(sounds.reminder, "clock/reminder"),
      alarm: cycleOf(sounds.alarm, "clock/alarm"),
    },
    ascend: ascendOf(sounds),
    countdownSoundMs: round1(sounding[sounding.length - 1]!.ms - sounding[0]!.ms),
    alarmRingMs: round1(ringEnd.startMs - ringRows[1]!.startMs),
  };
}
