// The sound sequencer (plan 16 D5, Task 4): pure, driven by the kernel clock. It plays programs
// on three outputs and emits every change of an output, stamped with the time it happens at,
// once `advance` reaches that time, so the events are the same at any tick rate.
//
// Ownership: a program claims the outputs its steps name when it starts. The latest program to
// start on an output owns it; an older one loses that output for good (a keypad beep does not
// stop a preview: they use the tone generator and the buzzer). An output nobody owns, or whose
// owner ended or was stopped, is off.
import type { StockSoundEvent } from "./port";
import type { SoundNote, SoundProgram } from "./program";

export type SoundOutput = "buzzer" | "tone" | "vibrator";
const OUTPUTS: readonly SoundOutput[] = ["buzzer", "tone", "vibrator"];

/**
 * A volume rule applied while a program plays (D10): `of` gives an output's register from the
 * program's own (`stored`) at `offsetMs` into the program. It is read at each step's start and
 * again at each of `changesAtMs`, where a sounding note takes the new value at once (Level 5's
 * jump and Ascending's steps are times, not notes: plan 16 Task 3).
 */
export interface SoundVolume {
  readonly changesAtMs: readonly number[];
  of(output: "buzzer" | "tone", hz: number, stored: number, offsetMs: number): number;
}

export interface PlayOptions {
  readonly volume?: SoundVolume;
  /** Play steps `0 .. endStep - 1` once (a preview cut at a cycle mark). */
  readonly endStep?: number;
}

/** A program started by `play`: the handle `cancel` and `playing` take. */
export interface SoundPlay {
  readonly program: SoundProgram;
  readonly startMs: number;
}

type Held = SoundNote | null | boolean;

/** A program's timing and each output's state per step, worked out once. */
interface Score {
  /** Step start offsets, then the program's length. */
  readonly bounds: readonly number[];
  readonly loopFrom: number | undefined;
  /** Each output's state during step i of the first pass, and of later passes. */
  readonly first: Readonly<Record<SoundOutput, readonly Held[]>>;
  readonly again: Readonly<Record<SoundOutput, readonly Held[]>>;
  readonly outputs: ReadonlySet<SoundOutput>;
}

function scoreOf(program: SoundProgram, endStep: number | undefined): Score {
  const steps = endStep === undefined ? program.steps : program.steps.slice(0, endStep);
  const loopFrom =
    endStep === undefined && program.loopFrom !== undefined && program.loopFrom < steps.length
      ? program.loopFrom
      : undefined;
  if (steps.length === 0) throw new Error(`Sound program ${program.id} has no steps.`);
  const bounds = [0];
  for (const step of steps) {
    if (!Number.isInteger(step.ms) || step.ms <= 0) {
      throw new Error(`Sound program ${program.id} has a step of ${step.ms} ms.`);
    }
    bounds.push(bounds.at(-1)! + step.ms);
  }
  const outputs = new Set<SoundOutput>();
  const pass = (from: number, carry: Record<SoundOutput, Held>) => {
    const held = { buzzer: [] as Held[], tone: [] as Held[], vibrator: [] as Held[] };
    const now = { ...carry };
    steps.forEach((step, i) => {
      if (i < from) return;
      for (const output of OUTPUTS) {
        const value = step[output];
        if (value === undefined) continue;
        outputs.add(output);
        now[output] = value;
      }
      for (const output of OUTPUTS) held[output][i] = now[output];
    });
    return { held, end: now };
  };
  const off: Record<SoundOutput, Held> = { buzzer: null, tone: null, vibrator: false };
  const first = pass(0, off);
  const again = loopFrom === undefined ? first : pass(loopFrom, first.end);
  return { bounds, loopFrom, first: first.held, again: again.held, outputs };
}

interface Play extends SoundPlay {
  readonly seq: number;
  readonly score: Score;
  readonly volume: SoundVolume | undefined;
  /** stop/cancel times, by output. */
  readonly cut: Map<SoundOutput, number>;
  /** Outputs a later program took. */
  readonly lost: Set<SoundOutput>;
  /** The next time this program may change an output. */
  next: number;
}

