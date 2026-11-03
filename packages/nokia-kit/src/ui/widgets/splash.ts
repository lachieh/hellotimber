import type { PhoneKey } from "@hellotimber/phone-core";
import type { SplashModel } from "../display/widgets";
import type { StockWidgetTimeline } from "../resources";
import { StockFlowApplication, type Flow, type Widget } from "./flow";
import { Playback } from "./playback";

/** A game's splash: plays its timeline, then reveals the game menu; any key skips it (P12). */
class SplashWidget implements Widget {
  readonly #playback: Playback;

  constructor(timeline: StockWidgetTimeline) {
    this.#playback = new Playback(timeline);
  }

  render(): SplashModel {
    const { frame, nextFrame } = this.#playback;
    return {
      kind: "splash",
      frame,
      ...(frame.kind === "cut" && nextFrame !== undefined ? { next: nextFrame } : {}),
    };
  }

  tick(dtMs: number, flow: Flow): void {
    this.#playback.advance(dtMs);
    if (this.#playback.ended) flow.back();
  }

  onKey(_key: PhoneKey, flow: Flow): void {
    flow.back();
  }
}

export function splash(timeline: StockWidgetTimeline): Widget {
  return new SplashWidget(timeline);
}

/** A game level's `intro` (phone-core SubmenuOptions.intro): its splash, then the list. */
export function splashIntro(id: string, timeline: StockWidgetTimeline): StockFlowApplication {
  return new StockFlowApplication(id, () => splash(timeline));
}
