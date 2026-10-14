// Sound and vibration cues (plan 23 D8): the games emit them, the session stamps them with the
// kernel time, and the phone's sounder plays them (plan 16 D13). Internal; not exported.

export type StockCue =
  /** A meal (food or creature): 2637 Hz for one or two units (with Warning tones On). */
  | { readonly kind: "eat" }
  /** The second blocked tick: three 440 Hz beeps of ≈15 ms. */
  | { readonly kind: "crash" }
  /** UNVERIFIED (RE sound 0x23; not captured with Warning tones On). */
  | { readonly kind: "top-score" }
  /** The vibrator: ≈480 ms per meal and at the crash (with Shakes On). */
  | { readonly kind: "vibrate"; readonly ms: number };

export interface StockCueSink {
  cue(cue: StockCue, atMs: number): void;
}

/** A sink that drops every cue (tests, and a games holder outside a phone). */
export const NO_CUES: StockCueSink = { cue() {} };
