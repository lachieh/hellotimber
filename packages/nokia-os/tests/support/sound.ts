// Sound assertions against sound goldens (plan 16 "Scenarios and the coverage guard"): drive a
// golden's keys on a rig, collect the port's events, and compare them row by row with failure
// output in the style of `expectTimeline`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PhoneKey } from "@hellotimber/phone-core";
import {
  formatSoundState,
  parseSoundGolden,
  type SoundGolden,
  type SoundOutputName,
  type SoundRow,
  type SoundState,
} from "../../scripts/sound-format.ts";
import type { StockSoundEvent } from "../../src/index";
import type { Rig } from "./rig.ts";

/** A program's onset (a preview, a timed tone) against its golden time (D6: 985-1014 ms around 991). */
export const SOUND_ONSET_TOLERANCE_MS = 25;
/** Edges within one program, against the program's own start (D6). */
export const SOUND_EDGE_TOLERANCE_MS = 2;
/**
 * The captured key-down → output latency nokia-os does not reproduce (D8, D12; Task 0: 12-103
 * ms): an output a key starts or stops may lag the key by this much in the golden.
 */
export const KEY_LATENCY_MAX_MS = 103;
/**
 * The length of a tone a key starts varies with the DSP's state and the firmware's timers (Task
 * 0: keypad beeps 139-155 ms awake around the generated 145, 123-139 woken around 124; warning
 * tones 287-294 around 289).
 */
export const KEY_TONE_TOLERANCE_MS = 10;
/** A later pass of a recording drifts from its first (D6 deviation): 25 ms plus 1.2 % of its offset. */
export const PASS_DRIFT = { ms: 25, ratio: 0.012 } as const;

const GOLDENS = join(import.meta.dirname, "../../goldens");

export function loadSoundGolden(id: string): SoundGolden {
  const file = `${id}.sound.txt`;
  return parseSoundGolden(readFileSync(join(GOLDENS, file), "utf8"), file);
}

/** The port's events while a golden's keys were pressed; `originMs` is the golden's time 0. */
export interface RecordedSound {
  readonly originMs: number;
  readonly endMs: number;
  readonly events: readonly StockSoundEvent[];
}

export interface PlayOptions {
  /** How long to run after the golden's last row or key (default 500 ms). */
  readonly tailMs?: number;
  /** Run at least this long after time 0. */
  readonly durationMs?: number;
}

/**
 * Presses the golden's keys on `rig` (the first at time 0, now; each a tap unless `+hold`) and
 * records the sound events until its last row, plus a tail.
 */
export function playSound(rig: Rig, golden: SoundGolden, options: PlayOptions = {}): RecordedSound {
  const origin = rig.now;
  const seen = rig.sounds.length;
  const actions: { ms: number; run: () => void }[] = [];
  for (const k of golden.keys ?? []) {
    const key = k.key as PhoneKey;
    actions.push({ ms: k.ms, run: () => rig.hold(key) });
    actions.push({ ms: k.ms + (k.holdMs ?? 0), run: () => rig.release(key) });
  }
  actions.sort((a, b) => a.ms - b.ms);
  const lastRow = golden.rows.at(-1)?.ms ?? 0;
  const lastKey = actions.at(-1)?.ms ?? 0;
  const end = Math.max(lastRow, lastKey + 100, options.durationMs ?? 0) + (options.tailMs ?? 500);
  for (const action of actions) {
    rig.advance(origin + action.ms - rig.now);
    action.run();
  }
  rig.advance(origin + end - rig.now);
  return { originMs: origin, endMs: rig.now, events: rig.sounds.slice(seen) };
}

function stateOf(event: StockSoundEvent): SoundState {
  if (event.output === "vibrator") return { kind: event.on ? "on" : "off" };
  return event.hz === null
    ? { kind: "off" }
    : { kind: "sounding", hz: event.hz, volume: event.volume };
}

const isOn = (state: SoundState): boolean => state.kind !== "off";

/** How a golden row's time is checked (Δ = actual − golden). */
type Check =
  /** A key started or stopped it: the golden lags the key by its latency. */
  | { readonly kind: "key"; readonly slackMs: number }
  /** A program's first edge after a key (or the recording's start, or idle outputs: cues). */
  | { readonly kind: "onset"; readonly toleranceMs: number }
  /** A later edge of the program that row `anchor` started. */
  | { readonly kind: "after"; readonly anchor: number; readonly toleranceMs: number };

