// Sound programs (plan 16 D5): what the sequencer plays. Generated programs
// (`src/resources/generated/sounds.ts`) have this shape.

/** An output's sounding state: a frequency at the firmware's level register. */
export interface SoundNote {
  readonly hz: number;
  readonly volume: number;
}

/**
 * One step: the outputs it sets at its start (`undefined` = unchanged, `null` = off), held for
 * `ms` (a positive integer).
 */
export interface SoundStep {
  readonly ms: number;
  readonly buzzer?: SoundNote | null;
  readonly tone?: SoundNote | null;
  readonly vibrator?: boolean;
}

export interface SoundProgram {
  readonly id: string;
  readonly steps: readonly SoundStep[];
  /** The step index the program repeats from; absent = plays once. */
  readonly loopFrom?: number;
}

/**
 * The start time of each note of `program`'s buzzer: a step that sounds a new frequency (a
 * volume change within a note is the same note).
 */
export function noteStarts(program: SoundProgram): number[] {
  const starts: number[] = [];
  let sounding: number | null = null;
  let t = 0;
  for (const step of program.steps) {
    if (step.buzzer !== undefined) {
      const hz = step.buzzer === null ? null : step.buzzer.hz;
      if (hz !== null && hz !== sounding) starts.push(t);
      sounding = hz;
    }
    t += step.ms;
  }
  return starts;
}
