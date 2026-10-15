// Plan 21's goldens (docs/plans/21-clock-and-reminders.md "Golden pipeline additions"; paths under
// plan21/): the clock's, the alarm's, the timers' and Reminders' recordings, stills and sound
// goldens. Ids are `clock/<section>/<name>` and `reminders/<name>` after the capture's directory.
// Each golden is `pending:21` until a task's scenario passes (ASSERTED); Task 12 asserts the last.
//
// Pure: imports only sibling scripts, reads captures through the injected io.
import type { CaptureIo, CaptureSetEntry, PlanCaptureSet, ShotFile } from "../capture-set.ts";
import type { GoldenStatus, TriggerFrame } from "../golden-format.ts";
import { resources } from "../resource-inputs/21-clock-and-reminders.ts";
import { buildSoundGolden, type SoundCaptureEntry } from "../sound-capture-set.ts";
import type { SoundGolden } from "../sound-format.ts";

/**
 * One recording (Task 0, `gen_v639_plan21.py`): the keys as the harness pressed them, `[key,
 * down ms from the recording's start, held ms]` (`<dir>/keys.csv`, transcribed). Harness keys:
 * `menu` is Navi, `power` the power key.
 */
export interface ClockRecording {
  readonly id: string;
  /** Under plan21/. */
  readonly dir: string;
  readonly keys: readonly (readonly [key: string, downMs: number, holdMs: number])[];
}

/** Goldens whose scenarios pass (each task adds its own): asserted; every other is pending:21. */
export const ASSERTED: readonly RegExp[] = [
  // Task 7: Clock settings, Date setting, no time, Auto update's list
  /^clock\/(settings|date)\//,
  /^clock\/no-time\/(screens|clock-pages|date|auto-update|clock-settings|set-time)$/,
  /^clock\/auto-update\/(open|list|choose-.*)$/,
  // Task 8: the alarm clock
  /^clock\/alarm\/(prompt|set|on-off-open|on|change|on-c|off|on-off-c|off-prompt|on-off|screens)$/,
  /^clock\/alarm\/shortcut-/,
  /^sound\/clock\/alarm-/,
  // Task 9: the countdown timer
  /^clock\/countdown\//,
  /^clock\/no-time\/countdown$/,
  /^sound\/clock\/countdown-/,
  // Task 10: the stopwatch
  /^clock\/stopwatch\//,
  /^clock\/no-time\/stopwatch$/,
  /^clock\/countdown\/expire-elsewhere-stopwatch-standby$/,
  /^clock\/alarm\/ring-(factory|virgin)-(standby|key-.*|snooze-stop|screens)$/,
  /^clock\/alarm\/ring-elsewhere-(menu-page|(menu-page|menu-list|editor|snake)-standby)$/,
  /^clock\/alarm\/ring-(factory|virgin)-(auto-)?resnooze$/,
];

/**
 * Goldens another plan's behaviour decides: the power key's profile list (plan 17) shows before
 * the long press switches the phone off.
 */
export const PENDING_ELSEWHERE: Readonly<Record<string, GoldenStatus>> = {
  "clock/alarm/power-off": "pending:17",
  "clock/stopwatch/power-off": "pending:17",
};

export function statusOf(id: string): GoldenStatus {
  const elsewhere = PENDING_ELSEWHERE[id];
  if (elsewhere !== undefined) return elsewhere;
  return ASSERTED.some((pattern) => pattern.test(id)) ? "asserted" : "pending:21";
}

/**
 * Recordings that start on a prompt and wait for its cursor's next blink before their keys
 * (`entry` without an opener): the first change is the blink, not a key.
 */
const IN_PROMPT =
  /^(clock\/alarm\/change|clock\/countdown\/change-keys|reminders\/add-(date|time)-(?!open|c$).*|reminders\/add-save)$/;

/**
 * Recordings imported up to a frame (inclusive): the stopwatch's first 15 s of its 60 s run (the
 * same ≈93 ms cadence throughout, 650 distinct frames).
 */
export const CLOCK_CUTS: Readonly<Record<string, number>> = { "clock/stopwatch/run": 160 };

export function triggerOf(recording: ClockRecording): TriggerFrame {
  return IN_PROMPT.test(recording.id) ? "before-recording" : 1;
}

