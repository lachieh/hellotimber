// Sound and vibration cues (plan 23 D8): the games emit them, the session stamps them with the
// kernel time, and plan 16 plays them. Internal until plan 16; not exported from the package.

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
