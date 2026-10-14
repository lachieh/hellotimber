// Snake II's game screen (plan 23 Task 10): the session around the pure engine. It ticks the
// engine at the level's captured period (D2, D6), runs the grace and the death blink, stamps the
// engine's cues with the kernel time (D8), suspends to the game menu on Navi or C (H15, D10) and
// ends in the game-over screen (D13), writing a new top score (D9).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { SnakeModel } from "../display/widgets";
import type { StockCueSink } from "../firmware/cues";
import type { StockSettings } from "../firmware/settings";
import { blinkSnake, newSnakeGame, snakeKey, snakeRender, stepSnake } from "../games/snake/engine";
import type { SnakeState } from "../games/snake/model";
import {
  SNAKE_DEATH_STEPS,
  SNAKE_FIRST_TICK,
  SNAKE_GRACE_MS,
  SNAKE_PERIODS,
  SNAKE_TOP_SCORE_MS,
} from "../resources";
import type { Flow, Widget } from "./flow";
import { gameOver } from "./game-over";

/** The settings Snake II reads and writes. */
export const SNAKE_SETTINGS = {
  level: "games/snake/level",
  maze: "games/snake/mazes",
  topScore: "games/snake/top-score",
} as const;

/** A game left with Navi or C: its state, and how far its death blink had run. */
export interface SuspendedSnake {
  readonly state: SnakeState;
  readonly death?: { readonly step: number; readonly leftMs: number };
}

/**
 * What the games share per phone (like the settings store): the suspended game, the seed New
 * game takes, the cue sink and the kernel clock that stamps cues.
 */
export interface StockGames {
  snake: SuspendedSnake | undefined;
  seed(): number;
  readonly cues: StockCueSink;
  now(): number;
}

export interface SnakeGameOptions {
  readonly games: StockGames;
  readonly settings: StockSettings;
  /** `new`: New game (a fresh game, the suspended one discarded); `continue`: Continue. */
  readonly start: "new" | "continue";
}

type Phase =
  /** Continue: the board stands until a key (Task 0 C8). */
  | { readonly kind: "waiting"; readonly death?: SuspendedSnake["death"] }
  /** The next engine step is `leftMs` away. */
  | { readonly kind: "playing"; leftMs: number }
  /** Death step `step` of SNAKE_DEATH_STEPS (or, past them, the top score's write) ends in `leftMs`. */
  | { readonly kind: "dying"; step: number; leftMs: number };

class SnakeGameWidget implements Widget {
  readonly #games: StockGames;
  readonly #settings: StockSettings;
  #state: SnakeState;
  #phase: Phase;
  /** The game ended with a new top score (written when the death steps end). */
  #topScore = false;

  constructor({ games, settings, start }: SnakeGameOptions) {
    this.#games = games;
    this.#settings = settings;
    if (start === "continue") {
      const suspended = games.snake;
      if (suspended === undefined) throw new Error("Continue without a suspended Snake II game.");
      this.#state = suspended.state;
      this.#phase = {
        kind: "waiting",
        ...(suspended.death === undefined ? {} : { death: suspended.death }),
      };
    } else {
      const level = settings.number(SNAKE_SETTINGS.level);
      this.#state = newSnakeGame({
        level,
        maze: settings.choice(SNAKE_SETTINGS.maze) ?? 0,
        seed: games.seed(),
      });
      this.#phase = { kind: "playing", leftMs: tickTable(SNAKE_FIRST_TICK, level) };
    }
    games.snake = undefined;
  }

  render(): SnakeModel {
    return { kind: "snake", board: snakeRender(this.#state) };
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    if (key === "navi" || key === "c") {
      this.#suspend(flow);
      return;
    }
    const phase = this.#phase;
    if (phase.kind === "dying") return;
    this.#state = snakeKey(this.#state, key);
    if (phase.kind !== "waiting") return;
    // Continue: the first key resumes; the next step comes one period after it (C8).
    this.#phase =
      phase.death === undefined
        ? { kind: "playing", leftMs: this.#period() }
        : { kind: "dying", ...phase.death };
  }

  tick(dtMs: number, flow: Flow): void {
    let left = dtMs;
    while (left > 0) {
      const phase = this.#phase;
      if (phase.kind === "waiting") return;
      if (left < phase.leftMs) {
        phase.leftMs -= left;
        return;
      }
      left -= phase.leftMs;
      // The event happened `left` ms before now.
      if (phase.kind === "playing") this.#step(this.#games.now() - left);
      else if (!this.#blink(phase, flow)) return;
    }
  }

  #period(): number {
    return tickTable(SNAKE_PERIODS, this.#state.level);
  }

  /** One engine step: the next after a period, the grace after a blocked step (H6). */
  #step(atMs: number): void {
    const { state, cues, events } = stepSnake(this.#state);
    this.#state = state;
    for (const cue of cues) this.#games.cues.cue(cue, atMs);
    if (events.some((e) => e.kind === "died")) {
      this.#state = blinkSnake(this.#state);
      this.#phase = { kind: "dying", step: 0, leftMs: SNAKE_DEATH_STEPS[0]!.durationMs };
    } else {
      const crashed = events.some((e) => e.kind === "crashed");
      this.#phase = { kind: "playing", leftMs: crashed ? SNAKE_GRACE_MS : this.#period() };
    }
  }

  /**
   * The end of a death step: the next one, or the game-over screen. A new top score is written
   * when the steps end, and its fireworks come SNAKE_TOP_SCORE_MS later (H14). False once over.
   */
  #blink(phase: Extract<Phase, { kind: "dying" }>, flow: Flow): boolean {
    const next = phase.step + 1;
    const step = SNAKE_DEATH_STEPS[next];
    if (step !== undefined) {
      this.#state = blinkSnake(this.#state);
      this.#phase = { kind: "dying", step: next, leftMs: step.durationMs };
      return true;
    }
    const score = this.#state.score & 0xffff;
    const topScore = score > this.#settings.number(SNAKE_SETTINGS.topScore);
    if (next === SNAKE_DEATH_STEPS.length && topScore) {
      this.#settings.setNumber(SNAKE_SETTINGS.topScore, score);
      this.#games.cues.cue({ kind: "top-score" }, this.#games.now());
      this.#phase = { kind: "dying", step: next, leftMs: SNAKE_TOP_SCORE_MS };
      this.#topScore = true;
      return true;
    }
    flow.replace(gameOver({ topScore: this.#topScore, score: String(score), select: "new-game" }));
    return false;
  }

  /** Navi or C: the game menu opens on Continue, on the top row (H15, D10). */
  #suspend(flow: Flow): void {
    const phase = this.#phase;
    const death =
      phase.kind === "dying"
        ? { step: phase.step, leftMs: phase.leftMs }
        : phase.kind === "waiting"
          ? phase.death
          : undefined;
    this.#games.snake = { state: this.#state, ...(death === undefined ? {} : { death }) };
    flow.back(1, { select: "continue", row: "top" });
  }
}

function tickTable(table: Readonly<Record<number, number>>, level: number): number {
  const ms = table[level];
  if (ms === undefined) throw new Error(`No Snake II timing for level ${level}.`);
  return ms;
}

export function snakeGame(options: SnakeGameOptions): Widget {
  return new SnakeGameWidget(options);
}
