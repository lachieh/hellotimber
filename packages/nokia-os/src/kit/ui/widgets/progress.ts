import type { PhoneKey } from "@hellotimber/phone-core";
import type { ProgressModel } from "../display/widgets";
import type { StockWidgetTimeline } from "../resources";
import type { Flow, Widget } from "./flow";
import { Playback } from "./playback";

export interface ProgressOptions {
  /** `Requesting`, `Searching`. */
  readonly text: string;
  readonly softkey: string;
  /** The bar's looping timeline (the network never answers in the captures). */
  readonly timeline: StockWidgetTimeline;
  /**
   * Quit (the soft key) and C. Default: back at once (P7: C on `Searching`). Requesting's Quit
   * shows `Request not confirmed`, then standby (P7).
   */
  readonly quit?: (flow: Flow) => void;
}

/** A progress note: the hatched bar looping until Quit or C. */
class ProgressWidget implements Widget {
  readonly #options: ProgressOptions;
  readonly #playback: Playback;

  constructor(options: ProgressOptions) {
    this.#options = options;
    this.#playback = new Playback(options.timeline);
  }

  render(): ProgressModel {
    const { frame } = this.#playback;
    if (frame.kind !== "sprite") throw new Error(`A progress bar cannot show "${frame.kind}".`);
    return {
      kind: "progress",
      text: this.#options.text,
      bar: frame.sprite,
      softkey: this.#options.softkey,
    };
  }

  tick(dtMs: number): void {
    this.#playback.advance(dtMs);
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (key !== "navi" && key !== "c") return;
    const { quit } = this.#options;
    if (quit === undefined) flow.back();
    else quit(flow);
  }
}

export function progress(options: ProgressOptions): Widget {
  return new ProgressWidget(options);
}
