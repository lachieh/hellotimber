// The telephone's sounds (plan 22 D7-D9), measured on the factory sound goldens
// (`goldens/sound/calls/*`; tests/sound-calls.test.ts plays each program against its golden).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { SoundProgram } from "../ui/sound/program";
import { EARPIECE_STEPS, type CallTones } from "../../services/calls/telephone";

export { EARPIECE_STEPS };

/** The DTMF pair of each dial key: the high and the low group (Hz), as the tone generator plays. */
export const DTMF_PAIRS: Readonly<Partial<Record<PhoneKey, readonly [number, number]>>> = {
  "1": [1209, 697],
  "2": [1336, 697],
  "3": [1477, 697],
  "4": [1209, 770],
  "5": [1336, 770],
  "6": [1477, 770],
  "7": [1209, 852],
  "8": [1336, 852],
  "9": [1477, 852],
  "*": [1209, 941],
  "0": [1336, 941],
  "#": [1477, 941],
};

/**
 * A held key's pair sounds until this long after its release (`sound/calls/dtmf-hold-*`: 1 s held,
 * the pair off ≈56 ms after the release); a tap sounds a key beep's length (`dtmf-keys`).
 */
export const DTMF_TAIL_MS = 56;

/** The earpiece's tone level word at the top Volume (`sound/calls/connected`: 0x99B5). */
export const EARPIECE_TOP_WORD = 0x99b5;
/** The tone level word of earpiece Volume `level` (1-10): one step per bar (`volume-top`). */
export function earpieceWord(level: number): number {
  return EARPIECE_TOP_WORD + (EARPIECE_STEPS - level);
}

/**
 * The ringback (`sound/calls/ringback`): 425 Hz on the tone generator, ≈1016 ms on, ≈3820 ms off,
 * from ≈2218 ms after Call (≈34 ms after the alerting redraw).
 */
export function ringbackProgram(word: number): SoundProgram {
  return {
    id: "calls/ringback",
    steps: [
      { ms: 1016, tone: { hz: 425, volume: word } },
      { ms: 3820, tone: null },
    ],
    loopFrom: 0,
  };
}

/** The ringback starts this long after the alerting redraw. */
export const RINGBACK_AFTER_ALERTING_MS = 34;

/**
 * The network's end (`sound/calls/net-end`): three 1000 Hz beeps, ≈290 ms on and ≈190 ms off,
 * from ≈104 ms after the release.
 */
export function netEndProgram(word: number): SoundProgram {
  const beep = { ms: 290, tone: { hz: 1000, volume: word } } as const;
  const gap = { ms: 186, tone: null } as const;
  return { id: "calls/net-end", steps: [beep, gap, beep, gap, { ...beep, ms: 294 }] };
}

export const NET_END_BEEPS_AFTER_MS = 104;

/**
 * An emergency call's beep in the earpiece (`sound/calls/emergency`): 900 Hz for 54 ms, 88 ms
 * after Call.
 */
export function emergencyProgram(word: number): SoundProgram {
  return { id: "calls/emergency", steps: [{ ms: 54, tone: { hz: 900, volume: word } }] };
}

export const EMERGENCY_BEEP_AFTER_MS = 88;

/** Volume's tone: 1125 Hz for ≈322 ms at the earpiece word (`sound/calls/volume-top`). */
export const VOLUME_TONE_MS = 322;

/**
 * Volume's tone (`sound/calls/volume-top`, `in-call-keys`): ▲ at the top and every ▼ sound 1125 Hz
 * at the new level's word, `ms` long (a tone still sounding ends the new one with it).
 */
export function volumeTopProgram(word: number, ms: number = VOLUME_TONE_MS): SoundProgram {
  return { id: "calls/volume-top", steps: [{ ms, tone: { hz: 1125, volume: word } }] };
}

/**
 * Beep once's ringing (`sound/calls/ring-beep-once-vibrator-on`): one 3000 Hz buzzer beep of 88 ms
 * at register 18, the vibrator 480 ms on, 968 ms off for as long as it rings.
 */
export const BEEP_ONCE_RING: SoundProgram = {
  id: "calls/ring-beep-once",
  steps: [
    { ms: 88, buzzer: { hz: 3000.2, volume: 18 } },
    { ms: 1, buzzer: null },
  ],
};

export const BEEP_ONCE_VIBRATOR: SoundProgram = {
  id: "calls/ring-beep-once-vibrator",
  steps: [
    { ms: 480, vibrator: true },
    { ms: 968, vibrator: false },
  ],
  loopFrom: 0,
};

/**
 * Off's ringing (`sound/calls/ring-off-vibrator-on`): the vibrator only, three ≈712 ms pulses
 * ≈713 ms apart per ≈6018 ms cycle.
 */
export const OFF_VIBRATOR: SoundProgram = {
  id: "calls/ring-off-vibrator",
  steps: [
    { ms: 712, vibrator: true },
    { ms: 713, vibrator: false },
    { ms: 712, vibrator: true },
    { ms: 728, vibrator: false },
    { ms: 728, vibrator: true },
    { ms: 2425, vibrator: false },
  ],
  loopFrom: 0,
};

/** Factory plan22b/factory-sound/dtmf: 146 ms pairs, approximately 295 ms apart. */
export function transmittedDtmfProgram(text: string, volume: number): SoundProgram {
  const pairs = Array.from(text).flatMap((key) => {
    const pair = DTMF_PAIRS[key as PhoneKey];
    return pair === undefined
      ? []
      : [
          { ms: 146, tone: { hz: pair[0], hz2: pair[1], volume } },
          { ms: 149, tone: null },
        ];
  });
  return { id: "calls/transmitted-dtmf", steps: [{ ms: 264 }, ...pairs] };
}

/** The telephone's sounds (src/services/calls/telephone.ts) at an earpiece Volume. */
export const STOCK_CALL_TONES: CallTones = {
  ringback: {
    program: (volume) => ringbackProgram(earpieceWord(volume)),
    afterMs: RINGBACK_AFTER_ALERTING_MS,
  },
  netEnd: {
    program: (volume) => netEndProgram(earpieceWord(volume)),
    afterMs: NET_END_BEEPS_AFTER_MS,
  },
  emergency: {
    program: (volume) => emergencyProgram(earpieceWord(volume)),
    afterMs: EMERGENCY_BEEP_AFTER_MS,
  },
};
