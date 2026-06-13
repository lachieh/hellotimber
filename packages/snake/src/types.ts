/** 1bpp bitmap, row-major, 0 = clear, 1 = set. Structurally identical to
 * phone-core's Bitmap on purpose — defined locally so this package has zero deps. */
export interface Bitmap {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export type SnakeInput = "up" | "down" | "left" | "right";

export type SnakeStatus = "idle" | "running" | "paused" | "dying" | "game-over";

/** Playfield cell coordinates: x ∈ [0, cols), y ∈ [0, rows). */
export interface Cell {
  x: number;
  y: number;
}

/** The bonus bug: 1 logical cell, ttl in ticks, value decrements each tick. */
export interface SnakeBonus {
  cell: Cell;
  ttl: number;
  value: number;
}

export interface SnakeState {
  cols: number;
  rows: number;
  /** Head first. */
  snake: Cell[];
  /** Direction of travel applied on the last tick. */
  dir: SnakeInput;
  /** Queued turn for the next tick (last dispatch wins), or null. */
  pendingDir: SnakeInput | null;
  food: Cell;
  bonus: SnakeBonus | null;
  foodsEaten: number;
  score: number;
  /** 1–9; also the points awarded per food. */
  level: number;
  /** Maze index 0–5 (see MAZE_NAMES). */
  maze: number;
  walls: Cell[];
  status: SnakeStatus;
  /** During "dying": whether the snake is visible this frame. */
  flashOn: boolean;
}

export interface SnakeGame {
  readonly state: Readonly<SnakeState>;
  dispatch(input: SnakeInput): void;
  /** Advance one movement step; false once the game is over. */
  tick(): boolean;
  reset(): void;
  pause(): void;
  resume(): void;
}
