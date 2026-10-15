// Sound assertions against sound goldens (plan 16 "Scenarios and the coverage guard"): drive a
// golden's keys on a rig, collect the port's events, and compare them row by row with failure
// output in the style of `expectTimeline`. Frequencies and volumes are exact; edge times follow
// the fidelity standard (golden.ts, AGENTS.md), and events too short to hear are left out.
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
import { timingToleranceMs, TWO_FRAMES_MS } from "./golden.ts";
import type { Rig } from "./rig.ts";

/**
 * The captured key-down → output latency nokia-os does not reproduce (D8, D12; Task 0: 12-103
 * ms): an output a key starts or stops may lag the key by this much in the golden.
 */
export const KEY_LATENCY_MAX_MS = 103;

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
  | { readonly kind: "key" }
  /** A program's first edge after a key (or the recording's start, or idle outputs: cues). */
  | { readonly kind: "onset" }
  /** A later edge of the program that row `anchor` started. */
  | { readonly kind: "after"; readonly anchor: number };

export interface SoundTolerance {
  /** Compare only these outputs (a scenario says why the others are not comparable). */
  readonly outputs?: readonly SoundOutputName[];
  /**
   * Game cues (D13): the rows are programs the game starts on its ticks, not keys. A row that
   * starts an output while every compared output is off is a cue's onset, its later edges
   * compared from it. Keys are ignored.
   */
  readonly cues?: boolean;
  /**
   * When the capture stopped recording while a program played: later events are not compared,
   * and within the fidelity standard of it an edge may fall on either side of the end.
   */
  readonly endMs?: number;
}

/** Pair states in order before removing short events. Sustained pairs take priority over
 * short repetitions of the same pitch. No sustained event is removed by its counterpart.
 */
function withoutShortEvents<G extends SoundRow, A extends SoundRow>(
  golden: readonly G[],
  actual: readonly A[],
): { golden: G[]; actual: A[] } {
  const paired = new Set<SoundRow>();
  for (const output of ["buzzer", "tone", "vibrator"] as const) {
    const g = golden.filter((row) => row.output === output);
    const a = actual.filter((row) => row.output === output);
    const states = (rows: readonly SoundRow[]) =>
      rows.map((row) => formatSoundState(output, row.state));
    const gs = states(g);
    const as = states(a);
    const sustained = (rows: readonly SoundRow[], i: number): boolean =>
      rows[i + 1] === undefined || rows[i + 1]!.ms - rows[i]!.ms >= TWO_FRAMES_MS;
    const width = a.length + 1;
    const scores = new Uint32Array((g.length + 1) * width);
    const costs = new Float64Array(scores.length);
    const cost = (i: number, j: number): number => costs[i * width + j]!;
    const score = (i: number, j: number): number => scores[i * width + j]!;
    const weight = (i: number, j: number): number =>
      1 + Number(sustained(g, i)) + Number(sustained(a, j));
    for (let i = g.length - 1; i >= 0; i--) {
      for (let j = a.length - 1; j >= 0; j--) {
        const options = [
          { score: score(i + 1, j), cost: cost(i + 1, j) },
          { score: score(i, j + 1), cost: cost(i, j + 1) },
          ...(gs[i] === as[j]
            ? [
                {
                  score: weight(i, j) + score(i + 1, j + 1),
                  cost: Math.abs(g[i]!.ms - a[j]!.ms) + cost(i + 1, j + 1),
                },
              ]
            : []),
        ];
        const best = options.reduce((best, option) =>
          option.score > best.score || (option.score === best.score && option.cost < best.cost)
            ? option
            : best,
        );
        scores[i * width + j] = best.score;
        costs[i * width + j] = best.cost;
      }
    }
    let i = 0;
    let j = 0;
    while (i < g.length && j < a.length) {
      if (
        gs[i] === as[j] &&
        score(i, j) === weight(i, j) + score(i + 1, j + 1) &&
        cost(i, j) === Math.abs(g[i]!.ms - a[j]!.ms) + cost(i + 1, j + 1)
      ) {
        paired.add(g[i]!);
        paired.add(a[j]!);
        i++;
        j++;
      } else if (score(i, j) === score(i + 1, j) && cost(i, j) === cost(i + 1, j)) i++;
      else j++;
    }
  }
  const settle = <R extends SoundRow>(rows: readonly R[]): R[] => {
    const kept = new Set<R>();
    for (const output of ["buzzer", "tone", "vibrator"] as const) {
      const own = rows.filter((row) => row.output === output);
      let held = formatSoundState(output, { kind: "off" });
      let dropped = false;
      own.forEach((row, i) => {
        const next = own[i + 1];
        const state = formatSoundState(output, row.state);
        if (next !== undefined && next.ms - row.ms < TWO_FRAMES_MS && !paired.has(row)) {
          dropped = true;
          return;
        }
        if (!(dropped && state === held)) kept.add(row);
        held = state;
        dropped = false;
      });
    }
    return rows.filter((row) => kept.has(row));
  };
  return { golden: settle(golden), actual: settle(actual) };
}

