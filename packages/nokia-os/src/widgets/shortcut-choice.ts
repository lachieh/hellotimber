import { Timeline } from "@hellotimber/phone-core";
import type { ShortcutChoiceModel } from "../display/widgets";
import { timelineByName } from "../firmware/timelines";
import type { Flow, Widget } from "./flow";
import { Playback } from "./playback";

/**
 * How long the chosen option's label shows (2026-10-14 probes: 1913-1914 ms from its redraw in
 * `t3` and `s3`; `u1`, whose digit came while the list was about to open, 1934 ms).
 */
export const SHORTCUT_CHOICE_MS = 1913;

/** The label, then the partial draw toward standby that closes Invalid shortcut too. */
function choiceTimeline() {
  const invalid = timelineByName("invalid-shortcut");
  const closing = invalid.timeline.steps[invalid.timeline.steps.length - 1]!;
  const partial = invalid.frames[closing.frame];
  if (partial?.kind !== "edges") throw new Error("Invalid shortcut ends without a partial draw.");
  return {
    partial,
    playback: new Playback({
      frames: [{ kind: "plain" }, partial],
      timeline: new Timeline([
        { frame: 0, durationMs: SHORTCUT_CHOICE_MS },
        { frame: 1, durationMs: closing.durationMs },
      ]),
    }),
  };
}

/**
 * What a stock shortcut digit that chose an option shows (Menu 8 6 3, then 1: Shakes' `Off`):
 * only the option's label at the bottom right, then standby. Keys meanwhile are UNVERIFIED and
 * ignored.
 */
class ShortcutChoiceWidget implements Widget {
  readonly #label: string;
  readonly #timeline = choiceTimeline();

  constructor(label: string) {
    this.#label = label;
  }

  render(): ShortcutChoiceModel {
    const { playback, partial } = this.#timeline;
    return {
      kind: "shortcut-choice",
      label: this.#label,
      ...(playback.frameIndex === 1 ? { partial } : {}),
    };
  }

  tick(dtMs: number, flow: Flow): void {
    const { playback } = this.#timeline;
    playback.advance(dtMs);
    if (playback.ended) flow.standby();
  }
}

export function shortcutChoice(label: string): Widget {
  return new ShortcutChoiceWidget(label);
}
