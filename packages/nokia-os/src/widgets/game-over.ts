// The games' game-over screens (plan 23 D13, plan 24 D11): an ending each, as one timeline: the
// plain score note, or a new top score's fireworks followed by the note; Bantumi's won, draw and
// lost endings come with plan 24b's resources. Parameterised by the ending and where the menu
// returns.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { GameOverModel } from "@hellotimber/nokia-kit/ui/display/widgets";
import {
  WIDGET_TIMELINE_BY_NAME,
  WIDGET_TIMELINES,
  type StockWidgetTimeline,
} from "@hellotimber/nokia-kit/ui/resources";
import type { Flow, Widget } from "@hellotimber/nokia-kit/ui/widgets/flow";
import { Playback } from "@hellotimber/nokia-kit/ui/widgets/playback";
import type { StockGames } from "../firmware/features/games";

/**
 * How a game ends (D11): `score` (`Game over!` / `Your score:` / the score), `top-score` (the
 * fireworks, then `TOP SCORE:` / the score), and Bantumi's `won` (fireworks, `YOU WON!`), `draw`
 * (`Game over!`) and `lost` (`You lost, sorry!`).
 */
export type GameEnding =
  | { readonly kind: "score" | "top-score"; readonly score: string }
  | { readonly kind: "won" | "draw" | "lost" };

export interface GameOverOptions {
  readonly ending: GameEnding;
  /** Where the game menu returns: the child selected, on the window's top row (Task 0 H14). */
  readonly select: string;
  /**
   * Where the screen's silent keys go (plan 16 Task 0: keys on the game-over note make no beep,
   * `sound/game/snake-keys`; Navi and C UNVERIFIED). Default: nowhere.
   */
  readonly games?: Pick<StockGames, "cues" | "now">;
}

function named(name: string): StockWidgetTimeline {
  const found = WIDGET_TIMELINES[WIDGET_TIMELINE_BY_NAME[name] ?? ""];
  if (found === undefined) throw new Error(`No named widget timeline "${name}".`);
  return found;
}

/**
 * Plays the screen's timeline (`game-over-fireworks` or `game-over-note`), then returns to the
 * game menu. Navi or C skips to the menu at once; other keys are ignored (Task 0 C12). Keys act
 * on key-down, like the game's, and make no beep (plan 16).
 */
class GameOverWidget implements Widget {
  readonly #options: GameOverOptions;
  readonly #ending: Extract<GameEnding, { score: string }>;
  readonly #playback: Playback;

  constructor(options: GameOverOptions) {
    const ending = options.ending;
    if (!("score" in ending)) {
      throw new Error(`Game ending "${ending.kind}": resource missing (plan 24b).`);
    }
    this.#options = options;
    this.#ending = ending;
    const topScore = ending.kind === "top-score";
    this.#playback = new Playback(named(topScore ? "game-over-fireworks" : "game-over-note"));
  }

  render(): GameOverModel {
    return {
      kind: "game-over",
      frame: this.#playback.frame,
      label: this.#ending.kind === "top-score" ? "TOP SCORE:" : "Your score:",
      score: this.#ending.score,
    };
  }

  tick(dtMs: number, flow: Flow): void {
    this.#playback.advance(dtMs);
    if (this.#playback.ended) this.#end(flow);
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    const games = this.#options.games;
    games?.cues.cue({ kind: "silent-key" }, games.now());
    if (key === "navi" || key === "c") this.#end(flow);
  }

  #end(flow: Flow): void {
    flow.back(1, { select: this.#options.select, row: "top" });
  }
}

export function gameOver(options: GameOverOptions): Widget {
  return new GameOverWidget(options);
}
