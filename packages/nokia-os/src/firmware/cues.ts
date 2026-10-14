// Sound and vibration cues (plan 23 D8): the games emit them, the session stamps them with the
// kernel time, and the phone's sounder plays them (plan 16 D13). Internal; not exported.

export type StockCue =
  /** A meal (food or creature): 2636.9 Hz for one timer unit, 6-7 ms (plan 16 Task 0). */
  | { readonly kind: "eat" }
  /** The second blocked tick: three 440 Hz pulses of 15 ms. */
  | { readonly kind: "crash" }
  /**
   * A new top score's fireworks tune (587/880 Hz), 2045 ms after the crash, 21 ms before the
   * death steps end (plan 16 Task 0: `sound/game/snake-top-score`).
   */
  | { readonly kind: "top-score" }
  /** The vibrator: ≈480 ms per meal and at the crash (with Shakes On). */
  | { readonly kind: "vibrate"; readonly ms: number }
  /**
   * The key going down now makes no beep: the game-over screens (plan 16 Task 0:
   * `sound/game/snake-keys`, a 3 on the note).
   */
  | { readonly kind: "silent-key" };

export interface StockCueSink {
  cue(cue: StockCue, atMs: number): void;
}

/** A sink that drops every cue (tests, and a games holder outside a phone). */
export const NO_CUES: StockCueSink = { cue() {} };
