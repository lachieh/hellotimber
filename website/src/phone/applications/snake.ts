import { PhoneApplication } from "@hellotimber/phone-core";
import type {
  ApplicationContext,
  PhoneApplicationSession,
  PhoneKey,
} from "@hellotimber/phone-core";
import { createSnake, renderSnakeFrame, tickIntervalMs } from "@hellotimber/snake";
import type { SnakeGame, SnakeInput } from "@hellotimber/snake";

export const SNAKE_TOPSCORE_KEY = "hellotimber.snake.topscore";

export interface SnakeTopScoreStore {
  read(): number;
  write(score: number): void;
}

function localStorageTopScore(key = SNAKE_TOPSCORE_KEY): SnakeTopScoreStore {
  return {
    read() {
      if (typeof localStorage === "undefined") return 0;
      const value = Number.parseInt(localStorage.getItem(key) ?? "", 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    },
    write(score) {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, String(score));
    },
  };
}

/** Spec section 7: 2/4/6/8 steer; the scroll keys also steer. */
export function snakeInputForKey(key: PhoneKey): SnakeInput | null {
  switch (key) {
    case "2":
    case "up":
      return "up";
    case "8":
    case "down":
      return "down";
    case "4":
      return "left";
    case "6":
      return "right";
    default:
      return null;
  }
}

const STARTER_KEYS = new Set<PhoneKey>(["0", "1", "3", "5", "7", "9", "*", "#"]);

export interface SnakeAppOptions {
  speed?: number;
  createGame?: () => SnakeGame;
  topScore?: SnakeTopScoreStore;
}

export class SnakeApplication extends PhoneApplication {
  readonly #createGame: () => SnakeGame;
  readonly #store: SnakeTopScoreStore;
  #game: SnakeGame | null = null;

  constructor(options: SnakeAppOptions = {}) {
    super("snake");
    const speed = options.speed ?? 5;
    this.#createGame = options.createGame ?? (() => createSnake({ speed, seed: Date.now() >>> 0 }));
    this.#store = options.topScore ?? localStorageTopScore();
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    this.#game ??= this.#createGame();
    let accumulator = 0;
    let scored = this.#game.state.status === "game-over";

    return {
      onKey: (event) => {
        if (event.type !== "down") return;
        let game = this.#game!;
        if (event.key === "c") {
          if (game.state.status === "running") game.pause();
          context.exit();
          return;
        }
        if (game.state.status === "game-over") {
          this.#game = this.#createGame();
          game = this.#game;
          accumulator = 0;
          scored = false;
        }
        const input = snakeInputForKey(event.key);
        if (input !== null) game.dispatch(input);
        else if (STARTER_KEYS.has(event.key) && game.state.status === "paused") game.resume();
      },
      tick: (dtMs) => {
        const game = this.#game!;
        if (game.state.status !== "running" && game.state.status !== "dying") return;
        accumulator += dtMs;
        const interval = tickIntervalMs(game.state.level);
        while (accumulator >= interval) {
          accumulator -= interval;
          if (!game.tick()) {
            if (!scored) {
              scored = true;
              if (game.state.score > this.#store.read()) this.#store.write(game.state.score);
            }
            break;
          }
        }
      },
      render: () => ({
        kind: "custom",
        appId: this.id,
        frame: renderSnakeFrame(this.#game!.state),
      }),
      onDeactivate: () => {
        const game = this.#game!;
        if (game.state.status === "running") game.pause();
      },
    };
  }
}