export const CLOCK_RECORDINGS: readonly ClockRecording[] = [
  {
    id: "clock/alarm/change",
    dir: "alarm/change",
    keys: [
      ["1", 400.1, 60.0],
      ["2", 880.1, 60.0],
      ["3", 1360.2, 60.0],
      ["4", 1840.3, 60.0],
      ["menu", 2320.3, 60.0],
    ],
  },
  {
    id: "clock/alarm/off",
    dir: "alarm/off",
    keys: [
      ["down", 0.0, 60.0],
      ["menu", 1500.2, 60.0],
    ],
  },
  { id: "clock/alarm/off-prompt", dir: "alarm/off-prompt", keys: [["menu", 0.0, 60.0]] },
  { id: "clock/alarm/on", dir: "alarm/on", keys: [["menu", 0.0, 60.0]] },
  {
    id: "clock/alarm/on-c",
    dir: "alarm/on-c",
    keys: [
      ["menu", 0.0, 60.0],
      ["c", 2500.3, 60.0],
    ],
  },
  { id: "clock/alarm/on-off-c", dir: "alarm/on-off-c", keys: [["c", 0.0, 60.0]] },
  { id: "clock/alarm/on-off-open", dir: "alarm/on-off-open", keys: [["menu", 0.0, 60.0]] },
  { id: "clock/alarm/power-off", dir: "alarm/power-off", keys: [["power", 0.0, 1800.3]] },
  { id: "clock/alarm/prompt", dir: "alarm/prompt", keys: [["menu", 0.0, 60.0]] },
  {
    id: "clock/alarm/ring-elsewhere-editor-standby",
    dir: "alarm/ring-elsewhere-editor-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "clock/alarm/ring-elsewhere-menu-list-standby",
    dir: "alarm/ring-elsewhere-menu-list-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  { id: "clock/alarm/ring-elsewhere-menu-page", dir: "alarm/ring-elsewhere-menu-page", keys: [] },
  {
    id: "clock/alarm/ring-elsewhere-menu-page-standby",
    dir: "alarm/ring-elsewhere-menu-page-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "clock/alarm/ring-elsewhere-snake-standby",
    dir: "alarm/ring-elsewhere-snake-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "clock/alarm/ring-factory-auto-resnooze",
    dir: "alarm/ring-factory-auto-resnooze",
    keys: [],
  },
  {
    id: "clock/alarm/ring-factory-key-5",
    dir: "alarm/ring-factory-key-5",
    keys: [["5", 0.0, 60.0]],
  },
  {
    id: "clock/alarm/ring-factory-key-c",
    dir: "alarm/ring-factory-key-c",
    keys: [["c", 0.0, 60.0]],
  },
  {
    id: "clock/alarm/ring-factory-key-c-held",
    dir: "alarm/ring-factory-key-c-held",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "clock/alarm/ring-factory-key-hash",
    dir: "alarm/ring-factory-key-hash",
    keys: [["#", 0.0, 60.0]],
  },
  {
    id: "clock/alarm/ring-factory-key-snooze",
    dir: "alarm/ring-factory-key-snooze",
    keys: [["menu", 0.0, 60.0]],
  },
  {
    id: "clock/alarm/ring-factory-key-up",
    dir: "alarm/ring-factory-key-up",
    keys: [["up", 0.0, 60.0]],
  },
  { id: "clock/alarm/ring-factory-resnooze", dir: "alarm/ring-factory-resnooze", keys: [] },
  {
    id: "clock/alarm/ring-factory-snooze-stop",
    dir: "alarm/ring-factory-snooze-stop",
    keys: [["menu", 0.0, 60.0]],
  },
  { id: "clock/alarm/ring-factory-standby", dir: "alarm/ring-factory-standby", keys: [] },
  { id: "clock/alarm/ring-virgin-auto-resnooze", dir: "alarm/ring-virgin-auto-resnooze", keys: [] },
  { id: "clock/alarm/ring-virgin-key-5", dir: "alarm/ring-virgin-key-5", keys: [["5", 0.0, 60.0]] },
  { id: "clock/alarm/ring-virgin-key-c", dir: "alarm/ring-virgin-key-c", keys: [["c", 0.0, 60.0]] },
  {
    id: "clock/alarm/ring-virgin-key-c-held",
    dir: "alarm/ring-virgin-key-c-held",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "clock/alarm/ring-virgin-key-hash",
    dir: "alarm/ring-virgin-key-hash",
    keys: [["#", 0.0, 60.0]],
  },
  {
    id: "clock/alarm/ring-virgin-key-snooze",
    dir: "alarm/ring-virgin-key-snooze",
    keys: [["menu", 0.0, 60.0]],
  },
  {
    id: "clock/alarm/ring-virgin-key-up",
    dir: "alarm/ring-virgin-key-up",
    keys: [["up", 0.0, 60.0]],
  },
  { id: "clock/alarm/ring-virgin-resnooze", dir: "alarm/ring-virgin-resnooze", keys: [] },
  {
    id: "clock/alarm/ring-virgin-snooze-stop",
    dir: "alarm/ring-virgin-snooze-stop",
    keys: [["menu", 0.0, 60.0]],
  },
  { id: "clock/alarm/ring-virgin-standby", dir: "alarm/ring-virgin-standby", keys: [] },
  {
    id: "clock/alarm/set",
    dir: "alarm/set",
    keys: [
      ["menu", 0.0, 60.0],
      ["1", 180.0, 60.0],
      ["0", 660.1, 60.0],
      ["1", 1140.1, 60.0],
      ["1", 1620.2, 60.0],
      ["menu", 2100.2, 60.1],
    ],
  },
  {
    id: "clock/alarm/shortcut-111",
    dir: "alarm/shortcut-111",
    keys: [
      ["menu", 0.0, 60.0],
      ["1", 340.1, 60.0],
      ["1", 680.1, 60.0],
      ["1", 1020.2, 60.0],
    ],
  },
  {
    id: "clock/alarm/shortcut-1111",
    dir: "alarm/shortcut-1111",
    keys: [
      ["menu", 0.0, 60.0],
      ["1", 340.1, 60.0],
      ["1", 680.1, 60.0],
      ["1", 1020.2, 60.0],
      ["1", 1360.2, 60.0],
    ],
  },
  {
    id: "clock/alarm/shortcut-1112",
    dir: "alarm/shortcut-1112",
    keys: [
      ["menu", 0.0, 60.0],
      ["1", 340.1, 60.0],
      ["1", 680.1, 60.0],
      ["1", 1020.2, 60.0],
      ["2", 1360.2, 60.0],
    ],
  },
  {
    id: "clock/auto-update/boot-on-hour",
    dir: "auto-update/boot-on-hour",
    keys: [
      ["1", 4250.3, 60.0],
      ["2", 4650.4, 60.0],
      ["3", 5050.4, 60.0],
      ["4", 5450.5, 60.0],
      ["5", 5850.5, 60.0],
      ["menu", 6250.5, 60.0],
    ],
  },
  {
    id: "clock/auto-update/choose-confirm",
    dir: "auto-update/choose-confirm",
    keys: [
      ["up", 0.0, 60.0],
      ["menu", 1200.2, 60.0],
    ],
  },
  {
    id: "clock/auto-update/choose-off",
    dir: "auto-update/choose-off",
    keys: [["menu", 0.0, 60.0]],
  },
  {
    id: "clock/auto-update/choose-on",
    dir: "auto-update/choose-on",
    keys: [
      ["up", 0.0, 60.0],
      ["up", 1200.2, 60.0],
      ["menu", 2400.4, 60.0],
    ],
  },
  { id: "clock/auto-update/open", dir: "auto-update/open", keys: [["menu", 0.0, 60.0]] },
  {
    id: "clock/countdown/0",
    dir: "countdown/0",
    keys: [
      ["menu", 0.0, 60.0],
      ["0", 660.1, 60.0],
      ["menu", 1140.2, 60.0],
    ],
  },
  {
    id: "clock/countdown/0000",
    dir: "countdown/0000",
    keys: [
      ["menu", 0.0, 60.0],
      ["0", 660.1, 60.0],
      ["0", 1140.2, 60.0],
      ["0", 1620.2, 60.0],
      ["0", 2100.3, 60.0],
      ["menu", 2580.4, 60.0],
    ],
  },
  {
    id: "clock/countdown/006",
    dir: "countdown/006",
    keys: [
      ["menu", 0.0, 60.0],
      ["0", 660.1, 60.0],
      ["0", 1140.2, 60.0],
      ["6", 1620.2, 60.0],
      ["menu", 2100.3, 60.0],
    ],
  },
  {
    id: "clock/countdown/2359",
    dir: "countdown/2359",
    keys: [
      ["menu", 0.0, 60.0],
      ["2", 660.1, 60.0],
      ["3", 1140.2, 60.0],
      ["5", 1620.2, 60.0],
      ["9", 2100.3, 60.0],
      ["menu", 2580.4, 60.0],
    ],
  },
  {
    id: "clock/countdown/2400",
    dir: "countdown/2400",
    keys: [
      ["menu", 0.0, 60.0],
      ["2", 660.1, 60.0],
      ["4", 1140.2, 60.0],
      ["0", 1620.2, 60.0],
      ["0", 2100.3, 60.0],
      ["menu", 2580.4, 60.0],
    ],
  },
  {
    id: "clock/countdown/9959",
    dir: "countdown/9959",
    keys: [
      ["menu", 0.0, 60.0],
      ["9", 660.1, 60.0],
      ["9", 1140.2, 60.0],
      ["5", 1620.2, 60.1],
      ["9", 2100.3, 60.0],
      ["menu", 2580.4, 60.0],
    ],
  },
  { id: "clock/countdown/change", dir: "countdown/change", keys: [["menu", 0.0, 60.0]] },
  {
    id: "clock/countdown/change-keys",
    dir: "countdown/change-keys",
    keys: [
      ["0", 400.0, 60.0],
      ["0", 880.1, 60.0],
      ["1", 1360.1, 60.1],
      ["0", 1840.2, 60.0],
      ["menu", 2320.3, 60.0],
    ],
  },
  {
    id: "clock/countdown/expire-elsewhere-editor-standby",
    dir: "countdown/expire-elsewhere-editor-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "clock/countdown/expire-elsewhere-menu-list-standby",
    dir: "countdown/expire-elsewhere-menu-list-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "clock/countdown/expire-elsewhere-menu-page-standby",
    dir: "countdown/expire-elsewhere-menu-page-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "clock/countdown/expire-elsewhere-note",
    dir: "countdown/expire-elsewhere-note",
    keys: [["menu", 0.0, 60.0]],
  },
  {
    id: "clock/countdown/expire-elsewhere-note-standby",
    dir: "countdown/expire-elsewhere-note-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "clock/countdown/expire-elsewhere-snake-standby",
    dir: "countdown/expire-elsewhere-snake-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "clock/countdown/expire-elsewhere-stopwatch-standby",
    dir: "countdown/expire-elsewhere-stopwatch-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  { id: "clock/countdown/expire-key-5", dir: "countdown/expire-key-5", keys: [["5", 0.0, 60.0]] },
  { id: "clock/countdown/expire-key-c", dir: "countdown/expire-key-c", keys: [["c", 0.0, 60.0]] },
  {
    id: "clock/countdown/expire-key-c-held",
    dir: "countdown/expire-key-c-held",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "clock/countdown/expire-key-ok",
    dir: "countdown/expire-key-ok",
    keys: [["menu", 0.0, 60.0]],
  },
  {
    id: "clock/countdown/expire-key-up",
    dir: "countdown/expire-key-up",
    keys: [["up", 0.0, 60.0]],
  },
  { id: "clock/countdown/expire-standby", dir: "countdown/expire-standby", keys: [] },
  { id: "clock/countdown/expire-virgin", dir: "countdown/expire-virgin", keys: [] },
  {
    id: "clock/countdown/keys",
    dir: "countdown/keys",
    keys: [
      ["menu", 0.0, 60.0],
      ["0", 660.1, 60.0],
      ["0", 1140.2, 60.0],
      ["0", 1620.2, 60.0],
      ["5", 2100.3, 60.0],
      ["menu", 2580.4, 60.0],
    ],
  },
  { id: "clock/countdown/list-c", dir: "countdown/list-c", keys: [["c", 0.0, 60.0]] },
  {
    id: "clock/countdown/open-running",
    dir: "countdown/open-running",
    keys: [["menu", 0.0, 60.0]],
  },
  { id: "clock/countdown/prompt", dir: "countdown/prompt", keys: [["menu", 0.0, 60.0]] },
  {
    id: "clock/countdown/prompt-c",
    dir: "countdown/prompt-c",
    keys: [
      ["menu", 0.0, 60.0],
      ["c", 660.1, 60.0],
    ],
  },
  {
    id: "clock/countdown/stop",
    dir: "countdown/stop",
    keys: [
      ["down", 0.0, 60.0],
      ["menu", 1500.2, 60.1],
    ],
  },
  {
    id: "clock/date/00002026",
    dir: "date/00002026",
    keys: [
      ["menu", 0.0, 60.0],
      ["0", 650.1, 60.0],
      ["0", 1130.2, 60.0],
      ["0", 1610.3, 60.0],
      ["0", 2090.3, 60.0],
      ["2", 2570.4, 60.0],
      ["0", 3050.5, 60.0],
      ["2", 3530.5, 60.0],
      ["6", 4010.6, 60.0],
      ["menu", 4490.7, 60.0],
    ],
  },
  {
    id: "clock/date/0110200",
    dir: "date/0110200",
    keys: [
      ["menu", 0.0, 60.0],
      ["0", 650.1, 60.0],
      ["1", 1130.2, 60.0],
      ["1", 1610.3, 60.0],
      ["0", 2090.3, 60.0],
      ["2", 2570.4, 60.0],
      ["0", 3050.5, 60.0],
      ["0", 3530.5, 60.0],
      ["menu", 4010.6, 60.0],
    ],
  },
  {
    id: "clock/date/1913",
    dir: "date/1913",
    keys: [
      ["menu", 0.0, 60.0],
      ["1", 650.1, 60.0],
      ["9", 1130.2, 60.0],
      ["1", 1610.3, 60.0],
      ["3", 2090.3, 60.0],
      ["menu", 2570.4, 60.0],
    ],
  },
  {
    id: "clock/date/29022026",
    dir: "date/29022026",
    keys: [
      ["menu", 0.0, 60.0],
      ["2", 650.1, 60.0],
      ["9", 1130.2, 60.0],
      ["0", 1610.3, 60.0],
      ["2", 2090.3, 60.0],
      ["2", 2570.4, 60.0],
      ["0", 3050.5, 60.0],
      ["2", 3530.5, 60.0],
      ["6", 4010.6, 60.0],
      ["menu", 4490.7, 60.0],
    ],
  },
  {
    id: "clock/date/29022028",
    dir: "date/29022028",
    keys: [
      ["menu", 0.0, 60.0],
      ["2", 650.1, 60.0],
      ["9", 1130.2, 60.0],
      ["0", 1610.3, 60.0],
      ["2", 2090.3, 60.0],
      ["2", 2570.4, 60.0],
      ["0", 3050.5, 60.0],
      ["2", 3530.5, 60.0],
      ["8", 4010.6, 60.0],
      ["menu", 4490.7, 60.0],
    ],
  },
  {
    id: "clock/date/31022026",
    dir: "date/31022026",
    keys: [
      ["menu", 0.0, 60.0],
      ["3", 650.1, 60.0],
      ["1", 1130.2, 60.0],
      ["0", 1610.3, 60.0],
      ["2", 2090.3, 60.0],
      ["2", 2570.4, 60.0],
      ["0", 3050.5, 60.0],
      ["2", 3530.5, 60.0],
      ["6", 4010.6, 60.0],
      ["menu", 4490.7, 60.0],
    ],
  },
  {
    id: "clock/date/31042026",
    dir: "date/31042026",
    keys: [
      ["menu", 0.0, 60.0],
      ["3", 650.1, 60.0],
      ["1", 1130.2, 60.0],
      ["0", 1610.3, 60.0],
      ["4", 2090.3, 60.0],
      ["2", 2570.4, 60.0],
      ["0", 3050.5, 60.0],
      ["2", 3530.5, 60.0],
      ["6", 4010.6, 60.0],
      ["menu", 4490.7, 60.0],
    ],
  },
  {
    id: "clock/date/3210",
    dir: "date/3210",
    keys: [
      ["menu", 0.0, 60.0],
      ["3", 650.1, 60.0],
      ["2", 1130.2, 60.0],
      ["1", 1610.3, 60.0],
      ["0", 2090.3, 60.0],
      ["menu", 2570.4, 60.0],
    ],
  },
  {
    id: "clock/date/c",
    dir: "date/c",
    keys: [
      ["menu", 0.0, 60.0],
      ["c", 650.1, 60.0],
    ],
  },
  {
    id: "clock/date/keys",
    dir: "date/keys",
    keys: [
      ["menu", 0.0, 60.0],
      ["1", 650.1, 60.0],
      ["4", 1130.2, 60.0],
      ["1", 1610.3, 60.0],
      ["0", 2090.3, 60.0],
      ["2", 2570.4, 60.0],
      ["0", 3050.5, 60.0],
      ["2", 3530.5, 60.0],
      ["6", 4010.6, 60.0],
      ["menu", 4490.7, 60.0],
    ],
  },
  { id: "clock/date/prompt", dir: "date/prompt", keys: [["menu", 0.0, 60.0]] },
  { id: "clock/no-time/alarm", dir: "no-time/alarm", keys: [["menu", 0.0, 60.0]] },
  { id: "clock/no-time/auto-update", dir: "no-time/auto-update", keys: [["menu", 0.0, 60.0]] },
  {
    id: "clock/no-time/clock-settings",
    dir: "no-time/clock-settings",
    keys: [["menu", 0.0, 60.0]],
  },
  { id: "clock/no-time/countdown", dir: "no-time/countdown", keys: [["menu", 0.0, 60.0]] },
  { id: "clock/no-time/date", dir: "no-time/date", keys: [["menu", 0.0, 60.0]] },
  {
    id: "clock/no-time/reminder",
    dir: "no-time/reminder",
    keys: [
      ["menu", 0.0, 60.0],
      ["menu", 2500.3, 60.1],
    ],
  },
  { id: "clock/no-time/set-time", dir: "no-time/set-time", keys: [["menu", 0.0, 60.0]] },
  { id: "clock/no-time/stopwatch", dir: "no-time/stopwatch", keys: [["menu", 0.0, 60.0]] },
  { id: "clock/restore/run", dir: "restore/run", keys: [["menu", 0.0, 60.0]] },
  {
    id: "clock/settings/format-choose-12",
    dir: "settings/format-choose-12",
    keys: [["menu", 0.0, 60.1]],
  },
  {
    id: "clock/settings/format-choose-24",
    dir: "settings/format-choose-24",
    keys: [["menu", 0.0, 60.0]],
  },
  { id: "clock/settings/hide", dir: "settings/hide", keys: [["menu", 0.0, 60.0]] },
  {
    id: "clock/settings/set-time-0",
    dir: "settings/set-time-0",
    keys: [
      ["menu", 0.0, 60.1],
      ["0", 640.1, 60.0],
      ["menu", 1120.2, 60.0],
    ],
  },
  {
    id: "clock/settings/set-time-123",
    dir: "settings/set-time-123",
    keys: [
      ["menu", 0.0, 60.1],
      ["1", 640.1, 60.0],
      ["2", 1120.2, 60.0],
      ["3", 1600.3, 60.0],
      ["menu", 2080.3, 60.0],
    ],
  },
  {
    id: "clock/settings/set-time-1260",
    dir: "settings/set-time-1260",
    keys: [
      ["menu", 0.0, 60.1],
      ["1", 640.1, 60.0],
      ["2", 1120.2, 60.0],
      ["6", 1600.3, 60.0],
      ["0", 2080.3, 60.0],
      ["menu", 2560.4, 60.0],
    ],
  },
  {
    id: "clock/settings/set-time-1959",
    dir: "settings/set-time-1959",
    keys: [
      ["menu", 0.0, 60.1],
      ["1", 640.1, 60.0],
      ["9", 1120.2, 60.0],
      ["5", 1600.3, 60.0],
      ["9", 2080.3, 60.0],
      ["menu", 2560.4, 60.0],
    ],
  },
  {
    id: "clock/settings/set-time-2400",
    dir: "settings/set-time-2400",
    keys: [
      ["menu", 0.0, 60.1],
      ["2", 640.1, 60.0],
      ["4", 1120.2, 60.0],
      ["0", 1600.3, 60.0],
      ["0", 2080.3, 60.0],
      ["menu", 2560.4, 60.0],
    ],
  },
  {
    id: "clock/settings/set-time-2500",
    dir: "settings/set-time-2500",
    keys: [
      ["menu", 0.0, 60.1],
      ["2", 640.1, 60.0],
      ["5", 1120.2, 60.0],
      ["0", 1600.3, 60.0],
      ["0", 2080.3, 60.0],
      ["menu", 2560.4, 60.0],
    ],
  },
  {
    id: "clock/settings/set-time-c",
    dir: "settings/set-time-c",
    keys: [
      ["menu", 0.0, 60.1],
      ["c", 640.1, 60.0],
    ],
  },
  {
    id: "clock/settings/set-time-c-typed",
    dir: "settings/set-time-c-typed",
    keys: [
      ["menu", 0.0, 60.1],
      ["0", 640.1, 60.0],
      ["9", 1120.2, 60.0],
      ["c", 1600.3, 60.0],
    ],
  },
  {
    id: "clock/settings/set-time-keys",
    dir: "settings/set-time-keys",
    keys: [
      ["menu", 0.0, 60.1],
      ["0", 640.1, 60.0],
      ["9", 1120.2, 60.0],
      ["5", 1600.3, 60.0],
      ["9", 2080.3, 60.0],
      ["menu", 2560.4, 60.0],
    ],
  },
  {
    id: "clock/settings/set-time-prompt",
    dir: "settings/set-time-prompt",
    keys: [["menu", 0.0, 60.1]],
  },
  { id: "clock/settings/show", dir: "settings/show", keys: [["menu", 0.0, 60.0]] },
  { id: "clock/stopwatch/c-held-again", dir: "stopwatch/c-held-again", keys: [["c", 0.0, 1500.1]] },
  {
    id: "clock/stopwatch/c-held-running",
    dir: "stopwatch/c-held-running",
    keys: [["c", 0.0, 1500.2]],
  },
  { id: "clock/stopwatch/c-running", dir: "stopwatch/c-running", keys: [["c", 0.0, 60.0]] },
  { id: "clock/stopwatch/c-stopped", dir: "stopwatch/c-stopped", keys: [["c", 0.0, 60.0]] },
  {
    id: "clock/stopwatch/exit",
    dir: "stopwatch/exit",
    keys: [
      ["down", 0.0, 60.0],
      ["down", 1500.2, 60.0],
      ["menu", 3000.5, 60.0],
    ],
  },
  { id: "clock/stopwatch/open", dir: "stopwatch/open", keys: [["menu", 0.0, 60.0]] },
  { id: "clock/stopwatch/options-c", dir: "stopwatch/options-c", keys: [["c", 0.0, 60.0]] },
  { id: "clock/stopwatch/options-c-c", dir: "stopwatch/options-c-c", keys: [["c", 0.0, 60.0]] },
  {
    id: "clock/stopwatch/options-open",
    dir: "stopwatch/options-open",
    keys: [["menu", 0.0, 60.0]],
  },
  { id: "clock/stopwatch/power-off", dir: "stopwatch/power-off", keys: [["power", 0.0, 1800.2]] },
  { id: "clock/stopwatch/reentry", dir: "stopwatch/reentry", keys: [["menu", 0.0, 60.0]] },
  {
    id: "clock/stopwatch/reentry-after-exit",
    dir: "stopwatch/reentry-after-exit",
    keys: [["menu", 0.0, 60.0]],
  },
  {
    id: "clock/stopwatch/reentry-standby",
    dir: "stopwatch/reentry-standby",
    keys: [["menu", 0.0, 60.1]],
  },
  {
    id: "clock/stopwatch/reentry-stopped",
    dir: "stopwatch/reentry-stopped",
    keys: [["menu", 0.0, 60.0]],
  },
  {
    id: "clock/stopwatch/reset",
    dir: "stopwatch/reset",
    keys: [
      ["down", 0.0, 60.0],
      ["menu", 1500.2, 60.0],
    ],
  },
  { id: "clock/stopwatch/resume", dir: "stopwatch/resume", keys: [["menu", 0.0, 60.0]] },
  { id: "clock/stopwatch/run", dir: "stopwatch/run", keys: [["menu", 0.0, 60.0]] },
  { id: "clock/stopwatch/standby", dir: "stopwatch/standby", keys: [] },
  {
    id: "clock/stopwatch/start-after-reset",
    dir: "stopwatch/start-after-reset",
    keys: [["menu", 0.0, 60.0]],
  },
  { id: "clock/stopwatch/stop", dir: "stopwatch/stop", keys: [["menu", 0.0, 60.0]] },
  { id: "clock/stopwatch/stop-again", dir: "stopwatch/stop-again", keys: [["menu", 0.0, 60.0]] },
  {
    id: "reminders/add-alarm-off",
    dir: "reminders/add-alarm-off",
    keys: [
      ["down", 0.0, 60.0],
      ["menu", 1200.1, 60.0],
    ],
  },
  { id: "reminders/add-c-empty", dir: "reminders/add-c-empty", keys: [["c", 0.0, 60.0]] },
  {
    id: "reminders/add-c-text",
    dir: "reminders/add-c-text",
    keys: [
      ["c", 0.0, 60.1],
      ["c", 1200.2, 60.0],
    ],
  },
  { id: "reminders/add-choice-c", dir: "reminders/add-choice-c", keys: [["c", 0.0, 60.0]] },
  {
    id: "reminders/add-date-01012027",
    dir: "reminders/add-date-01012027",
    keys: [
      ["0", 400.0, 60.0],
      ["1", 880.1, 60.0],
      ["0", 1360.2, 60.0],
      ["1", 1840.2, 60.0],
      ["2", 2320.3, 60.0],
      ["0", 2800.4, 60.0],
      ["2", 3280.4, 60.0],
      ["7", 3760.5, 60.0],
      ["menu", 4240.6, 60.0],
    ],
  },
  {
    id: "reminders/add-date-12102026",
    dir: "reminders/add-date-12102026",
    keys: [
      ["1", 400.0, 60.0],
      ["2", 880.1, 60.0],
      ["1", 1360.2, 60.0],
      ["0", 1840.2, 60.0],
      ["2", 2320.3, 60.0],
      ["0", 2800.4, 60.0],
      ["2", 3280.4, 60.0],
      ["6", 3760.5, 60.0],
      ["menu", 4240.6, 60.0],
    ],
  },
  {
    id: "reminders/add-date-29022028",
    dir: "reminders/add-date-29022028",
    keys: [
      ["2", 400.0, 60.0],
      ["9", 880.1, 60.0],
      ["0", 1360.2, 60.0],
      ["2", 1840.2, 60.0],
      ["2", 2320.3, 60.0],
      ["0", 2800.4, 60.0],
      ["2", 3280.4, 60.0],
      ["8", 3760.5, 60.0],
      ["menu", 4240.6, 60.0],
    ],
  },
  {
    id: "reminders/add-date-31022026",
    dir: "reminders/add-date-31022026",
    keys: [
      ["3", 400.0, 60.0],
      ["1", 880.1, 60.0],
      ["0", 1360.2, 60.0],
      ["2", 1840.2, 60.0],
      ["2", 2320.3, 60.0],
      ["0", 2800.4, 60.0],
      ["2", 3280.4, 60.0],
      ["6", 3760.5, 60.0],
      ["menu", 4240.6, 60.0],
    ],
  },
  { id: "reminders/add-date-c", dir: "reminders/add-date-c", keys: [["c", 0.0, 60.0]] },
  { id: "reminders/add-date-open", dir: "reminders/add-date-open", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/add-open", dir: "reminders/add-open", keys: [["menu", 0.0, 60.0]] },
  {
    id: "reminders/add-save",
    dir: "reminders/add-save",
    keys: [
      ["1", 140.0, 60.0],
      ["0", 620.1, 60.0],
      ["1", 1100.2, 60.0],
      ["1", 1580.2, 60.0],
      ["menu", 2060.3, 60.0],
    ],
  },
  { id: "reminders/add-text-ok", dir: "reminders/add-text-ok", keys: [["menu", 0.0, 60.1]] },
  {
    id: "reminders/add-time-0",
    dir: "reminders/add-time-0",
    keys: [
      ["0", 140.0, 60.0],
      ["menu", 620.1, 60.0],
    ],
  },
  {
    id: "reminders/add-time-0900",
    dir: "reminders/add-time-0900",
    keys: [
      ["0", 140.0, 60.0],
      ["9", 620.1, 60.0],
      ["0", 1100.2, 60.0],
      ["0", 1580.2, 60.0],
      ["menu", 2060.3, 60.0],
    ],
  },
  {
    id: "reminders/add-time-1010",
    dir: "reminders/add-time-1010",
    keys: [
      ["1", 140.0, 60.0],
      ["0", 620.1, 60.0],
      ["1", 1100.2, 60.0],
      ["0", 1580.2, 60.0],
      ["menu", 2060.3, 60.0],
    ],
  },
  {
    id: "reminders/add-time-2500",
    dir: "reminders/add-time-2500",
    keys: [
      ["2", 140.0, 60.0],
      ["5", 620.1, 60.0],
      ["0", 1100.2, 60.0],
      ["0", 1580.2, 60.0],
      ["menu", 2060.3, 60.0],
    ],
  },
  { id: "reminders/add-time-c", dir: "reminders/add-time-c", keys: [["c", 0.0, 60.0]] },
  { id: "reminders/add-time-open", dir: "reminders/add-time-open", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/alert-elsewhere-editor", dir: "reminders/alert-elsewhere-editor", keys: [] },
  {
    id: "reminders/alert-elsewhere-editor-standby",
    dir: "reminders/alert-elsewhere-editor-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "reminders/alert-elsewhere-menu-list-standby",
    dir: "reminders/alert-elsewhere-menu-list-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "reminders/alert-elsewhere-menu-page-standby",
    dir: "reminders/alert-elsewhere-menu-page-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "reminders/alert-elsewhere-note",
    dir: "reminders/alert-elsewhere-note",
    keys: [["menu", 0.0, 60.0]],
  },
  {
    id: "reminders/alert-elsewhere-note-standby",
    dir: "reminders/alert-elsewhere-note-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "reminders/alert-elsewhere-option-list-standby",
    dir: "reminders/alert-elsewhere-option-list-standby",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "reminders/alert-elsewhere-snake",
    dir: "reminders/alert-elsewhere-snake",
    keys: [["menu", 0.0, 60.0]],
  },
  {
    id: "reminders/alert-elsewhere-snake-standby",
    dir: "reminders/alert-elsewhere-snake-standby",
    keys: [["c", 0.0, 1500.3]],
  },
  { id: "reminders/alert-jump-over", dir: "reminders/alert-jump-over", keys: [] },
  { id: "reminders/alert-key-5", dir: "reminders/alert-key-5", keys: [["5", 0.0, 60.0]] },
  { id: "reminders/alert-key-c", dir: "reminders/alert-key-c", keys: [["c", 0.0, 60.0]] },
  {
    id: "reminders/alert-key-c-held",
    dir: "reminders/alert-key-c-held",
    keys: [["c", 0.0, 1500.2]],
  },
  {
    id: "reminders/alert-key-power",
    dir: "reminders/alert-key-power",
    keys: [["power", 0.0, 150.0]],
  },
  {
    id: "reminders/alert-key-snooze",
    dir: "reminders/alert-key-snooze",
    keys: [["menu", 0.0, 60.0]],
  },
  { id: "reminders/alert-key-up", dir: "reminders/alert-key-up", keys: [["up", 0.0, 60.0]] },
  {
    id: "reminders/alert-over-countdown",
    dir: "reminders/alert-over-countdown",
    keys: [["menu", 39485.5, 60.0]],
  },
  { id: "reminders/alert-resnooze-1020", dir: "reminders/alert-resnooze-1020", keys: [] },
  { id: "reminders/alert-resnooze-1021", dir: "reminders/alert-resnooze-1021", keys: [] },
  { id: "reminders/alert-resnooze-1022", dir: "reminders/alert-resnooze-1022", keys: [] },
  { id: "reminders/alert-standby", dir: "reminders/alert-standby", keys: [] },
  {
    id: "reminders/alert-two",
    dir: "reminders/alert-two",
    keys: [
      ["menu", 11175.7, 60.0],
      ["menu", 17236.5, 60.1],
    ],
  },
  { id: "reminders/alert-virgin", dir: "reminders/alert-virgin", keys: [["menu", 51335.5, 60.0]] },
  {
    id: "reminders/erase-all",
    dir: "reminders/erase-all",
    keys: [
      ["down", 0.0, 60.0],
      ["menu", 1200.2, 60.0],
    ],
  },
  { id: "reminders/erase-all-c", dir: "reminders/erase-all-c", keys: [["c", 0.0, 60.0]] },
  { id: "reminders/erase-all-yes", dir: "reminders/erase-all-yes", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/erase-one", dir: "reminders/erase-one", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/erase-one-down", dir: "reminders/erase-one-down", keys: [["down", 0.0, 60.0]] },
  { id: "reminders/erase-one-next", dir: "reminders/erase-one-next", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/erase-one-ok", dir: "reminders/erase-one-ok", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/erase-one-yes", dir: "reminders/erase-one-yes", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/erase-open", dir: "reminders/erase-open", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/full-add", dir: "reminders/full-add", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/full-no", dir: "reminders/full-no", keys: [["c", 0.0, 60.0]] },
  { id: "reminders/full-view", dir: "reminders/full-view", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/full-yes", dir: "reminders/full-yes", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/power-on-minute", dir: "reminders/power-on-minute", keys: [] },
  { id: "reminders/view-1", dir: "reminders/view-1", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/view-1-c", dir: "reminders/view-1-c", keys: [["c", 0.0, 60.0]] },
  {
    id: "reminders/view-1-edit",
    dir: "reminders/view-1-edit",
    keys: [
      ["down", 0.0, 60.0],
      ["menu", 1200.1, 60.0],
    ],
  },
  { id: "reminders/view-1-edit-ok", dir: "reminders/view-1-edit-ok", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/view-1-erase", dir: "reminders/view-1-erase", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/view-1-options", dir: "reminders/view-1-options", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/view-1-options-c", dir: "reminders/view-1-options-c", keys: [["c", 0.0, 60.0]] },
  {
    id: "reminders/view-1-send",
    dir: "reminders/view-1-send",
    keys: [
      ["down", 0.0, 60.0],
      ["down", 1200.1, 60.0],
      ["menu", 2400.3, 60.0],
    ],
  },
  { id: "reminders/view-2", dir: "reminders/view-2", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/view-2-c", dir: "reminders/view-2-c", keys: [["c", 0.0, 60.0]] },
  {
    id: "reminders/view-2-edit",
    dir: "reminders/view-2-edit",
    keys: [
      ["down", 0.0, 60.0],
      ["menu", 1200.2, 60.0],
    ],
  },
  { id: "reminders/view-2-edit-ok", dir: "reminders/view-2-edit-ok", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/view-2-erase", dir: "reminders/view-2-erase", keys: [["menu", 0.0, 60.0]] },
  {
    id: "reminders/view-2-keys",
    dir: "reminders/view-2-keys",
    keys: [
      ["down", 0.0, 60.0],
      ["down", 1500.2, 60.0],
      ["down", 3000.4, 60.0],
      ["up", 4500.6, 60.1],
    ],
  },
  { id: "reminders/view-2-options", dir: "reminders/view-2-options", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/view-2-options-c", dir: "reminders/view-2-options-c", keys: [["c", 0.0, 60.0]] },
  {
    id: "reminders/view-2-send",
    dir: "reminders/view-2-send",
    keys: [
      ["down", 0.0, 60.0],
      ["down", 1200.2, 60.0],
      ["menu", 2400.3, 60.0],
    ],
  },
  { id: "reminders/view-3", dir: "reminders/view-3", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/view-3-c", dir: "reminders/view-3-c", keys: [["c", 0.0, 60.0]] },
  {
    id: "reminders/view-3-edit",
    dir: "reminders/view-3-edit",
    keys: [
      ["down", 0.0, 60.0],
      ["menu", 1200.1, 60.0],
    ],
  },
  { id: "reminders/view-3-edit-ok", dir: "reminders/view-3-edit-ok", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/view-3-erase", dir: "reminders/view-3-erase", keys: [["menu", 0.0, 60.0]] },
  {
    id: "reminders/view-3-keys",
    dir: "reminders/view-3-keys",
    keys: [
      ["down", 0.0, 60.0],
      ["down", 1500.2, 60.0],
      ["down", 3000.4, 60.0],
      ["up", 4500.6, 60.0],
    ],
  },
  { id: "reminders/view-3-options", dir: "reminders/view-3-options", keys: [["menu", 0.0, 60.0]] },
  { id: "reminders/view-3-options-c", dir: "reminders/view-3-options-c", keys: [["c", 0.0, 60.0]] },
  {
    id: "reminders/view-3-send",
    dir: "reminders/view-3-send",
    keys: [
      ["down", 0.0, 60.0],
      ["down", 1200.1, 60.0],
      ["menu", 2400.3, 60.0],
    ],
  },
  {
    id: "reminders/virgin-erase-all",
    dir: "reminders/virgin-erase-all",
    keys: [
      ["down", 0.0, 60.1],
      ["menu", 1500.3, 60.0],
    ],
  },
  {
    id: "reminders/virgin-erase-all-yes",
    dir: "reminders/virgin-erase-all-yes",
    keys: [["menu", 0.0, 60.0]],
  },
  {
    id: "reminders/virgin-erase-one",
    dir: "reminders/virgin-erase-one",
    keys: [["menu", 0.0, 60.0]],
  },
  {
    id: "reminders/virgin-erase-open",
    dir: "reminders/virgin-erase-open",
    keys: [
      ["down", 0.0, 60.0],
      ["down", 1500.2, 60.0],
      ["menu", 3000.4, 60.0],
    ],
  },
  {
    id: "reminders/virgin-view",
    dir: "reminders/virgin-view",
    keys: [
      ["down", 0.0, 60.0],
      ["menu", 1500.2, 60.0],
    ],
  },
];

/** Named stills: `shots` (one image each) and `scroll` captures. */
export interface ClockStills {
  readonly id: string;
  readonly source:
    | { readonly kind: "shots"; readonly files: readonly ShotFile[] }
    | { readonly kind: "scroll"; readonly dir: string };
  readonly note: string;
}

const shots = (id: string, dir: string, names: readonly string[], note: string): ClockStills => ({
  id,
  source: {
    kind: "shots",
    files: names.map((name) => ({
      file: `plan21/${dir}/${name}.png`,
      name: name.replace(/\//g, "-"),
    })),
  },
  note,
});
const scroll = (id: string, dir: string, note: string): ClockStills => ({
  id,
  source: { kind: "scroll", dir: `plan21/${dir}` },
  note,
});

const FORMAT_TIMES = ["0005", "0941", "1200", "1307", "2359"] as const;
const RING_STATES = ["factory", "virgin"] as const;

export const CLOCK_STILLS: readonly ClockStills[] = [
  shots(
    "clock/settings/screens",
    "settings",
    ["standby-hidden", "page-hidden", "list-show", "standby-shown", "standby-0959"],
    "Hide clock: standby, the page, the list (Show clock); Show clock: standby; Set the time 09:59: standby.",
  ),
  shots(
    "clock/settings/format",
    "settings/format",
    FORMAT_TIMES.flatMap((t) =>
      (["24", "12"] as const).flatMap((f) => [`${f}-${t}-standby`, `${f}-${t}-page`]),
    ),
    "settime then tominute at each time: standby and the Clock settings page in 24-hour, then 12-hour.",
  ),
  shots("clock/date/screens", "date", ["page-after"], "Date setting 14.10.2026: the page."),
  shots("clock/no-time/screens", "no-time", ["standby-first", "standby"], "No time: standby."),
  scroll("clock/no-time/clock-pages", "no-time/clock-pages", "No time: the Clock pages."),
  shots(
    "clock/alarm/screens",
    "alarm",
    ["page", "standby-icon", "standby-off"],
    "The alarm set (10:11): the page and standby's icon; Off: standby.",
  ),
  scroll("clock/alarm/on-off", "alarm/on-off", "With an alarm, Alarm clock: the On/Off rows."),
  ...RING_STATES.map((state) =>
    shots(
      `clock/alarm/ring-${state}-screens`,
      "alarm",
      ["after-untouched", "snoozed-standby", "page-after-stop", "page-after-snooze-stop"].map(
        (name) => `ring-${state}-${name}`,
      ),
      `The ${state} ring: Snooze active after the automatic snooze and after Snooze; the page after C and after Stop.`,
    ),
  ),
  shots(
    "clock/countdown/screens",
    "countdown",
    ["page-30s", "page-70s", "standby-icon", "standby-stopped"],
    "Countdown 00:05: the page at 30 s and 70 s, standby's icon; stopped: standby.",
  ),
  scroll("clock/countdown/list", "countdown/list", "The running countdown's list."),
  scroll("clock/stopwatch/options", "stopwatch/options", "The stopwatch's Options."),
  scroll("reminders/level-virgin", "reminders/level-virgin", "The virgin Reminders level."),
  scroll("reminders/level-empty", "reminders/level-empty", "Reminders after Erase › All."),
  shots(
    "reminders/text",
    "reminders",
    ["text-1", "text-20", "text-35", "text-36"],
    "Remind about: 1, 20, 35 and 36 characters typed (2 and 3 alternately, 1 s apart).",
  ),
  scroll("reminders/alarm-choice", "reminders/alarm-choice", "Add new: the Alarm on / off rows."),
  ...([1, 2, 3] as const).map((n) =>
    scroll(
      `reminders/view-${n}-options-list`,
      `reminders/view-${n}-options-list`,
      `View all with ${n} reminders: Options.`,
    ),
  ),
  shots(
    "reminders/full-screens",
    "reminders",
    ["full-after-adds", "full-at-add"],
    "Ten reminders: Add new asks Memory full.",
  ),
  shots(
    "reminders/power-on-screens",
    "reminders",
    ["power-on-standby"],
    "After the boot: standby.",
  ),
  scroll("clock/auto-update/list", "auto-update/list", "Auto update's list (virgin Off)."),
  shots(
    "clock/persist/screens",
    "persist",
    ["before-standby-12h", "before-standby", "after-reboot-standby", "after-reboot-view"],
    "Persistence: standby before (12-hour, then hidden) and after the reboot; View all after it.",
  ),
  scroll("clock/persist/before-clock-pages", "persist/before-clock-pages", "Before the reboot."),
  scroll("clock/persist/after-reboot-clock-pages", "persist/after-reboot-clock-pages", "After it."),
  scroll("clock/persist/after-reboot-reminders", "persist/after-reboot-reminders", "After it."),
  shots(
    "clock/restore/screens",
    "restore",
    ["before-standby-12h", "before-standby", "after-standby", "after-view"],
    "Restore factory settings: standby before and after; View all after.",
  ),
  scroll("clock/restore/before-clock-pages", "restore/before-clock-pages", "Before Restore."),
  scroll("clock/restore/after-clock-pages", "restore/after-clock-pages", "After Restore."),
  scroll("clock/restore/after-reminders", "restore/after-reminders", "After Restore."),
];

/** The alerts' sound goldens: the alert at standby, untouched or answered. */
export const CLOCK_SOUNDS: readonly SoundCaptureEntry[] = [
  [
    "countdown-factory",
    "countdown/expire-standby",
    "factory",
    "The countdown's expiry at standby, untouched 100 s.",
  ],
  [
    "countdown-virgin",
    "countdown/expire-virgin",
    "virgin",
    "The countdown's expiry at standby (virgin), 40 s.",
  ],
  [
    "reminder-factory",
    "reminders/alert-two",
    "factory",
    "Two reminders due at 10:11: the first alert, Snooze, the second, Snooze.",
  ],
  [
    "reminder-virgin",
    "reminders/alert-virgin",
    "virgin",
    "A reminder's alert (virgin) for 20 s, then Snooze.",
  ],
  ...RING_STATES.map((state) => [
    `alarm-${state}`,
    `alarm/ring-${state}-standby`,
    state,
    `The alarm rings at standby (${state}), untouched until its automatic snooze.`,
  ]),
].map(([name, dir, state, note]) => ({
  id: `sound/clock/${name}`,
  dir: `plan21/${dir}`,
  state: state!,
  status: statusOf(`sound/clock/${name}`),
  note: note!,
}));

export function clockLcd(): CaptureSetEntry[] {
  return [
    ...CLOCK_RECORDINGS.map(
      (recording): CaptureSetEntry => ({
        id: recording.id,
        kind: "timeline",
        status: statusOf(recording.id),
        prefer: {
          source:
            CLOCK_CUTS[recording.id] === undefined
              ? { kind: "recording", dir: `plan21/${recording.dir}` }
              : {
                  kind: "composite",
                  parts: [
                    { dir: `plan21/${recording.dir}`, from: 0, to: CLOCK_CUTS[recording.id]! },
                  ],
                },
          triggerFrame: triggerOf(recording),
          note: `plan21/${recording.dir}: keys ${recording.keys.map(([k, at]) => `${k}@${at}`).join(" ") || "none (a minute edge or a timer)"}.`,
        },
      }),
    ),
    ...CLOCK_STILLS.map(
      (still): CaptureSetEntry => ({
        id: still.id,
        kind: "still",
        status: statusOf(still.id),
        prefer: { source: still.source, note: still.note },
      }),
    ),
  ];
}

export function clockSounds(io: CaptureIo): SoundGolden[] {
  return CLOCK_SOUNDS.map((entry) => buildSoundGolden(entry, io.sound));
}

export const clockAndReminders: PlanCaptureSet = {
  plan: "21",
  resources,
  lcd: () => clockLcd(),
  sounds: (io) => clockSounds(io),
  notImported: {
    "plan21/no-time/skip-time, skip-date, reminders/power-on-boot, auto-update/boot-off-*, boot-confirm-*, boot-on-same":
      "boots through the clock wizard (`Time not set`, `Time:`/`Date:`): nokia-os has no clock wizard; the host clock is the RTC (D1)",
    "plan21/alarm/standby-minute, countdown/standby-run, reminders/alert-before, alarm/ring-elsewhere-menu-list, reminders/alert-elsewhere-menu-page, alert-elsewhere-menu-list, alert-elsewhere-option-list, countdown/expire-elsewhere-menu-page, expire-elsewhere-menu-list, reminders/view-1-keys":
      "a single unchanged frame (no trigger): the screen does not change at the event (alerts wait for standby)",
    "plan21/alarm/ring-elsewhere-editor, ring-elsewhere-snake, countdown/expire-elsewhere-editor, expire-elsewhere-snake":
      "20 s of plan 18's editor and plan 23's Snake II under the alarm's minute or the expiry: the alert waits for standby (their -standby recordings)",
    "plan21/persist/boot": "a boot through the clock wizard (no clock wizard in nokia-os, D1)",
    "plan21/countdown/expire-elsewhere-stopwatch":
      "the running stopwatch's digits (D5's tolerance) for 20 s; the countdown waits for standby as on every other screen",
    "plan21/stopwatch/long/, long-stop":
      "62 minutes: the display keeps real time (the Task 0 outcome); a scenario would tick 3.7 M times",
    "plan21/**/*@8x.png, text.json, expect/, *-events.txt, full-count.txt":
      "previews, OCR and Task 0 evidence",
    "plan21/**/*.wav, *.events.csv except CLOCK_SOUNDS'":
      "the LCD recordings' audio: the alerts' sound goldens hold their sounds",
    "scratch-plan21/": "planning probes P1-P16 and Task 0 exploration, never imported",
  },
};
