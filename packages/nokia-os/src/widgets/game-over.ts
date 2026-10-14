// The games' game-over screens (plan 23 D13): the plain note, or a new top score's fireworks
// followed by the note, as one timeline each. Shared with Space impact, Pairs II and Bantumi
// (plan 24): parameterised by the label, the score text and where the menu returns.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { GameOverModel } from "../display/widgets";
import { WIDGET_TIMELINE_BY_NAME, WIDGET_TIMELINES, type StockWidgetTimeline } from "../resources";
import type { Flow, Widget } from "./flow";
import { Playback } from "./playback";

export interface GameOverOptions {
  /** A new top score: the fireworks and `TOP SCORE:`; else `Your score:`. */
  readonly topScore: boolean;
  readonly score: string;
  /** Where the game menu returns: the child selected, on the window's top row (Task 0 H14). */
  readonly select: string;
}

function named(name: string): StockWidgetTimeline {
  const found = WIDGET_TIMELINES[WIDGET_TIMELINE_BY_NAME[name] ?? ""];
  if (found === undefined) throw new Error(`No named widget timeline "${name}".`);
  return found;
}

/**
 * Plays the screen's timeline (`game-over-fireworks` or `game-over-note`), then returns to the
 * game menu. Navi or C skips to the menu at once; other keys are ignored (Task 0 C12). Keys act
 * on key-down, like the game's.
 */
class GameOverWidget implements Widget {
  readonly #options: GameOverOptions;
  readonly #playback: Playback;

  constructor(options: GameOverOptions) {
    this.#options = options;
    this.#playback = new Playback(
      named(options.topScore ? "game-over-fireworks" : "game-over-note"),
    );
  }

  render(): GameOverModel {
    return {
      kind: "game-over",
      frame: this.#playback.frame,
      label: this.#options.topScore ? "TOP SCORE:" : "Your score:",
      score: this.#options.score,
    };
  }

  tick(dtMs: number, flow: Flow): void {
    this.#playback.advance(dtMs);
    if (this.#playback.ended) this.#end(flow);
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    if (key === "navi" || key === "c") this.#end(flow);
  }

  #end(flow: Flow): void {
    flow.back(1, { select: this.#options.select, row: "top" });
  }
}

export function gameOver(options: GameOverOptions): Widget {
  return new GameOverWidget(options);
}
