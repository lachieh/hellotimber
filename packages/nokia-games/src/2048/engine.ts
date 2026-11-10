/**
 * The rules of 2048 as pure functions over an immutable state (plan 28, "2048 on the 84×48
 * LCD"). No clock and no random source of its own: the game decides when a spawn happens and
 * passes the session's generator in.
 */

export type BoardSize = 3 | 4;

export type Direction = "up" | "down" | "left" | "right";

/** A uint32 per call: `ctx.random` of the game SDK. */
export type Random = () => number;

/** The exponent of the tile that wins: 2^11 = 2048. */
export const WIN_EXPONENT = 11;

export interface State2048 {
  readonly size: BoardSize;
  /** `size * size` exponents in row-major order: 0 is empty, n is the tile 2^n. */
  readonly cells: readonly number[];
  readonly score: number;
  /** A move changed the board and its new tile has not spawned yet. */
  readonly pendingSpawn: boolean;
  /** A 2048 tile has been made. Play continues. */
  readonly won: boolean;
  /** The board is full and no two neighbours are equal. Set by the spawn that causes it. */
  readonly over: boolean;
}

export interface Move2048 {
  /** The state given, itself, when the move changed nothing. */
  readonly state: State2048;
  readonly changed: boolean;
  /** At least one pair merged. */
  readonly merged: boolean;
  /** This move made the first 2048 tile. */
  readonly won: boolean;
}

/** The number a cell shows: 0 for an empty cell, else 2^exponent. */
export function tileValue(exponent: number): number {
  return exponent === 0 ? 0 : 2 ** exponent;
}

function hasMove(size: BoardSize, cells: readonly number[]): boolean {
  return cells.some(
    (cell, index) =>
      cell === 0 ||
      (index % size < size - 1 && cell === cells[index + 1]) ||
      (index + size < cells.length && cell === cells[index + size]),
  );
}

function freeze(state: State2048): State2048 {
  Object.freeze(state.cells);
  return Object.freeze(state);
}

/** A board with nothing pending: empty by default, or the given exponents (tests, saved games). */
export function createState(size: BoardSize, cells?: readonly number[], score = 0): State2048 {
  if (size !== 3 && size !== 4) throw new Error(`2048: size must be 3 or 4, got ${String(size)}`);
  const count = size * size;
  const copy = cells ? [...cells] : Array<number>(count).fill(0);
  if (copy.length !== count)
    throw new Error(`2048: a ${size}x${size} board has ${count} cells, got ${copy.length}`);
  copy.forEach((cell, index) => {
    if (!Number.isInteger(cell) || cell < 0)
      throw new Error(`2048: cell ${index} must be an exponent (0 or more), got ${cell}`);
  });
  if (!Number.isInteger(score) || score < 0)
    throw new Error(`2048: score must be a non-negative integer, got ${score}`);
  return freeze({
    size,
    cells: copy,
    score,
    pendingSpawn: false,
    won: copy.some((cell) => cell >= WIN_EXPONENT),
    over: !hasMove(size, copy),
  });
}

function draw(random: Random): number {
  const value = random();
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`2048: random() must return a non-negative integer, got ${value}`);
  return value;
}

/** Two draws: the cell among the empty ones in row-major order, then the value. */
function place(state: State2048, random: Random): State2048 {
  const empty: number[] = [];
  state.cells.forEach((cell, index) => {
    if (cell === 0) empty.push(index);
  });
  if (empty.length === 0) return freeze({ ...state, pendingSpawn: false });
  const index = empty[draw(random) % empty.length]!;
  const cells = [...state.cells];
  cells[index] = draw(random) % 10 === 0 ? 2 : 1;
  return freeze({ ...state, cells, pendingSpawn: false, over: !hasMove(state.size, cells) });
}

/**
 * Spawns the pending tile and sets `over` if no move is left. Without a pending spawn it returns
 * the state given and draws nothing, so `move(spawn(state, random), direction)` is always safe.
 */
export function spawn(state: State2048, random: Random): State2048 {
  return state.pendingSpawn ? place(state, random) : state;
}

/** A new game: an empty board with two spawns (four draws). */
export function start(size: BoardSize, random: Random): State2048 {
  return place(place(createState(size), random), random);
}

/**
 * Slides every tile toward `direction`. Equal neighbours merge once per move, resolved from the
 * leading edge, and each merged tile's value is added to the score. A move that changes the board
 * leaves `pendingSpawn` set; one that changes nothing returns the state given.
 */
export function move(state: State2048, direction: Direction): Move2048 {
  if (state.pendingSpawn) throw new Error("2048: move with a pending spawn; call spawn first");
  const { size } = state;
  const towardStart = direction === "left" || direction === "up";
  const alongRow = direction === "left" || direction === "right";
  const cells = [...state.cells];
  let score = state.score;
  let merged = false;
  let changed = false;

  for (let line = 0; line < size; line++) {
    // The line's cell indices, leading edge first.
    const indices: number[] = [];
    for (let step = 0; step < size; step++) {
      const position = towardStart ? step : size - 1 - step;
      indices.push(alongRow ? line * size + position : position * size + line);
    }
    const result: number[] = [];
    let mergeable = false; // whether the last tile placed may still merge
    for (const index of indices) {
      const cell = state.cells[index]!;
      if (cell === 0) continue;
      if (mergeable && result[result.length - 1] === cell) {
        result[result.length - 1] = cell + 1;
        score += tileValue(cell + 1);
        merged = true;
        mergeable = false;
      } else {
        result.push(cell);
        mergeable = true;
      }
    }
    indices.forEach((index, step) => {
      const cell = result[step] ?? 0;
      if (cell !== cells[index]) changed = true;
      cells[index] = cell;
    });
  }

  if (!changed) return { state, changed: false, merged: false, won: false };
  const won = !state.won && cells.some((cell) => cell >= WIN_EXPONENT);
  return {
    state: freeze({ ...state, cells, score, pendingSpawn: true, won: state.won || won }),
    changed: true,
    merged,
    won,
  };
}
