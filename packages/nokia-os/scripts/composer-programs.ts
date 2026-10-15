// The Composer's sound tables and timings, derived from plan 27's committed goldens (D3, D4, D9).
//
// - `periods`: each tempo's note periods in timer units (≈7.745 ms, plan 23), plain and dotted,
//   from the tempo sweep (`sound/composer/tempo-<bpm>`: per value a plain note, a dotted note, a
//   plain note and a rest, Task 0 T). Periods are rounded to whole units: single notes jitter by
//   ±1 unit (Task 0 outcome), so each plain period takes the nearest unit of its two samples' mean.
// - `pitches`: the 36 notes' frequencies as the buzzer logs them (`sound/composer/pitch-level-4`).
// - `gapUnits`: a note sounds for its period less this (the median gap of the sweep).
// - `timings`: the dot and C's clear after their key, and ▲/▼'s repeats (the hold recordings).
// - `previewDelayMs`, `volumeListMs`, `levelStepMs`: saved tones as ringing tones (D9).
// - `addComposerVolumes`: the pitch goldens join plan 16's volume tables (D4).
//
// Pure: reads goldens through injected loaders, imports only sibling scripts.
import type { Golden } from "./golden-format.ts";
import type { SoundGolden, SoundRow } from "./sound-format.ts";
import type { VolumeTables } from "./sound-programs.ts";

/** The Tempo list (Task 0 O), in list order. */
export const COMPOSER_TEMPI: readonly number[] = [
  40, 45, 50, 56, 63, 70, 80, 90, 100, 112, 125, 140, 160, 180, 200, 225,
];
/** The sweep's values in tone order (`VALUE_TONE` of gen_v639_plan27.py). */
export const SWEEP_VALUES: readonly number[] = [4, 8, 16, 32, 1, 2];
/** The emulator's timer unit (plan 23's measurement; `docs/specs/stock/sound.md`). */
export const COMPOSER_UNIT_MS = 7.745;

export interface ComposerPeriods {
  /** Units of a plain note (and a rest) of this value. */
  readonly plain: number;
  /** Units of a dotted note. */
  readonly dotted: number;
}

export interface ComposerData {
  readonly tempi: readonly number[];
  readonly unitMs: number;
  readonly gapUnits: number;
  /** Tempo (BPM) → value → periods in units. */
  readonly periods: Readonly<Record<string, Readonly<Record<string, ComposerPeriods>>>>;
  /** c1, #c1, d1, … b1, c2 … b3: 36 frequencies (Hz, as logged). */
  readonly pitches: readonly number[];
  readonly timings: {
    /** A note key still down this long after its key-down dots the note. */
    readonly dotMs: number;
    /** C still down this long after its key-down clears the tone. */
    readonly clearMs: number;
    /** ▲/▼ held: the first repeat after the key-down, then every `repeatEveryMs`. */
    readonly repeatFirstMs: number;
    readonly repeatEveryMs: number;
    /** The cursor's first blink step after the editor shows, then its steps (0.1 ms). */
    readonly blinkFirstMs: number;
    readonly blinkStepMs: number;
  };
  /** A saved tone's preview starts this long after ▲/▼ (the middle of the captured spread). */
  readonly previewDelayMs: number;
  /** The Ringing volume list plays a stored saved tone this long. */
  readonly volumeListMs: number;
  /** Level 5's jump and Ascending's steps: every this long from the tone's start (D9 nearest). */
  readonly levelStepMs: number;
  /** The buzzer register at every pitch while Ringing volume is unset (`pitch-virgin`). */
  readonly unsetVolume: number;
}

export class ComposerDataError extends Error {
  constructor(where: string, message: string) {
    super(`${where}: ${message}`);
    this.name = "ComposerDataError";
  }
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
};

/** A golden's buzzer notes: onset, end (the next buzzer row), frequency and volume. */
export function buzzerNotes(
  golden: SoundGolden,
): { readonly at: number; readonly end: number; readonly hz: number; readonly volume: number }[] {
  const rows = golden.rows.filter((r): r is SoundRow => r.output === "buzzer");
  const notes: { at: number; end: number; hz: number; volume: number }[] = [];
  rows.forEach((row, i) => {
    if (row.state.kind !== "sounding") return;
    const previous = notes.at(-1);
    // a volume change inside a note is the same note
    if (previous !== undefined && previous.end === row.ms && previous.hz === row.state.hz) {
      previous.end = rows[i + 1]?.ms ?? row.ms;
      return;
    }
    notes.push({
      at: row.ms,
      end: rows[i + 1]?.ms ?? row.ms,
      hz: row.state.hz,
      volume: row.state.volume,
    });
  });
  return notes;
}

