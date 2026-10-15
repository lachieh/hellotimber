// A Composer tone as sound (plan 27 D3, D4, D6, D9): its notes on the buzzer for their captured
// periods at the tone's tempo, at the Ringing volume's registers. Programs are built when a tone
// plays; nothing is recorded per tone.
import {
  COMPOSER_PERIODS,
  COMPOSER_PITCHES,
  COMPOSER_SOUND,
  RINGING_TONES,
  VOLUME_RULE,
} from "../resources";
import type { SoundProgram, SoundStep } from "../sound/program";
import { NOTE_PITCHES, type ComposerToken } from "./notation";

/** A saved tone (plan 27 Internal API; stored by `store.ts`). */
export interface ComposerTone {
  /** 1-15 characters. */
  readonly name: string;
  /** One of COMPOSER_TEMPI. */
  readonly tempo: number;
  /** 1-50 tokens. */
  readonly tokens: readonly ComposerToken[];
}

/** A built-in ringing tone's shape (plan 16), which a saved tone takes as Ringing tone 36-42. */
export type RingingTone = (typeof RINGING_TONES)[number];

/** A saved tone as a ringing tone: plan 16's shape, with its own preview delay (D9). */
export type UserRingingTone = RingingTone & { readonly previewDelayMs: number };

/** Semitones above c of each note. */
const SEMITONES: Readonly<Record<string, number>> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** A note's frequency (Hz, as the buzzer logs it). */
export function noteHz(token: Extract<ComposerToken, { kind: "note" }>): number {
  const index = (token.octave - 1) * 12 + SEMITONES[token.pitch]! + (token.sharp ? 1 : 0);
  const hz = COMPOSER_PITCHES[index];
  if (hz === undefined || !NOTE_PITCHES.includes(token.pitch)) {
    throw new Error(`No pitch for ${token.pitch}${token.octave}.`);
  }
  return hz;
}

/** A token's period in timer units at `tempo` (rests as plain notes). */
function periodUnits(token: ComposerToken, tempo: number): number {
  const periods = COMPOSER_PERIODS.byTempo[String(tempo)]?.[String(token.value)];
  if (periods === undefined) throw new Error(`No ${token.value} period at ${tempo} BPM.`);
  return token.kind === "note" && token.dotted ? periods.dotted : periods.plain;
}

/** Each token's start, sounding end and end in ms from the tone's start (whole units, rounded). */
function timing(
  tokens: readonly ComposerToken[],
  tempo: number,
): {
  readonly token: ComposerToken;
  readonly start: number;
  readonly off: number;
  readonly end: number;
}[] {
  const { unitMs, gapUnits } = COMPOSER_PERIODS;
  let units = 0;
  return tokens.map((token) => {
    const period = periodUnits(token, tempo);
    const start = Math.round(units * unitMs);
    const end = Math.round((units + period) * unitMs);
    const off =
      token.kind === "note"
        ? Math.max(start + 1, Math.round((units + period - gapUnits) * unitMs))
        : start;
    units += period;
    return { token, start, off, end };
  });
}

/** The tone's length in ms at its tempo. */
export function toneMs(tone: Pick<ComposerTone, "tempo" | "tokens">): number {
  return timing(tone.tokens, tone.tempo).at(-1)?.end ?? 0;
}

/** Level → frequency → register, with plan 16's nearest-frequency rule for a missing one. */
export function levelVolume(level: number, hz: number): number {
  const table = VOLUME_RULE.tables[String(level)];
  const exact = table?.[String(hz)];
  if (exact !== undefined) return exact;
  // UNVERIFIED: a frequency not captured at this level (Level 5 at 3729.2 and 3951.4 Hz) takes the
  // nearest captured frequency's register, as plan 16's sounder does.
  const nearest = Object.keys(table ?? {})
    .map(Number)
    .sort((a, b) => Math.abs(a - hz) - Math.abs(b - hz))[0];
  if (nearest === undefined) throw new Error(`No volume table for Level ${level}.`);
  return table![String(nearest)]!;
}

/** The registers a tone plays at: a level per time, or the unset volume's one register. */
type Volume = (hz: number, atMs: number) => number;

/**
 * The levels of a Play (D4, Task 0 P): Levels 1-4 their tables; Level 5 Level 4's, then the fifth
 * from the first level step (D9 nearest); Ascending Level 1's, one level up per step, capped at
 * the stored level; an unset volume the one register Task 0 F shows.
 */
export function playVolume(level: number | null, ascending = false): Volume {
  const step = COMPOSER_SOUND.levelStepMs;
  if (level === null) return () => COMPOSER_SOUND.unsetVolume;
  if (ascending) return (hz, at) => levelVolume(Math.min(level, 1 + Math.floor(at / step)), hz);
  if (level === 5) return (hz, at) => levelVolume(at < step ? 4 : 5, hz);
  return (hz) => levelVolume(level, hz);
}

/** Times the volume may change inside the tone (the level steps before `endMs`). */
function volumeChanges(level: number | null, ascending: boolean, endMs: number): number[] {
  if (level === null || (!ascending && level !== 5)) return [];
  const step = COMPOSER_SOUND.levelStepMs;
  const changes: number[] = [];
  for (let at = step; at < endMs && changes.length < (ascending ? level - 1 : 1); at += step) {
    changes.push(at);
  }
  return changes;
}