/** Classifies each golden row (see the module notes in plan 16 "Scenarios"). */
function checksOf(golden: SoundGolden, tolerance: SoundTolerance): Check[] {
  const cues = tolerance.cues === true;
  const keys = cues ? [] : (golden.keys ?? []);
  const state = new Map<SoundOutputName, SoundState>();
  const run = new Map<
    SoundOutputName,
    { kind: "key"; row: number; keyMs: number } | { kind: "program" }
  >();
  let anchor: number | undefined;
  let fresh = true;
  let keyIndex = 0;
  const checks: Check[] = [];
  const after = (): Check => ({ kind: "after", anchor: anchor! });
  const program = (i: number): Check => {
    if (anchor === undefined || fresh) {
      anchor = i;
      fresh = false;
      return { kind: "onset" };
    }
    return after();
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
        checks.push({ kind: "key" });
      } else {
        run.set(row.output, { kind: "program" });
        checks.push(program(i));
      }
      return;
    }
    if (current?.kind === "key") {
      const extended = keys.some((k) => k.ms > current.keyMs && k.ms < row.ms);
      if ((isOn(row.state) && near !== undefined && near.ms > current.keyMs) || extended) {
        checks.push({ kind: "key" });
      } else {
        checks.push({ kind: "after", anchor: current.row });
      }
      return;
    }
    // A program row: a key stops it, else it follows its onset.
    const anchorMs = anchor === undefined ? -Infinity : golden.rows[anchor]!.ms;
    if (!isOn(row.state) && near !== undefined && near.ms > anchorMs) {
      checks.push({ kind: "key" });
    } else {
      checks.push(isOn(row.state) && fresh ? program(i) : after());
    }
  });
  return checks;
}

const HEADER = "  golden  output    state                 actual       Δ  check";

/**
 * Compares a recording with a sound golden: per output the same states in the same order
 * (frequencies and volumes exact), each row's time by its check (`checksOf`), and no event
 * beyond the golden's. Events shorter than TWO_FRAMES_MS on either side are left out
 * (`withoutShortEvents`).
 */
export function expectSoundTimeline(
  recorded: RecordedSound,
  golden: SoundGolden,
  context: string,
  tolerance: SoundTolerance = {},
): void {
  const keep = (row: SoundRow): boolean =>
    tolerance.outputs === undefined || tolerance.outputs.includes(row.output);
  const recordedRows = recorded.events
    .map((event) => ({
      ms: event.atMs - recorded.originMs,
      output: event.output,
      state: stateOf(event),
    }))
    .filter(keep);
  const goldenRows = golden.rows.filter(keep);
  const settled = withoutShortEvents(goldenRows, recordedRows);
  let actualRows = settled.actual;
  golden = { ...golden, rows: settled.golden };
  const end = tolerance.endMs;
  const nearEnd = (ms: number): boolean => end !== undefined && ms >= end - timingToleranceMs(end);
  if (end !== undefined)
    actualRows = actualRows.filter(
      (row) => row.ms <= end || (nearEnd(row.ms) && row.ms <= end + timingToleranceMs(end)),
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
      text = `key −${KEY_LATENCY_MAX_MS}..+${TWO_FRAMES_MS}`;
      if (delta < -KEY_LATENCY_MAX_MS - TWO_FRAMES_MS || delta > TWO_FRAMES_MS) {
        marks.push("✗ timing");
      }
    } else if (check.kind === "onset") {
      const toleranceMs = timingToleranceMs(row.ms);
      text = `onset ±${Math.round(toleranceMs)}`;
      if (Math.abs(delta) > toleranceMs) marks.push("✗ timing");
    } else {
      const anchor = golden.rows[check.anchor]!;
      const offset = row.ms - anchor.ms;
      // A program's rows after its onset (a tune) are a sequence from it.
      const toleranceMs = timingToleranceMs(offset, offset);
      const base = matched[check.anchor];
      const relative = base === undefined ? NaN : delta - (base.ms - anchor.ms);
      text = `+${anchor.ms} ±${Math.round(toleranceMs)} (${relative >= 0 ? "+" : ""}${relative})`;
      if (!(Math.abs(relative) <= toleranceMs)) marks.push("✗ timing");
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