/** Each value's periods at one tempo from its sweep golden (Task 0 T: c, e, g per value). */
export function sweepPeriods(
  golden: SoundGolden,
  unitMs = COMPOSER_UNIT_MS,
): {
  periods: Record<string, ComposerPeriods>;
  gaps: number[];
} {
  const notes = buzzerNotes(golden);
  const pattern = [523, 659, 784];
  // match the notes to the tone's 18, a missing one (a 1 ms note dropped by normalisation) skipped
  const onsets: (number | undefined)[] = [];
  const gaps: number[] = [];
  let n = 0;
  for (let i = 0; i < SWEEP_VALUES.length * 3; i++) {
    const note = notes[n];
    if (note !== undefined && note.hz === pattern[i % 3]) {
      onsets.push(note.at);
      const next = notes[n + 1];
      if (next !== undefined && i % 3 < 2) gaps.push(next.at - note.end);
      n++;
    } else onsets.push(undefined);
  }
  if (n !== notes.length) {
    throw new ComposerDataError(
      golden.id,
      `${notes.length} notes do not follow the sweep's pattern`,
    );
  }
  const periods: Record<string, ComposerPeriods> = {};
  SWEEP_VALUES.forEach((value, g) => {
    const [o1, o2, o3] = onsets.slice(3 * g, 3 * g + 3);
    const o4 = onsets[3 * g + 3];
    const samples: number[] = [];
    if (o1 !== undefined && o2 !== undefined) samples.push(o2 - o1);
    if (o3 !== undefined && o4 !== undefined) samples.push((o4 - o3) / 2); // a plain note, then its rest
    if (samples.length === 0) throw new ComposerDataError(golden.id, `no ${value} period`);
    const plain = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length / unitMs);
    let dotted: number | undefined;
    if (o2 !== undefined && o3 !== undefined) dotted = Math.round((o3 - o2) / unitMs);
    else if (o2 !== undefined && o4 !== undefined)
      dotted = Math.round((o4 - o2) / unitMs) - 2 * plain;
    if (dotted === undefined) throw new ComposerDataError(golden.id, `no dotted ${value} period`);
    periods[String(value)] = { plain, dotted };
  });
  return { periods, gaps };
}

/** The pitches of the 36-note tone (c1 … b3), from its Play golden. */
export function pitchTable(golden: SoundGolden): number[] {
  const hz = buzzerNotes(golden).map((note) => note.hz);
  if (hz.length !== 36) throw new ComposerDataError(golden.id, `${hz.length} notes, not 36`);
  for (let i = 12; i < 36; i++) {
    if (Math.abs(hz[i]! / hz[i - 12]! - 2) > 0.002) {
      throw new ComposerDataError(golden.id, `${hz[i]} Hz is not an octave over ${hz[i - 12]} Hz`);
    }
  }
  return hz;
}

/** A sound golden whose single held key (`keys`) sounds a note, then again at the dot. */
export function dotAfterKey(golden: SoundGolden): number {
  const notes = buzzerNotes(golden);
  if (notes.length !== 2) throw new ComposerDataError(golden.id, "expected the note and its dot");
  return notes[1]!.at - notes[0]!.at;
}

/**
 * Select on an empty slot (`composer/open-slot-*`, plan 14's `tree/05-tones/5-4-*.leaf`): the
 * first blink step after the editor draws (their median), then the mean of their steps within
 * 4 ms of the median step (the firmware alternates 478-482 ms and now and then runs 7-11 ms late:
 * those steps are left out).
 */
function blinkSteps(goldens: readonly Golden[]): { blinkFirstMs: number; blinkStepMs: number } {
  const firsts: number[] = [];
  const steps: number[] = [];
  for (const golden of goldens) {
    const rows = golden.timeline!;
    const t = golden.triggerFrame as number;
    const toggles = rows.slice(t + 1).map((row) => row.startMs - rows[t]!.startMs);
    if (toggles.length < 3) throw new ComposerDataError(golden.id, "too few blink steps");
    firsts.push(toggles[0]!);
    for (let i = 1; i < toggles.length; i++) steps.push(toggles[i]! - toggles[i - 1]!);
  }
  if (steps.length === 0) throw new ComposerDataError("blink", "no editor blink recording");
  const typical = median(steps);
  const kept = steps.filter((step) => Math.abs(step - typical) <= 4);
  const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
  return { blinkFirstMs: Math.round(median(firsts)), blinkStepMs: Math.round(mean * 10) / 10 };
}

