// Plan 19 test support: the phone book's acceptance scenarios replay Task 0's own command logs
// (tests/support/replay.ts over scripts/generated/phone-book-scripts.ts) on a phone with the
// log's SIM fixture (`PHONE_BOOK_SIMS`) in its virgin or factory state, and compare every shot,
// scroll and recording a golden holds.
import {
  PHONE_BOOK_CAPTURE_SCRIPTS,
  PHONE_BOOK_SCRIPT_SETUPS,
} from "../../scripts/generated/phone-book-scripts.ts";
import {
  PHONE_BOOK_SIMS,
  PHONE_BOOK_SOUNDS,
  type PhoneBookSimName,
} from "../../scripts/capture-sets/19-phone-book.ts";
import { readPlanIndex } from "../../scripts/golden-index.ts";
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import type { StockSimCard } from "../../src/index";
import { GOLDENS } from "./acceptance.ts";
import { loadGolden } from "./goldens.ts";
import { PROBE_TOLERANCE_MS } from "./golden.ts";
import { messagesRewrite, SETUP_MS } from "./messages.ts";
import {
  locate,
  Replay,
  replayScenario,
  type ReplayContext,
  type TimelineOptions,
} from "./replay.ts";
import { expectSoundTimeline, KEY_LATENCY_MAX_MS, loadSoundGolden, playSound } from "./sound.ts";
import { standbyRig } from "./rig.ts";

/** Plan 19's capture logs on a stock phone with each log's SIM (`standbyRig` stands for the setup). */
export const PHONE_BOOK_REPLAY: ReplayContext = {
  scripts: PHONE_BOOK_CAPTURE_SCRIPTS,
  // The pickers' logs open Write messages and turn Dictionary off as plan 18's do.
  rewrite: messagesRewrite,
  setup(storage, script) {
    const setup = PHONE_BOOK_SCRIPT_SETUPS[script];
    if (setup === undefined) throw new Error(`No setup for capture log ${script}.`);
    // The factory sections start from plan 15's restored image (plan 16 D7).
    if (setup.setup === "factory") createStockSettings(new StockEeprom(storage)).restoreFactory();
    const sim = PHONE_BOOK_SIMS[setup.sim as PhoneBookSimName] as StockSimCard | undefined;
    if (sim === undefined) throw new Error(`${script}: no SIM fixture ${setup.sim}.`);
    return standbyRig({ storage, sim });
  },
  setupMs: SETUP_MS,
};

/** The scenario of plan 19 golden `id`: its capture replayed. */
export function phoneBookScenario(
  options: TimelineOptions | ((id: string) => TimelineOptions) = {},
): (id: string) => void {
  return (id) =>
    replayScenario(PHONE_BOOK_REPLAY, id, typeof options === "function" ? options(id) : options);
}

/** A recording of a note whose timeline another recording of the same note gave (D8). */
const OTHER_RECORDING: TimelineOptions = { toleranceMs: PROBE_TOLERANCE_MS };

/**
 * ▲/▼ at standby: the key acts on the row of standby's leading frame (22-37 ms; the replay takes
 * a row that short for a partial draw); later keys find their own rows.
 */
function standbyKey(
  extra: TimelineOptions = {},
  laterRows: readonly number[] = [],
): (id: string) => TimelineOptions {
  return (id) => {
    const rows = loadGolden(id).timeline!;
    const at = (row: number) => rows[row]!.startMs - Math.min(rows[0]!.startMs, 1);
    const keyAt: Record<number, number> = { 0: at(1) };
    laterRows.forEach((row, i) => (keyAt[i + 1] = at(row)));
    // The leading frame lasts 22-37 ms between presses (STANDBY_KEY_DELAY_MS is the median, 23).
    return { toleranceMs: LEAD_SPREAD_MS, ...extra, keyAt };
  };
}

/** The leading frame's spread around STANDBY_KEY_DELAY_MS (16 presses: 22-37 ms). */
const LEAD_SPREAD_MS = 15;

/** C in a standby list draws standby without its operator 80-86 ms (STANDBY_LIST_EXIT_DRAW_MS 85). */
const LIST_EXIT_SPREAD: TimelineOptions = { toleranceMs: 6 };

/**
 * `No phone numbers` plays one recording's timeline; the note lasts 2850-2938 ms between
 * recordings (standby-down-empty 2901, search-empty-sim 2881, service-empty 2938,
 * speed-empty 2850).
 */
const NO_PHONE_NUMBERS: TimelineOptions = { toleranceMs: 60 };

/** The scenario options of plan 19's goldens that are not the default, by the task that promoted them. */
export const PHONE_BOOK_OPTIONS: Readonly<
  Record<string, TimelineOptions | ((id: string) => TimelineOptions)>
