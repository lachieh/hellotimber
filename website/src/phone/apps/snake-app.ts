import type { AppFactory, PhoneApp, PhoneKey, ScreenModel } from "@hellotimber/phone-core";
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
      const n = Number.parseInt(localStorage.getItem(key) ?? "", 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    },
    write(score) {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(key, String(score));
    },
  };
}

/** Spec §7: 2/4/6/8 steer; the scroll keys also steer (absolute — see plan deviations). */
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

/** "Press any key except the navigation or menu keys" — paused-game starters. */
const STARTER_KEYS = new Set<PhoneKey>(["0", "1", "3", "5", "7", "9", "*", "#"]);

export interface SnakeAppOptions {
  /** Level 1–9 (speed AND points per food). Default 5. */
  speed?: number;
  /** Test seam; default creates a real game with a wall-clock seed. */
  createGame?: () => SnakeGame;
  /** Test seam; default persists to localStorage. */
  topScore?: SnakeTopScoreStore;
}

/**
 * The Snake II engine hosted as a phone-core PhoneApp. The game instance
 * outlives app launches (closure state), so C-to-exit + re-enter is the
 * authentic Games → Continue. Snake's Bitmap is structurally identical to
 * phone-core's (one byte per pixel) — no shared import needed.
 */
export function snakeApp(options: SnakeAppOptions = {}): AppFactory {
  const speed = options.speed ?? 5;
  const createGame = options.createGame ?? (() => createSnake({ speed, seed: Date.now() >>> 0 }));
  const store = options.topScore ?? localStorageTopScore();
  let game: SnakeGame | null = null;

  return (ctx): PhoneApp => {
    game ??= createGame();
    let acc = 0;
    let scored = game.state.status === "game-over";

    return {
      onKey(e) {
        if (e.type !== "down") return;
        const g = game!;
        if (e.key === "c") {
          if (g.state.status === "running") g.pause();
          ctx.exit();
          return;
        }
        if (g.state.status === "game-over") {
          game = createGame(); // fresh seed — reset() would replay identically
          acc = 0;
          scored = false;
        }
        const input = snakeInputForKey(e.key);
        if (input !== null) {
          game!.dispatch(input); // plan 04: also starts idle / resumes paused
        } else if (STARTER_KEYS.has(e.key) && game!.state.status === "paused") {
          game!.resume();
        }
      },
      tick(dtMs) {
        const g = game!;
        if (g.state.status !== "running" && g.state.status !== "dying") return;
        acc += dtMs;
        const interval = tickIntervalMs(g.state.level);
        while (acc >= interval) {
          acc -= interval;
          if (!g.tick()) {
            if (!scored) {
              scored = true;
              if (g.state.score > store.read()) store.write(g.state.score);
            }
            break;
          }
        }
      },
      render(): ScreenModel {
        return { kind: "custom", appId: "snake", frame: renderSnakeFrame(game!.state) };
      },
      onExit() {
        const g = game!;
        if (g.state.status === "running") g.pause();
      },
    };
  };
}