/** Notation ink in a still (rows 7..37), less the cursor's column: 0 for an empty editor. */
function notationInk(pixels: Uint8Array): number {
  let ink = 0;
  for (let y = 7; y <= 37; y++) for (let x = 0; x < 84; x++) ink += pixels[y * 84 + x]!;
  return ink;
}

/**
 * C held on a tone (`composer/hold-c-<ms>`): the time from the deletion's redraw (the trigger
 * frame) to the frame that clears the notation (at most a cursor's ten pixels left).
 */
export function clearAfterDelete(golden: Golden): number | undefined {
  const rows = golden.timeline!;
  const t = golden.triggerFrame as number;
  const image = (i: number): Uint8Array =>
    golden.images.find((im) => im.name === rows[i]!.image)!.pixels;
  for (let i = t + 1; i < rows.length; i++) {
    if (notationInk(image(i)) <= 10) return Math.round(rows[i]!.startMs - rows[t]!.startMs);
  }
  return undefined;
}

/**
 * Every table from the goldens `load` reads: the sweep's 16 tempi, the pitch tone, the holds and
 * the previews. `loadLcd` reads the LCD goldens.
 */
export function extractComposerData(
  load: (id: string) => SoundGolden,
  loadLcd: (id: string) => Golden,
  ids: readonly string[],
  tables: VolumeTables,
): ComposerData {
  const periods: Record<string, Record<string, ComposerPeriods>> = {};
  const gaps: number[] = [];
  for (const bpm of COMPOSER_TEMPI) {
    const sweep = sweepPeriods(load(`sound/composer/tempo-${bpm}`));
    periods[String(bpm)] = sweep.periods;
    gaps.push(...sweep.gaps);
  }
  // The same tone at Levels 1 and 3 (40 and 225 BPM): the volume does not change the periods
  // beyond the ±2 units single samples spread by; those tempi take the median of the three.
  for (const bpm of ["40", "225"]) {
    const levels = ids
      .filter(
        (id) => id === `sound/composer/tempo-l1-${bpm}` || id === `sound/composer/tempo-l3-${bpm}`,
      )
      .map((id) => ({ id, periods: sweepPeriods(load(id)).periods }));
    for (const value of Object.keys(periods[bpm]!)) {
      const all = [periods[bpm]![value]!, ...levels.map((l) => l.periods[value]!)];
      for (const [i, p] of all.entries()) {
        const main = all[0]!;
        if (Math.abs(p.plain - main.plain) > 2 || Math.abs(p.dotted - main.dotted) > 2) {
          throw new ComposerDataError(
            levels[i - 1]!.id,
            `${value} is ${p.plain}/${p.dotted} units, ${main.plain}/${main.dotted} at Level 4`,
          );
        }
      }
      periods[bpm]![value] = {
        plain: median(all.map((p) => p.plain)),
        dotted: median(all.map((p) => p.dotted)),
      };
    }
  }
  const gapUnits = Math.round(median(gaps) / COMPOSER_UNIT_MS);

  const clears = ids
    .filter((id) => /^composer\/hold-c-\d+$/.test(id))
    .flatMap((id) => {
      const ms = clearAfterDelete(loadLcd(id));
      return ms === undefined ? [] : [{ held: Number(id.slice(id.lastIndexOf("-") + 1)), ms }];
    });
  if (clears.length === 0) throw new ComposerDataError("composer/hold-c-*", "no clear");
  const clearMs = Math.min(...clears.map((c) => c.ms));
  const longestKept = Math.max(
    ...ids
      .filter((id) => /^composer\/hold-c-\d+$/.test(id))
      .map((id) => Number(id.slice(id.lastIndexOf("-") + 1)))
      .filter((held) => !clears.some((c) => c.held === held)),
  );
  if (!(longestKept < clearMs + 50)) {
    throw new ComposerDataError("composer/hold-c-*", `held ${longestKept} ms kept the tone`);
  }

  const previews = ids.filter((id) => /^sound\/composer\/preview-slot-\d-/.test(id));
  const onsets = previews.flatMap((id) => {
    const golden = load(id);
    const first = buzzerNotes(golden)[0];
    return first === undefined ? [] : [first.at - (golden.keys?.[0]?.ms ?? 0)];
  });
  const volumeList = ids
    .filter((id) => /^sound\/composer\/preview-volume-\d$/.test(id))
    .map((id) => {
      const notes = buzzerNotes(load(id));
      return notes.at(-1)!.end - notes[0]!.at;
    });

  return {
    tempi: COMPOSER_TEMPI,
    unitMs: COMPOSER_UNIT_MS,
    gapUnits,
    periods,
    pitches: pitchTable(load("sound/composer/pitch-level-4")),
    timings: {
      dotMs: dotAfterKey(load("sound/composer/hold-note-3-800")),
      clearMs,
      // ▲/▼ held 2.5 s over 8 tokens (`composer/hold-up`, `hold-down`): the cursor's moves drawn
      // at 1411, 1607, 2379 and 2586 ms, 46 ms after their key's redraw, fit a first repeat at
      // 778 ms and one every 196 ms (Task 0 outcome; the release's own latency is not modelled).
      repeatFirstMs: 778,
      repeatEveryMs: 196,
      ...blinkSteps(
        ids
          .filter((id) => /^(composer\/open-slot-\d|tree\/05-tones\/5-4-\d\.leaf)$/.test(id))
          .map(loadLcd),
      ),
    },
    previewDelayMs: previewDelay(onsets),
    volumeListMs: median(volumeList),
    levelStepMs: levelStep(load, ids, tables),
    unsetVolume: unsetVolume(load("sound/composer/pitch-virgin")),
  };
}