export interface SoundTolerance {
  /**
   * The tone's cycle when the golden repeats it without an `@loop` (a tone's preview recorded at
   * another level): edges past the first cycle drift as a later pass (PASS_DRIFT).
   */
  readonly cycleMs?: number;
  /**
   * The golden is another recording of a program built from a different golden (a tone at
   * another level, in another list or profile): every edge after its onset drifts as between
   * passes (PASS_DRIFT; Task 0: recordings of one tone differ by a median 11 ms, at most 48).
   */
  readonly drift?: boolean;
  /** Compare only these outputs (a scenario says why the others are not comparable). */
  readonly outputs?: readonly SoundOutputName[];
  /**
   * Game cues (D13): the rows are programs the game starts on its ticks, not keys. A row that
   * starts an output while every compared output is off is a cue's onset, matched within this
   * tolerance (GAME_TICK_TOLERANCE_MS); the cue's later edges ±2 ms of it. Keys are ignored.
   */
  readonly cueOnsetMs?: number;
  /**
   * When the capture stopped recording while a program played: later events are not compared,
   * and within PASS_DRIFT of it an edge may fall on either side of the end.
   */
  readonly endMs?: number;
}

/**
 * A preview's stop races its next edge (Task 0: "the last note may differ"): another recording
 * may end with a pulse of up to this length (a note or a vibrator pulse) that the program's
 * recording lacks, or lack one it has.
 */
export const STOP_RACE_MS = 3;

/** `rows` without a final on-then-off pulse of at most STOP_RACE_MS on any output. */
function withoutStopRace(rows: readonly SoundRow[]): SoundRow[] {
  const drop = new Set<SoundRow>();
  for (const output of ["buzzer", "tone", "vibrator"] as const) {
    const own = rows.filter((row) => row.output === output);
    const [on, off] = own.slice(-2);
    if (on && off && isOn(on.state) && !isOn(off.state) && off.ms - on.ms <= STOP_RACE_MS) {
      if (own.length === 2 || !isOn(own.at(-3)!.state)) {
        drop.add(on);
        drop.add(off);
      }
    }
  }
  return rows.filter((row) => !drop.has(row));
}

/** Classifies each golden row (see the module notes in plan 16 "Scenarios"). */
function checksOf(golden: SoundGolden, tolerance: SoundTolerance): Check[] {
  const cues = tolerance.cueOnsetMs !== undefined;
  const keys = cues ? [] : (golden.keys ?? []);
  const cycle = tolerance.cycleMs ?? golden.loop?.periodMs;
  const state = new Map<SoundOutputName, SoundState>();
  const run = new Map<
    SoundOutputName,
    { kind: "key"; row: number; keyMs: number } | { kind: "program" }
  >();
  let anchor: number | undefined;
  let fresh = true;
  let keyIndex = 0;
  const checks: Check[] = [];
  const after = (i: number, toleranceMs: number): Check => {
    const offset = golden.rows[i]!.ms - golden.rows[anchor!]!.ms;
    const drift =
      tolerance.drift === true || (cycle !== undefined && offset >= cycle)
        ? PASS_DRIFT.ms + PASS_DRIFT.ratio * offset
        : 0;
    return { kind: "after", anchor: anchor!, toleranceMs: Math.max(toleranceMs, drift) };
  };
  const program = (i: number): Check => {
    if (anchor === undefined || fresh) {
      anchor = i;
      fresh = false;
      return { kind: "onset", toleranceMs: tolerance.cueOnsetMs ?? SOUND_ONSET_TOLERANCE_MS };
    }
    return after(i, SOUND_EDGE_TOLERANCE_MS);
  };
  golden.rows.forEach((row, i) => {
    while (keyIndex < keys.length && keys[keyIndex]!.ms <= row.ms) {
      keyIndex++;
      fresh = true;
    }
    const near = [...keys]
      .reverse()
      .find((k) => k.ms <= row.ms && row.ms <= k.ms + (k.holdMs ?? 0) + KEY_LATENCY_MAX_MS);
    if (cues && [...state.values()].every((s) => !isOn(s))) fresh = true;
    const was = state.get(row.output) ?? { kind: "off" };
    state.set(row.output, row.state);
    const current = run.get(row.output);
    if (!isOn(was)) {
      if (near !== undefined) {
        run.set(row.output, { kind: "key", row: i, keyMs: near.ms });
        checks.push({ kind: "key", slackMs: SOUND_EDGE_TOLERANCE_MS });
      } else {
        run.set(row.output, { kind: "program" });
        checks.push(program(i));
      }
      return;
    }
    if (current?.kind === "key") {
      const extended = keys.some((k) => k.ms > current.keyMs && k.ms < row.ms);
      if (isOn(row.state) && near !== undefined && near.ms > current.keyMs) {
        checks.push({ kind: "key", slackMs: SOUND_EDGE_TOLERANCE_MS });
      } else if (extended) {
        checks.push({ kind: "key", slackMs: KEY_TONE_TOLERANCE_MS });
      } else {
        const toleranceMs = isOn(row.state) ? SOUND_EDGE_TOLERANCE_MS : KEY_TONE_TOLERANCE_MS;
        checks.push({ kind: "after", anchor: current.row, toleranceMs });
      }
      return;
    }
    // A program row: a key stops it, else it follows its onset.
    const anchorMs = anchor === undefined ? -Infinity : golden.rows[anchor]!.ms;
    if (!isOn(row.state) && near !== undefined && near.ms > anchorMs) {
      checks.push({ kind: "key", slackMs: SOUND_EDGE_TOLERANCE_MS });
    } else {
      checks.push(isOn(row.state) && fresh ? program(i) : after(i, SOUND_EDGE_TOLERANCE_MS));
    }
  });
  return checks;
}