> = {
  // Task 7. Standby ▲/▼'s leading frame.
  ...Object.fromEntries(
    ["standby-down-large", "standby-down-list", "standby-down-number", "standby-delay"].map(
      (id) => [`phone-book/${id}`, standbyKey()],
    ),
  ),
  // A key in the leading frame acts on the list once it opens (its own row, 3: C's draw, ▼'s anna).
  "phone-book/standby-lead-c": standbyKey({}, [3]),
  "phone-book/standby-lead-down": standbyKey({}, [3]),
  "phone-book/standby-list-c": LIST_EXIT_SPREAD,
  "phone-book/standby-down-list-c": LIST_EXIT_SPREAD,
  // No phone numbers plays plan 18's timeline (2914 ms; this recording's 2901).
  "phone-book/standby-down-empty": standbyKey(NO_PHONE_NUMBERS),
  "phone-book/search-empty-sim": NO_PHONE_NUMBERS,
  // The tick notes (Saved, Replaced) and Type of view's Done play one recording's timeline;
  // their steps spread up to 16 ms between recordings (`saved`: add-saved's 684/235/1927).
  ...Object.fromEntries(
    [
      "add-chars-saved",
      "add-euro-saved",
      "add-empty-sim",
      "add-full-replace",
      "add-fullrev-replace",
      "add-limit-saved",
      "add-no-name",
      "add-no-number",
      "add-small-refill",
      "view-choose-large-font",
      "view-choose-name-list",
      "view-choose-name-number",
    ].map((id) => [`phone-book/${id}`, OTHER_RECORDING]),
  ),
};

/**
 * A sound golden's scenario: its capture log replayed up to its recording's start, then the
 * golden's keys pressed and the phone's sound events compared (plan 16's rules).
 */
export function phoneBookSoundScenario(id: string): void {
  const entry = PHONE_BOOK_SOUNDS.find((sound) => sound.id === id);
  if (entry === undefined) throw new Error(`${id} is not a plan 19 sound golden.`);
  const located = locate(PHONE_BOOK_REPLAY, "record", entry.dir);
  if (located === undefined) throw new Error(`${id}: no record ${entry.dir} in the logs.`);
  const replay = new Replay(PHONE_BOOK_REPLAY);
  replay.reach(located.path);
  const golden = loadSoundGolden(id);
  // The firmware beeps the key that saves or erases once the SIM write is done (Saved: 192 ms
  // after OK); nokia-os beeps at the key: the key is pressed at its beep.
  const first = golden.rows[0];
  const beep =
    first !== undefined &&
    first.output === "tone" &&
    first.state.kind === "sounding" &&
    first.state.hz === KEY_BEEP_HZ &&
    first.ms > KEY_LATENCY_MAX_MS
      ? first.ms
      : 0;
  const keys = (golden.keys ?? []).map((key, i) => (i === 0 ? { ...key, ms: key.ms + beep } : key));
  const played = playSound(replay.rig, { ...golden, keys });
  // A late beep is the DSP's awake or woken one (140-145 ms) as the replay's key timing has it.
  expectSoundTimeline(
    played,
    golden,
    `${id}: ${golden.note ?? ""}`,
    beep > 0 ? { drift: true } : {},
  );
  replay.end();
}

/** The keypad's beep (plan 16: 900 Hz at the keypad tone level). */
const KEY_BEEP_HZ = 900;

/**
 * Every asserted plan 19 golden's scenario (tests/acceptance/19-phone-book.test.ts): its capture
 * replayed.
 */
export const PHONE_BOOK_SCENARIOS: Readonly<Record<string, (id: string) => void>> =
  Object.fromEntries(
    readPlanIndex(GOLDENS, "19")
      .filter((entry) => entry.status === "asserted")
      .map(({ id, kind }) => [
        id,
        kind === "sound" ? phoneBookSoundScenario : phoneBookScenario(PHONE_BOOK_OPTIONS[id]),
      ]),
  );

/** Asserted plan 19 goldens whose scenario cannot pass, with the reason. */
export const PHONE_BOOK_KNOWN_GAPS: Readonly<Record<string, string>> = {
  "phone-book/standby-list-hold-c":
    "C held: the list closes at C's down as captured; the firmware then redraws standby (its " +
    "operator-less frame) ≈530 ms after the down, its own long press; the kernel's long press " +
    "(800 ms) at standby draws nothing",
  "phone-book/search-prompt-hold-c":
    "C held on the empty prompt: the level comes at C's down as captured, then the firmware's " +
    "long press reaches standby ≈545 ms after the down (an operator-less frame, then standby); " +
    "the kernel's long press comes at 800 ms and draws standby at once",
};

/**
 * A replay runs its log from power-on: the longest (Speed dials, letters) take several seconds
 * alone, more under the full suite's load.
 */
export const PHONE_BOOK_TIMEOUTS_MS: Readonly<Record<string, number>> = Object.fromEntries(
  Object.keys(PHONE_BOOK_SCENARIOS).map((id) => [id, 60_000]),
);
