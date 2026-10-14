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