/**
 * A saved tone's preview delay: the middle of the captured onsets (991-1035 ms after ▲/▼), so
 * every capture lies within plan 16's onset tolerance (25 ms) of it; throws if they spread wider.
 */
function previewDelay(onsets: readonly number[]): number {
  const low = Math.min(...onsets);
  const high = Math.max(...onsets);
  if (high - low > 50)
    throw new ComposerDataError("preview onsets", `${low}-${high} ms spread over 50 ms`);
  return Math.round((low + high) / 2);
}

/** The one register an unset Ringing volume plays every pitch at (Task 0 F: 3 throughout). */
function unsetVolume(golden: SoundGolden): number {
  const volumes = new Set(buzzerNotes(golden).map((note) => note.volume));
  if (volumes.size !== 1) throw new ComposerDataError(golden.id, `${volumes.size} registers`);
  return [...volumes][0]!;
}

/**
 * D9's nearest behaviour: the median time from a tone's start to its first level change (Level
 * 5's jump from Level 4's table, Ascending's first step from Level 1's) over the saved-tone
 * previews and the long Plays.
 */
function levelStep(
  load: (id: string) => SoundGolden,
  ids: readonly string[],
  tables: VolumeTables,
): number {
  const firsts = ids
    .filter((id) =>
      /^sound\/composer\/(preview-slot-\d-(level-5|ascending)|play-long-(level-5|ascending))$/.test(
        id,
      ),
    )
    .flatMap((id) => {
      const from = id.endsWith("level-5") ? "4" : "1";
      const notes = buzzerNotes(load(id));
      const start = notes[0]?.at;
      if (start === undefined) return [];
      const rows = load(id).rows.filter((r) => r.output === "buzzer");
      const change = rows.find(
        (r) => r.state.kind === "sounding" && tables[from]?.[String(r.state.hz)] !== r.state.volume,
      );
      return change === undefined ? [] : [change.ms - start];
    });
  if (firsts.length === 0) throw new ComposerDataError("level steps", "no level change");
  return median(firsts);
}

/**
 * The composer pitch goldens join plan 16's volume tables (D4): at Levels 1-4 (5 plays Level 4's
 * in a short tone), each note's register is the table's at that level. A
 * frequency the tables lack is added; one whose register disagrees throws, naming both goldens.
 */
export function addComposerVolumes(
  tables: VolumeTables,
  load: (id: string) => SoundGolden,
): VolumeTables {
  const out: Record<string, Record<string, number>> = Object.fromEntries(
    Object.entries(tables).map(([level, table]) => [level, { ...table }]),
  );
  const added = new Map<string, string>();
  for (const [id, level] of [
    ["sound/composer/pitch-level-1", "1"],
    ["sound/composer/pitch-level-2", "2"],
    ["sound/composer/pitch-level-3", "3"],
    ["sound/composer/pitch-level-4", "4"],
    ["sound/composer/pitch-level-5", "4"],
  ] as const) {
    for (const note of buzzerNotes(load(id))) {
      const table = (out[level] ??= {});
      const key = String(note.hz);
      const had = table[key];
      if (had === undefined) {
        table[key] = note.volume;
        added.set(`${level}:${key}`, id);
      } else if (had !== note.volume) {
        throw new ComposerDataError(
          id,
          `Level ${level} at ${key} Hz is ${note.volume}; ${added.get(`${level}:${key}`) ?? "the ringing tones"} have ${had}`,
        );
      }
    }
  }
  return out;
}
