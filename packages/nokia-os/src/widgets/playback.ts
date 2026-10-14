import type { StockWidgetTimeline, WidgetFrame } from "../resources";

/** A widget timeline being played: elapsed time from the widget's first frame (D8). */
export class Playback {
  readonly #timeline: StockWidgetTimeline;
  #elapsed = 0;

  constructor(timeline: StockWidgetTimeline) {
    this.#timeline = timeline;
  }

  advance(dtMs: number): void {
    this.#elapsed += dtMs;
  }

  /** The finite timeline has played out (never for a loop). */
  get ended(): boolean {
    return this.#elapsed >= this.#timeline.timeline.durationMs;
  }

  get frameIndex(): number {
    return this.#timeline.timeline.frameAt(this.#elapsed);
  }

  get frame(): WidgetFrame {
    return this.#timeline.frames[this.frameIndex]!;
  }

  /** The frame after the current one in the timeline's frame list (a `cut`'s target). */
  get nextFrame(): WidgetFrame | undefined {
    return this.#timeline.frames[this.frameIndex + 1];
  }
}