const length = (score: Score): number => score.bounds.at(-1)!;

/** The step sounding `offset` ms into the score, and whether it is a later pass; null after the end. */
function stepAt(score: Score, offset: number): { index: number; again: boolean } | null {
  const total = length(score);
  const { bounds, loopFrom } = score;
  let at = offset;
  let again = false;
  if (at >= total) {
    if (loopFrom === undefined) return null;
    const start = bounds[loopFrom]!;
    at = start + ((at - total) % (total - start));
    again = true;
  }
  let index = 0;
  while (bounds[index + 1]! <= at) index++;
  return { index, again };
}

/** The first step boundary or volume change strictly after `offset` (Infinity: none). */
function boundaryAfter(play: Play, offset: number): number {
  const { bounds, loopFrom } = play.score;
  const total = length(play.score);
  let next = Infinity;
  if (offset < 0) next = 0;
  else if (offset < total) next = bounds.find((b) => b > offset)!;
  else if (loopFrom !== undefined) {
    const start = bounds[loopFrom]!;
    const period = total - start;
    const pass = Math.floor((offset - total) / period);
    const within = offset - total - pass * period;
    const b = bounds.slice(loopFrom + 1).find((x) => x - start > within)!;
    next = total + pass * period + (b - start);
  }
  for (const change of play.volume?.changesAtMs ?? []) {
    if (change > offset && change < next) next = change;
  }
  return next;
}

function sameEvent(a: StockSoundEvent | undefined, b: StockSoundEvent): boolean {
  if (a === undefined) return b.output === "vibrator" ? !b.on : b.hz === null;
  if (a.output === "vibrator" || b.output === "vibrator") {
    return a.output === "vibrator" && b.output === "vibrator" && a.on === b.on;
  }
  if (a.hz === null || b.hz === null) return a.hz === b.hz;
  return a.hz === b.hz && a.volume === b.volume;
}

export class SoundSequencer {
  readonly #emit: (event: StockSoundEvent) => void;
  #plays: Play[] = [];
  /** Extra times to look at: stops and cancels. */
  #checks: number[] = [];
  /** Every change up to this time has been emitted. */
  #time = -Infinity;
  #seq = 0;
  readonly #last = new Map<SoundOutput, StockSoundEvent>();

  constructor(emit: (event: StockSoundEvent) => void) {
    this.#emit = emit;
  }

