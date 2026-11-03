// Drive the stock clock as plan 21's captures did (`gen_v639_plan21.py`): a phone on a scripted
// host clock, the generator's navigation, and each recording's keys (CLOCK_RECORDINGS) pressed on
// the rows their redraw starts (plan 14 D8: no redraw latency).
import type { PhoneKey } from "@hellotimber/phone-core";
import {
  CLOCK_RECORDINGS,
  type ClockRecording,
} from "../../scripts/capture-sets/21-clock-and-reminders.ts";
import { Framebuffer, textWidth } from "@hellotimber/phone-screen";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import { STOCK_FONTS } from "../../src/kit/ui/resources";
import { LCD_HEIGHT, LCD_WIDTH } from "../../scripts/golden-format.ts";
import {
  expectLcd,
  expectTimeline,
  lcdMismatch,
  TWO_FRAMES_MS,
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
    /** No T9 dictionary (`t9: {}`): the editor in multi-tap, as the plan21 captures show it. */
    readonly multitap?: boolean;
  } = {},
): ClockRig {
  const host: HostClock = {
    clock: "clock" in options ? options.clock : "10:10",
    date: "date" in options ? options.date : "13.10.2026",
  };
  const storage =
    options.storage ??
    (options.state === "factory" ? seededStorage({ factory: true }) : createMemoryStorage());
  const rig = standbyRig({
    clock: () => host.clock,
    date: () => host.date,
    storage,
    ...(options.multitap ? { t9: {} } : {}),
  });
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

/**
 * Standby → Reminders › Add new → the text (`text`: multi-tap keys 1.6 s apart) → Alarm on
 * (`date` typed over today's, then `hhmm`) or Alarm off → standby (the generator's
 * `add_reminder`).
 */
export function addReminder(
  rig: Rig,
  options: {
    readonly text?: string;
    readonly alarm?: boolean;
    readonly date?: string;
    readonly hhmm?: string;
  } = {},
): void {
  const { text = "2", alarm = true, date, hhmm = "1011" } = options;
  toReminders(rig, 0);
  play(rig, "menu +2500");
  for (const key of text.split(" ")) play(rig, `${key} +1600`);
  play(rig, "menu +2000");
  if (alarm) {
    play(rig, "menu +2500");
    if (date !== undefined) play(rig, date.split("").join(" "));
    play(rig, `menu +2500 ${hhmm.split("").join(" ")} menu +4000`);
  } else play(rig, "down +1000 menu +4000");
  toStandby(rig);
}

/** Standby → Reminders › Erase › All › Yes → standby (the generator's `erase_all`). */
export function eraseAllReminders(rig: Rig): void {
  toReminders(rig, 0);
  play(rig, "down down menu +1500 down +800 menu +1500 menu +5000");
  toStandby(rig);
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

/**
 * Any screen → standby (C held, as the generator's `to_standby`; again while the kernel's C held
 * only left an application for its menu level).
 */
export function toStandby(rig: Rig): void {
  for (let i = 0; i < 3; i++) {
    play(rig, "c@1500 +1500");
    if (rig.phone.screen.kind === "standby") return;
  }
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
    /**
     * Compare at each golden frame's middle instead of frame by frame (`sampleTimeline`): for
     * the ring, whose bell and text timers redraw together or 10-20 ms apart by chance.
     */
    readonly sampled?: boolean;
    /**
     * Sampled, and a running stopwatch's digits may differ by STOPWATCH_TOLERANCE_MS (D5's
     * deviation: v6.39 adds 0.1 s every ≈93 ms and resynchronises with its RTC).
     */
    readonly stopwatch?: boolean;
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
  else if (options.stopwatch) {
    const failure = stopwatchMismatch(rig.paint().pixels, goldenImage(id, rows[0]!.image));
    if (failure !== undefined) throw new Error(`${id}: before the trigger: ${failure}`);
  } else expectLcd(rig.paint(), goldenImage(id, rows[0]!.image), `${id}: before the trigger`);
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
  if (options.sampled || options.stopwatch) {
    sampleTimeline(recorded, id, origin, context, options.stopwatch === true);
    return;
  }
  expectTimeline(recorded, golden, context);
}

/**
 * Checks `recorded` against golden `id` at the middle of every golden frame at least
 * 2 × TWO_FRAMES_MS long (rows timed from `origin`, the trigger's): each must show that
 * frame's image there. Frames split or merged by a few ms pass; a drift or a wrong picture
 * longer than the tolerance does not.
 */
function sampleTimeline(
  recorded: RecordedTimeline,
  id: string,
  origin: number,
  context: string,
  stopwatch = false,
): void {
  const rows = loadGolden(id).timeline!;
  const failures: string[] = [];
  let checked = 0;
  for (const [i, row] of rows.entries()) {
    if (i === 0 || row.durationMs < 2 * TWO_FRAMES_MS) continue;
    const at = row.startMs + row.durationMs / 2 - origin;
    const shown = frameAt(recorded, recorded.triggerMs + at);
    checked++;
    const mismatch = stopwatch
      ? stopwatchMismatch(shown.pixels, goldenImage(id, row.image))
      : lcdMismatch(shown.pixels, goldenImage(id, row.image), `${context} row ${i}`);
    if (mismatch !== undefined) failures.push(`row ${i} (${row.image} at ${at.toFixed(0)} ms)`);
    if (failures.length === 1 && mismatch !== undefined) failures.push(mismatch);
  }
  if (failures.length > 0) {
    throw new Error(
      `Sampled timeline mismatch: ${id}: ${failures.length - 1} of ${checked} frames\n${failures.join("\n")}`,
    );
  }
}

/** A prompt cursor's blink step (≈480 ms in every capture). */
const BLINK_MS = 480;

/**
 * A recording whose keys meet a prompt's cursor blink (the blink runs on through the keys, so
 * the blink, not the first key's redraw, fixes the timing): `rig` is synchronised so that its
 * next blink edge comes when golden row `edgeRow` starts, and key i goes down on the tick golden
 * row `keyRows[i]` starts (its redraw: the key-to-redraw latency is not reproduced). Compared
 * from the first change, as `before-recording` goldens are.
 */
export function blinkScenario(
  id: string,
  rig: Rig,
  edgeRow: number,
  keyRows: readonly number[],
): void {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const recording = recordingOf(id);
  const start = rows[0]!.startMs - 1;
  const at = (row: number) => Math.round(rows[row]!.startMs - start);
  // Wait for a blink edge (any change), then until the next one is `at(edgeRow)` ms away.
  const from = rig.paint().pixels;
  for (let i = 0; i < 2 * BLINK_MS && rig.paint().pixels.every((v, j) => v === from[j]); i++) {
    rig.advance(1);
  }
  rig.advance((((BLINK_MS - at(edgeRow)) % BLINK_MS) + BLINK_MS) % BLINK_MS);
  // The edge must leave the cursor as frame 0 shows it: else wait a step more.
  if (lcdMismatch(rig.paint().pixels, goldenImage(id, rows[0]!.image), "") !== undefined) {
    rig.advance(BLINK_MS);
  }
  const schedule = recording.keys.map(([key], i) => ({
    atMs: Math.max(1, at(keyRows[i]!)),
    run: () => rig.press(phoneKey(key)),
  }));
  const last = rows[rows.length - 1]!;
  const recorded = rig.record(last.startMs + last.durationMs - start + 100, undefined, schedule);
  const keys = recording.keys.map(([key, down]) => `${key}@${down}`).join(" ");
  expectTimeline(recorded, { ...golden, triggerFrame: "before-recording" }, `${id}: ${keys}`);
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
 * rows play out; compared by the fidelity standard (tests/support/sound.ts).
 */
export function clockSound(
  id: string,
  rig: Rig,
  trigger: () => void,
  options: { readonly atMs?: number } = {},
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
  );
}

/** How far a running stopwatch's digits may be from the golden's (D5's deviation). */
export const STOPWATCH_TOLERANCE_MS = 250;

/** The stopwatch's digit row (the large face, top 15). */
const DIGITS = { y0: 15, y1: 25 } as const;

/** The time a stopwatch screen shows (`h:mm:ss.cc`), read digit by digit; undefined if none. */
export function readStopwatch(pixels: Uint8Array): number | undefined {
  const font = STOCK_FONTS.large;
  const zero = "0:00:00.00";
  const left = Math.floor((LCD_WIDTH - textWidth(font, zero)) / 2);
  const digits: number[] = [];
  for (let p = 0; p < zero.length; p++) {
    if (zero[p] !== "0") continue;
    const x0 = left + textWidth(font, zero.slice(0, p));
    const x1 = left + textWidth(font, zero.slice(0, p + 1));
    let found: number | undefined;
    for (let d = 0; d <= 9 && found === undefined; d++) {
      const fb = new Framebuffer();
      fb.drawTextCentered(font, zero.slice(0, p) + d + zero.slice(p + 1), DIGITS.y0);
      let same = true;
      for (let y = DIGITS.y0; y <= DIGITS.y1 && same; y++) {
        for (let x = x0; x < x1 && same; x++) {
          same = fb.pixels[y * LCD_WIDTH + x] === pixels[y * LCD_WIDTH + x];
        }
      }
      if (same) found = d;
    }
    if (found === undefined) return undefined;
    digits.push(found);
  }
  const [h, m1, m2, s1, s2, c1, c2] = digits as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return ((h * 60 + m1 * 10 + m2) * 60 + s1 * 10 + s2) * 1000 + (c1 * 10 + c2) * 10;
}

/**
 * Why `actual` is not `golden` beyond a stopwatch's digits within STOPWATCH_TOLERANCE_MS, or
 * undefined: every pixel outside the digit row the same, both digit rows readable and close.
 */
export function stopwatchMismatch(actual: Uint8Array, golden: GoldenImageRef): string | undefined {
  const exact = lcdMismatch(actual, golden, golden.id);
  if (exact === undefined) return undefined;
  const want = golden.image.pixels;
  for (let y = 0; y < LCD_HEIGHT; y++) {
    if (y >= DIGITS.y0 && y <= DIGITS.y1) continue;
    for (let x = 0; x < LCD_WIDTH; x++) {
      if (actual[y * LCD_WIDTH + x] !== want[y * LCD_WIDTH + x]) return exact;
    }
  }
  const shown = readStopwatch(actual);
  const expected = readStopwatch(want);
  if (shown === undefined || expected === undefined) return exact;
  const delta = shown - expected;
  return Math.abs(delta) <= STOPWATCH_TOLERANCE_MS
    ? undefined
    : `the stopwatch shows ${shown} ms, the golden ${expected} ms (Δ ${delta})`;
}
