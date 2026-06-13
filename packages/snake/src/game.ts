import { parseMaze } from "./mazes";
import { mulberry32 } from "./prng";
import { clampLevel } from "./timing";
import type { Cell, SnakeGame, SnakeInput, SnakeState } from "./types";

const COLS = 21;
const ROWS = 10;
const START_SNAKE: readonly Cell[] = [
  { x: 6, y: 5 },
  { x: 5, y: 5 },
  { x: 4, y: 5 },
];
const DELTAS: Record<SnakeInput, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
const OPPOSITE: Record<SnakeInput, SnakeInput> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export interface SnakeOptions {
  /** Level 1-9: tick cadence via tickIntervalMs() AND points per food. Default 1. */
  speed?: number;
  /** Maze index 0-5 (see MAZE_NAMES). Default 0 (no maze). */
  maze?: number;
  /** PRNG seed for food/bonus placement. Default 1. */
  seed?: number;
}

export function createSnake(opts: SnakeOptions = {}): SnakeGame {
  const level = clampLevel(opts.speed ?? 1);
  const maze = Math.min(5, Math.max(0, Math.floor(opts.maze ?? 0)));
  const seed = (opts.seed ?? 1) >>> 0;

  let rng: () => number;
  let state: SnakeState;
  let dyingTicks = 0;

  const key = (c: Cell) => `${c.x},${c.y}`;

  /** Deterministic free-cell placement: PRNG draws, skipping occupied cells.
   * Falls back to a scan, and to null when the board is full. */
  function placeCell(exclude: Cell[]): Cell | null {
    const used = new Set(exclude.map(key));
    for (let i = 0; i < 1000; i++) {
      const x = Math.floor(rng() * COLS);
      const y = Math.floor(rng() * ROWS);
      if (!used.has(`${x},${y}`)) return { x, y };
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!used.has(`${x},${y}`)) return { x, y };
      }
    }
    return null;
  }

  function init(): void {
    rng = mulberry32(seed);
    const walls = parseMaze(maze);
    state = {
      cols: COLS,
      rows: ROWS,
      snake: START_SNAKE.map((c) => ({ ...c })),
      dir: "right",
      pendingDir: null,
      food: { x: 0, y: 0 }, // replaced just below
      bonus: null,
      foodsEaten: 0,
      score: 0,
      level,
      maze,
      walls,
      status: "idle",
      flashOn: true,
    };
    state.food = placeCell([...state.snake, ...walls]) ?? { x: 0, y: 0 };
    dyingTicks = 0;
  }
  init();

  function tick(): boolean {
    if (state.status === "game-over") return false;
    if (state.status === "idle" || state.status === "paused") return true;
    if (state.pendingDir) {
      if (state.pendingDir !== OPPOSITE[state.dir]) state.dir = state.pendingDir;
      state.pendingDir = null;
    }
    const [dx, dy] = DELTAS[state.dir];
    const head = state.snake[0];
    const next = {
      x: (head.x + dx + COLS) % COLS,
      y: (head.y + dy + ROWS) % ROWS,
    };
    const eating = next.x === state.food.x && next.y === state.food.y;
    state.snake.unshift(next);
    let spawnedBonus = false;
    if (eating) {
      state.score += state.level;
      state.foodsEaten += 1;
      const food = placeCell([
        ...state.snake,
        ...state.walls,
        ...(state.bonus ? [state.bonus.cell] : []),
      ]);
      if (food === null) {
        state.status = "game-over";
        return false;
      }
      state.food = food;
      if (state.foodsEaten % 5 === 0) {
        const cell = placeCell([...state.snake, ...state.walls, state.food]);
        if (cell) {
          // a fresh bonus replaces any survivor from the previous batch
          state.bonus = { cell, ttl: 20, value: state.level * 5 };
          spawnedBonus = true;
        }
      }
    } else if (state.bonus && next.x === state.bonus.cell.x && next.y === state.bonus.cell.y) {
      state.score += state.bonus.value; // current countdown value
      state.bonus = null;
      state.snake.pop(); // bonus does NOT grow the snake
    } else {
      state.snake.pop();
    }
    if (state.bonus && !spawnedBonus) {
      state.bonus.ttl -= 1;
      state.bonus.value = Math.max(1, state.bonus.value - 1);
      if (state.bonus.ttl === 0) state.bonus = null;
    }
    return true;
  }

  return {
    get state() {
      return state;
    },
    dispatch(input: SnakeInput): void {
      if (state.status === "dying" || state.status === "game-over") return;
      if (state.status === "idle" || state.status === "paused") {
        state.status = "running"; // Nokia: any key starts/resumes
      }
      if (input === OPPOSITE[state.dir]) return; // no reversing
      state.pendingDir = input; // last input before the tick wins
    },
    pause(): void {
      if (state.status === "running") state.status = "paused";
    },
    resume(): void {
      if (state.status === "paused") state.status = "running";
    },
    tick,
    reset(): void {
      init();
    },
  };
}