  /**
   * Starts `program` at `atMs` (or at the time already reached, if later) on the outputs it
   * uses, replacing what played there.
   */
  play(program: SoundProgram, atMs: number, options: PlayOptions = {}): SoundPlay {
    const startMs = Math.max(atMs, this.#time);
    const play: Play = {
      program,
      startMs,
      seq: this.#seq++,
      score: scoreOf(program, options.endStep),
      volume: options.volume,
      cut: new Map(),
      lost: new Set(),
      next: startMs,
    };
    this.#plays.push(play);
    return play;
  }

  /** Silences `outputs` at `atMs`: the programs playing there by then lose them. */
  stop(outputs: readonly SoundOutput[], atMs: number): void {
    const at = Math.max(atMs, this.#time);
    for (const play of this.#plays) {
      if (play.startMs > at) continue;
      for (const output of outputs) this.#cut(play, output, at);
    }
    this.#checks.push(at);
  }

  /** Ends `play` at `atMs`; a program that has not started by then never sounds. */
  cancel(handle: SoundPlay, atMs: number): void {
    const play = this.#plays.find((p) => p === handle);
    if (play === undefined) return;
    const at = Math.max(atMs, this.#time);
    for (const output of OUTPUTS) this.#cut(play, output, at);
    this.#checks.push(at);
  }

  /** Whether `play` still sounds or is still to start (at the time reached). */
  playing(handle: SoundPlay): boolean {
    const play = this.#plays.find((p) => p === handle);
    if (play === undefined) return false;
    const now = Math.max(this.#time, play.startMs);
    const offset = this.#time - play.startMs;
    if (play.score.loopFrom === undefined && offset >= length(play.score)) return false;
    return [...play.score.outputs].some(
      (output) => !play.lost.has(output) && (play.cut.get(output) ?? Infinity) > now,
    );
  }

  /** The last change emitted on `output`. */
  last(output: SoundOutput): StockSoundEvent | undefined {
    return this.#last.get(output);
  }

  /** Emits every change due up to `nowMs`, in time order (ties: buzzer, tone, vibrator). */
  advance(nowMs: number): void {
    for (;;) {
      let t = Infinity;
      for (const play of this.#plays) t = Math.min(t, play.next);
      for (const check of this.#checks) t = Math.min(t, check);
      if (t > nowMs || t === Infinity) break;
      this.#evaluate(t);
      this.#checks = this.#checks.filter((check) => check > t);
      for (const play of this.#plays) {
        if (play.next <= t) play.next = play.startMs + boundaryAfter(play, t - play.startMs);
      }
      this.#time = t;
      this.#collect(t);
    }
    if (nowMs > this.#time) this.#time = nowMs;
  }

  #cut(play: Play, output: SoundOutput, at: number): void {
    play.cut.set(output, Math.min(play.cut.get(output) ?? Infinity, at));
  }

  /** Whether `play` really started on `output` (it was not stopped at or before its start). */
  #started(play: Play, output: SoundOutput): boolean {
    return play.score.outputs.has(output) && (play.cut.get(output) ?? Infinity) > play.startMs;
  }

  /** The latest program to have started on `output` by `t`. */
  #owner(output: SoundOutput, t: number): Play | undefined {
    let owner: Play | undefined;
    for (const play of this.#plays) {
      if (play.startMs > t || play.lost.has(output) || !this.#started(play, output)) continue;
      if (
        owner === undefined ||
        play.startMs > owner.startMs ||
        (play.startMs === owner.startMs && play.seq > owner.seq)
      ) {
        owner = play;
      }
    }
    return owner;
  }

  #stateAt(output: SoundOutput, t: number): StockSoundEvent {
    const silent: StockSoundEvent =
      output === "vibrator" ? { output, atMs: t, on: false } : { output, atMs: t, hz: null };
    const play = this.#owner(output, t);
    if (play === undefined || t >= (play.cut.get(output) ?? Infinity)) return silent;
    const offset = t - play.startMs;
    const step = stepAt(play.score, offset);
    if (step === null) return silent;
    const held = (step.again ? play.score.again : play.score.first)[output][step.index]!;
    if (output === "vibrator") return { output, atMs: t, on: held === true };
    if (held === null || typeof held === "boolean") return silent;
    const volume = play.volume?.of(output, held.hz, held.volume, offset) ?? held.volume;
    return { output, atMs: t, hz: held.hz, volume };
  }

  #evaluate(t: number): void {
    for (const output of OUTPUTS) {
      const event = this.#stateAt(output, t);
      if (sameEvent(this.#last.get(output), event)) continue;
      this.#last.set(output, event);
      this.#emit(event);
    }
  }

  /** Marks outputs taken by later programs and drops programs with nothing left to play. */
  #collect(t: number): void {
    for (const output of OUTPUTS) {
      const owner = this.#owner(output, t);
      if (owner === undefined) continue;
      for (const play of this.#plays) {
        if (play !== owner && play.startMs <= t && play.score.outputs.has(output)) {
          if (play.startMs < owner.startMs || play.seq < owner.seq) play.lost.add(output);
        }
      }
    }
    this.#plays = this.#plays.filter((play) => {
      if (play.startMs > t) return true;
      if (play.next !== Infinity) {
        return [...play.score.outputs].some(
          (output) => !play.lost.has(output) && (play.cut.get(output) ?? Infinity) > t,
        );
      }
      return false;
    });
  }
}
