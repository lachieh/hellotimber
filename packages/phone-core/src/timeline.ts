export interface TimelineStep {
  /** Non-negative integer; host-defined frame index (the painter maps it to pixels). */
  frame: number;
  /** Positive integer. */
  durationMs: number;
}

/** A sequence of frames with durations. Holds no pixels; the kernel only resolves which frame is visible. */
export class Timeline {
  readonly steps: readonly TimelineStep[];
  /** One pass, in ms; Infinity when `loopFrom` is set. */
  readonly durationMs: number;
  readonly #loopFrom: number | undefined;
  readonly #passMs: number;
  readonly #loopStartMs: number;

  constructor(steps: readonly TimelineStep[], options: { loopFrom?: number } = {}) {
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error("Timeline requires at least one step.");
    }
    const copy = steps.map((step, index) => {
      if (!Number.isInteger(step?.frame) || step.frame < 0) {
        throw new Error(`Timeline step ${index} frame must be a non-negative integer.`);
      }
      if (!Number.isInteger(step.durationMs) || step.durationMs <= 0) {
        throw new Error(`Timeline step ${index} durationMs must be a positive integer.`);
      }
      return Object.freeze({ frame: step.frame, durationMs: step.durationMs });
    });
    const { loopFrom } = options;
    if (
      loopFrom !== undefined &&
      (!Number.isInteger(loopFrom) || loopFrom < 0 || loopFrom >= copy.length)
    ) {
      throw new Error(`Timeline loopFrom ${loopFrom} must index one of its ${copy.length} steps.`);
    }
    this.steps = Object.freeze(copy);
    this.#loopFrom = loopFrom;
    this.#passMs = copy.reduce((sum, step) => sum + step.durationMs, 0);
    this.#loopStartMs = copy
      .slice(0, loopFrom ?? 0)
      .reduce((sum, step) => sum + step.durationMs, 0);
    this.durationMs = loopFrom === undefined ? this.#passMs : Infinity;
    Object.freeze(this);
  }

  /** Visible frame `elapsedMs` after start. Holds the last step unless looping. */
  frameAt(elapsedMs: number): number {
    let t = Math.max(0, elapsedMs);
    if (t >= this.#passMs) {
      if (this.#loopFrom === undefined) return this.steps[this.steps.length - 1]!.frame;
      t = this.#loopStartMs + ((t - this.#loopStartMs) % (this.#passMs - this.#loopStartMs));
    }
    for (const step of this.steps) {
      if (t < step.durationMs) return step.frame;
      t -= step.durationMs;
    }
    return this.steps[this.steps.length - 1]!.frame;
  }
}