/**
 * The steps of `tokens` at `tempo`: each note on the buzzer until its period less the gap, rests
 * and gaps silent, split where the volume changes (a sounding note takes the new register at
 * once) and, with `vibrator`, where it toggles.
 */
function steps(
  tokens: readonly ComposerToken[],
  tempo: number,
  volume: Volume,
  changes: readonly number[],
  vibrator?: readonly number[],
): SoundStep[] {
  const notes = timing(tokens, tempo);
  const end = notes.at(-1)?.end ?? 0;
  const bounds = new Set<number>([0, end, ...changes.filter((t) => t < end)]);
  for (const n of notes) {
    bounds.add(n.start);
    bounds.add(n.off);
  }
  for (const t of vibrator ?? []) if (t < end) bounds.add(t);
  const times = [...bounds].sort((a, b) => a - b);
  const out: SoundStep[] = [];
  for (let i = 0; i < times.length - 1; i++) {
    const at = times[i]!;
    const note = notes.find((n) => n.start <= at && at < n.off && n.token.kind === "note");
    const buzzer =
      note === undefined || note.token.kind !== "note"
        ? null
        : { hz: noteHz(note.token), volume: volume(noteHz(note.token), at) };
    const vib =
      vibrator === undefined ? undefined : vibrator.filter((t) => t <= at).length % 2 === 0;
    out.push({ ms: times[i + 1]! - at, buzzer, ...(vib === undefined ? {} : { vibrator: vib }) });
  }
  return out;
}

/** Play (D6): the tone once at the Ringing volume `level` (null: unset), Ascending if asked. */
export function toneProgram(
  tone: Pick<ComposerTone, "tempo" | "tokens">,
  level: number | null,
  options: { readonly ascending?: boolean } = {},
): SoundProgram {
  const ascending = options.ascending ?? false;
  const changes = volumeChanges(level, ascending, toneMs(tone));
  return {
    id: "composer/play",
    steps: steps(tone.tokens, tone.tempo, playVolume(level, ascending), changes),
  };
}

/** The sound of an entry (K8): the note alone for its sounding time at `tempo`; rests none. */
export function notePreview(
  token: ComposerToken,
  tempo: number,
  level: number | null,
): SoundProgram | undefined {
  if (token.kind !== "note") return undefined;
  return { id: "composer/note", steps: steps([token], tempo, playVolume(level), []).slice(0, 1) };
}

/**
 * The vibrator's toggles (D9, Task 0 R): on at the start, toggling at the first token start at
 * or after every four quarter-note values of the tone.
 */
function vibratorToggles(tokens: readonly ComposerToken[], tempo: number): number[] {
  const toggles: number[] = [];
  let quarters = 0;
  let bar = 1;
  for (const n of timing(tokens, tempo)) {
    if (quarters >= bar * 4) {
      toggles.push(n.start);
      while (quarters >= bar * 4) bar++;
    }
    const value = 4 / n.token.value;
    quarters += n.token.kind === "note" && n.token.dotted ? value * 1.5 : value;
  }
  return toggles;
}

/** Where a time falls among a program's notes (plan 16's `NotePosition`). */
function positionOf(program: SoundProgram, atMs: number): { note: number; offsetMs: number } {
  let t = 0;
  let sounding: number | null = null;
  const starts: number[] = [];
  for (const step of program.steps) {
    if (step.buzzer !== undefined) {
      const hz = step.buzzer === null ? null : step.buzzer.hz;
      if (hz !== null && hz !== sounding) starts.push(t);
      sounding = hz;
    }
    t += step.ms;
  }
  const note = Math.max(0, starts.filter((s) => s <= atMs).length - 1);
  return { note, offsetMs: atMs - (starts[note] ?? 0) };
}

/**
 * A saved tone as Ringing tone 36-42 (D8, D9): one pass at Level 4's registers with its vibrator
 * track; the Ringing volume list's stop (`firstMarkStep`, `volumeListMs` in), its cycle (for
 * plan 22's `ring()`), and Level 5's jump and Ascending's steps every `levelStepMs` (D9's
 * nearest behaviour, UNVERIFIED).
 */
export function userRingingTone(tone: ComposerTone, slot: number): UserRingingTone {
  const length = toneMs(tone);
  const listStop = COMPOSER_SOUND.volumeListMs;
  const step = COMPOSER_SOUND.levelStepMs;
  const changes = [step, 2 * step, 3 * step, ...(listStop < length ? [listStop] : [])];
  const program: SoundProgram = {
    id: `composer/slot-${slot}`,
    steps: steps(
      tone.tokens,
      tone.tempo,
      (hz) => levelVolume(4, hz),
      changes,
      vibratorToggles(tone.tokens, tone.tempo),
    ),
  };
  let t = 0;
  let firstMarkStep = program.steps.length;
  program.steps.forEach((s, i) => {
    if (t === listStop) firstMarkStep = i;
    t += s.ms;
  });
  return {
    name: tone.name,
    slug: `composer-${slot}`,
    program,
    firstMarkStep,
    cycleMs: length,
    level5At: positionOf(program, step),
    ascendingAt: [1, 2, 3].map((k) => positionOf(program, k * step)),
    previewDelayMs: COMPOSER_SOUND.previewDelayMs,
  };
}