const HEADER = "  golden  output    state                 actual       Δ  check";

/**
 * Compares a recording with a sound golden: per output the same states in the same order
 * (frequencies and volumes exact), each row's time by its check (`checksOf`), and no event
 * beyond the golden's.
 */
export function expectSoundTimeline(
  recorded: RecordedSound,
  golden: SoundGolden,
  context: string,
  tolerance: SoundTolerance = {},
): void {
  const keep = (row: SoundRow): boolean =>
    tolerance.outputs === undefined || tolerance.outputs.includes(row.output);
  let actualRows = recorded.events
    .map((event) => ({
      ms: event.atMs - recorded.originMs,
      output: event.output,
      state: stateOf(event),
    }))
    .filter(keep);
  if (tolerance.drift === true) {
    actualRows = withoutStopRace(actualRows);
    golden = { ...golden, rows: withoutStopRace(golden.rows) };
  }
  golden = { ...golden, rows: golden.rows.filter(keep) };
  const end = tolerance.endMs;
  const nearEnd = (ms: number): boolean =>
    end !== undefined && ms >= end - PASS_DRIFT.ms - PASS_DRIFT.ratio * end;
  if (end !== undefined)
    actualRows = actualRows.filter(
      (row) =>
        row.ms <= end ||
        (nearEnd(row.ms) && row.ms <= end + PASS_DRIFT.ms + PASS_DRIFT.ratio * end),
    );
  const actual = new Map<SoundOutputName, SoundRow[]>();
  for (const row of actualRows) {
    const rows = actual.get(row.output) ?? [];
    rows.push(row);
    actual.set(row.output, rows);
  }
  const checks = checksOf(golden, tolerance);
  const used = new Map<SoundOutputName, number>();
  const matched: (SoundRow | undefined)[] = golden.rows.map((row) => {
    const n = used.get(row.output) ?? 0;
    used.set(row.output, n + 1);
    return actual.get(row.output)?.[n];
  });
  const lines = [HEADER];
  let failed = false;
  golden.rows.forEach((row, i) => {
    const got = matched[i];
    const check = checks[i]!;
    const want = formatSoundState(row.output, row.state);
    const prefix = `${String(row.ms).padStart(8)}  ${row.output.padEnd(8)}  ${want.padEnd(20)}`;
    if (got === undefined) {
      const late = nearEnd(row.ms);
      if (!late) failed = true;
      lines.push(
        `${prefix}  ${"-".padStart(8)}  ${"-".padStart(6)}  ${late ? "past the end" : "✗ missing"}`,
      );
      return;
    }
    const delta = got.ms - row.ms;
    const marks: string[] = [];
    const have = formatSoundState(got.output, got.state);
    if (have !== want) marks.push(`✗ state ${have}`);
    let text: string;
    if (check.kind === "key") {
      text = `key −${KEY_LATENCY_MAX_MS}..+${check.slackMs}`;
      if (delta < -KEY_LATENCY_MAX_MS - check.slackMs || delta > check.slackMs)
        marks.push("✗ timing");
    } else if (check.kind === "onset") {
      text = `onset ±${check.toleranceMs}`;
      if (Math.abs(delta) > check.toleranceMs) marks.push("✗ timing");
    } else {
      const base = matched[check.anchor];
      const relative = base === undefined ? NaN : delta - (base.ms - golden.rows[check.anchor]!.ms);
      text = `+${golden.rows[check.anchor]!.ms} ±${Math.round(check.toleranceMs)} (${relative >= 0 ? "+" : ""}${relative})`;
      if (!(Math.abs(relative) <= check.toleranceMs)) marks.push("✗ timing");
    }
    if (marks.length > 0) failed = true;
    lines.push(
      `${prefix}  ${String(got.ms).padStart(8)}  ${(delta >= 0 ? `+${delta}` : String(delta)).padStart(6)}  ${text}  ${marks.join("  ")}`.trimEnd(),
    );
  });
  for (const [output, rows] of actual) {
    for (const extra of rows.slice(used.get(output) ?? 0)) {
      if (nearEnd(extra.ms)) continue;
      failed = true;
      lines.push(
        `${"-".padStart(8)}  ${output.padEnd(8)}  ${"".padEnd(20)}  ${String(extra.ms).padStart(8)}  ${"".padStart(6)}  ✗ extra ${formatSoundState(output, extra.state)}`,
      );
    }
  }
  if (!failed) return;
  throw new Error(
    [
      `Sound mismatch: ${golden.id} (time 0 = the first key-down)`,
      `scenario: ${context}`,
      ...lines,
    ].join("\n"),
  );
}
