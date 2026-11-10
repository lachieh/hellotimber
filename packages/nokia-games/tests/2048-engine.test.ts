import { describe, expect, it } from "vite-plus/test";
import {
  createState,
  move,
  spawn,
  start,
  tileValue,
  type BoardSize,
  type Direction,
  type State2048,
} from "../src/2048/engine";

/** A board written as tile values (0 = empty), row by row. */
function board(rows: readonly (readonly number[])[], score = 0): State2048 {
  const cells = rows.flat().map((value) => (value === 0 ? 0 : Math.log2(value)));
  return createState(rows.length as BoardSize, cells, score);
}

function rows(state: State2048): number[][] {
  return Array.from({ length: state.size }, (_, r) =>
    state.cells.slice(r * state.size, (r + 1) * state.size).map(tileValue),
  );
}

/** A generator that returns the given draws in order and throws when asked for more. */
function draws(...values: number[]): (() => number) & { readonly taken: () => number } {
  let taken = 0;
  const next = () => {
    if (taken >= values.length) throw new Error("the engine drew more than the test scripted");
    return values[taken++]!;
  };
  return Object.assign(next, { taken: () => taken });
}

/** One row slid left, as tile values. */
function slideLeft(row: readonly number[]): number[] {
  const filler = Array<number>(row.length).fill(0);
  const state = board([row, ...Array.from({ length: row.length - 1 }, () => filler)]);
  return rows(move(state, "left").state)[0]!;
}

describe("createState", () => {
  it("makes an empty board of the chosen size", () => {
    for (const size of [3, 4] as const) {
      const state = createState(size);
      expect(state).toEqual({
        size,
        cells: Array(size * size).fill(0),
        score: 0,
        pendingSpawn: false,
        won: false,
        over: false,
      });
    }
  });

  it("holds cells as exponents in row-major order", () => {
    const state = board([
      [2, 0, 0, 4],
      [0, 0, 0, 0],
      [0, 2048, 0, 0],
      [0, 0, 0, 131072],
    ]);
    expect(state.cells).toEqual([1, 0, 0, 2, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 17]);
    expect(tileValue(0)).toBe(0);
    expect(tileValue(1)).toBe(2);
    expect(tileValue(17)).toBe(131072);
  });

  it("rejects a board that does not fit the size or holds a non-exponent", () => {
    expect(() => createState(4, [1, 2, 3])).toThrow(/16 cells/);
    expect(() => createState(3, [0, 0, 0, 0, -1, 0, 0, 0, 0])).toThrow(/cell 4/);
    expect(() => createState(3, [0, 0, 0, 0, 0, 0, 0, 0, 1.5])).toThrow(/cell 8/);
    expect(() => createState(5 as BoardSize)).toThrow(/size/);
    expect(() => createState(3, undefined, -2)).toThrow(/score/);
  });

  it("is immutable", () => {
    const cells = [1, 0, 0, 0, 0, 0, 0, 0, 0];
    const state = createState(3, cells);
    cells[0] = 5;
    expect(state.cells[0]).toBe(1);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.cells)).toBe(true);
  });
});

describe("move: slides", () => {
  const scattered = [
    [0, 2, 0, 0],
    [4, 0, 0, 8],
    [0, 0, 0, 0],
    [0, 16, 32, 0],
  ];

  const cases: readonly [Direction, number[][]][] = [
    [
      "left",
      [
        [2, 0, 0, 0],
        [4, 8, 0, 0],
        [0, 0, 0, 0],
        [16, 32, 0, 0],
      ],
    ],
    [
      "right",
      [
        [0, 0, 0, 2],
        [0, 0, 4, 8],
        [0, 0, 0, 0],
        [0, 0, 16, 32],
      ],
    ],
    [
      "up",
      [
        [4, 2, 32, 8],
        [0, 16, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
    ],
    [
      "down",
      [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 2, 0, 0],
        [4, 16, 32, 8],
      ],
    ],
  ];

  for (const [direction, expected] of cases) {
    it(`slides every tile ${direction}`, () => {
      const result = move(board(scattered), direction);
      expect(rows(result.state)).toEqual(expected);
      expect(result).toMatchObject({ changed: true, merged: false, won: false });
      expect(result.state.score).toBe(0);
      expect(result.state.pendingSpawn).toBe(true);
    });
  }

  it("slides a 3×3 board", () => {
    const state = board([
      [0, 0, 2],
      [0, 4, 0],
      [8, 0, 0],
    ]);
    expect(rows(move(state, "left").state)).toEqual([
      [2, 0, 0],
      [4, 0, 0],
      [8, 0, 0],
    ]);
    expect(rows(move(state, "down").state)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [8, 4, 2],
    ]);
  });

  it("does not change the state it was given", () => {
    const state = board(scattered);
    const before = [...state.cells];
    move(state, "left");
    expect(state.cells).toEqual(before);
    expect(state.pendingSpawn).toBe(false);
  });
});

describe("move: merges", () => {
  it("merges each tile once per move, from the leading edge", () => {
    expect(slideLeft([2, 2, 2, 2])).toEqual([4, 4, 0, 0]);
    expect(slideLeft([2, 2, 4, 0])).toEqual([4, 4, 0, 0]);
    expect(slideLeft([4, 2, 2, 0])).toEqual([4, 4, 0, 0]);
    expect(slideLeft([2, 2, 2, 0])).toEqual([4, 2, 0, 0]);
    expect(slideLeft([2, 0, 0, 2])).toEqual([4, 0, 0, 0]);
    expect(slideLeft([4, 4, 8, 0])).toEqual([8, 8, 0, 0]);
    expect(slideLeft([2, 4, 2, 4])).toEqual([2, 4, 2, 4]);
  });

  it("resolves from the edge the tiles move toward", () => {
    const row = board([
      [2, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(rows(move(row, "right").state)[0]).toEqual([0, 0, 2, 4]);

    const column = board([
      [2, 0, 0],
      [2, 0, 0],
      [2, 0, 0],
    ]);
    expect(rows(move(column, "up").state)).toEqual([
      [4, 0, 0],
      [2, 0, 0],
      [0, 0, 0],
    ]);
    expect(rows(move(column, "down").state)).toEqual([
      [0, 0, 0],
      [2, 0, 0],
      [4, 0, 0],
    ]);
  });

  it("reports whether the move merged", () => {
    const state = board([
      [2, 2, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(move(state, "left").merged).toBe(true);
    expect(move(state, "down").merged).toBe(false);
  });
});

describe("move: score", () => {
  it("adds the value of every merged tile", () => {
    const state = board(
      [
        [2, 2, 4, 4],
        [8, 8, 0, 0],
        [2, 4, 8, 16],
        [0, 0, 0, 0],
      ],
      100,
    );
    const result = move(state, "left");
    expect(rows(result.state)).toEqual([
      [4, 8, 0, 0],
      [16, 0, 0, 0],
      [2, 4, 8, 16],
      [0, 0, 0, 0],
    ]);
    expect(result.state.score).toBe(100 + 4 + 8 + 16);
  });

  it("leaves the score alone when tiles only slide", () => {
    const state = board(
      [
        [0, 2, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      12,
    );
    expect(move(state, "left").state.score).toBe(12);
  });
});

describe("move: no-op", () => {
  it("returns the same state when nothing can move that way", () => {
    const state = board(
      [
        [2, 4, 0, 0],
        [8, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      40,
    );
    for (const direction of ["left", "up"] as const) {
      const result = move(state, direction);
      expect(result.state).toBe(state);
      expect(result).toMatchObject({ changed: false, merged: false, won: false });
      expect(result.state.pendingSpawn).toBe(false);
    }
  });

  it("does nothing once the game is over", () => {
    const state = board([
      [2, 4, 2],
      [4, 2, 4],
      [2, 4, 2],
    ]);
    for (const direction of ["left", "right", "up", "down"] as const)
      expect(move(state, direction)).toEqual({ state, changed: false, merged: false, won: false });
  });

  it("refuses a move while a spawn is pending", () => {
    const moved = move(
      board([
        [0, 2, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]),
      "left",
    ).state;
    expect(() => move(moved, "right")).toThrow(/pending spawn/);
  });
});

describe("spawn", () => {
  const pending = () =>
    move(
      board([
        [0, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 4, 0],
      ]),
      "left",
    ).state; // 2 at cell 0, 4 at cell 12: fourteen empty cells

  it("draws the cell as r mod empty over the empty cells in row-major order", () => {
    // 19 mod 14 = 5: the sixth empty cell is cell 6 (cell 0 is taken).
    const state = spawn(pending(), draws(19, 1));
    expect(state.cells.indexOf(1, 1)).toBe(6);
    expect(state.pendingSpawn).toBe(false);
    // 13 mod 14 = 13: the last empty cell is cell 15 (cells 0 and 12 are taken).
    expect(spawn(pending(), draws(13, 1)).cells[15]).toBe(1);
    // 0: the first empty cell is cell 1.
    expect(spawn(pending(), draws(0, 1)).cells[1]).toBe(1);
  });

  it("draws the value second: a 4 when r mod 10 is 0, else a 2", () => {
    expect(spawn(pending(), draws(0, 0)).cells[1]).toBe(2);
    expect(spawn(pending(), draws(0, 10)).cells[1]).toBe(2);
    expect(spawn(pending(), draws(0, 4294967290)).cells[1]).toBe(2);
    expect(spawn(pending(), draws(0, 9)).cells[1]).toBe(1);
    expect(spawn(pending(), draws(0, 11)).cells[1]).toBe(1);
  });

  it("takes uint32 draws", () => {
    // 4294967295 mod 14 = 3 → the fourth empty cell (cell 4); 4294967295 mod 10 = 5 → a 2.
    const state = spawn(pending(), draws(4294967295, 4294967295));
    expect(state.cells[4]).toBe(1);
  });

  it("takes exactly two draws and keeps score and won", () => {
    const random = draws(3, 7, 99);
    const before = pending();
    const state = spawn(before, random);
    expect(random.taken()).toBe(2);
    expect(state.score).toBe(before.score);
    expect(state.won).toBe(false);
    expect(state.cells.filter((cell) => cell !== 0)).toHaveLength(3);
  });

  it("does nothing, and draws nothing, when no spawn is pending", () => {
    const state = board([
      [2, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    const random = draws();
    expect(spawn(state, random)).toBe(state);
    expect(random.taken()).toBe(0);
  });

  it("rejects a draw that is not a non-negative integer", () => {
    expect(() => spawn(pending(), draws(0.5, 1))).toThrow(/random/);
    expect(() => spawn(pending(), draws(1, -1))).toThrow(/random/);
  });
});

describe("start", () => {
  it("spawns twice on an empty board", () => {
    // First: 5 mod 16 = cell 5, 20 mod 10 = 0 → a 4.
    // Second: 5 mod 15 = the sixth empty cell, which is now cell 6; 3 → a 2.
    const random = draws(5, 20, 5, 3);
    const state = start(4, random);
    expect(random.taken()).toBe(4);
    expect(rows(state)).toEqual([
      [0, 0, 0, 0],
      [0, 4, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(state).toMatchObject({ score: 0, pendingSpawn: false, won: false, over: false });
  });

  it("starts a 3×3 board", () => {
    // 17 mod 9 = cell 8; then 8 mod 8 = the first empty cell.
    const state = start(3, draws(17, 1, 8, 1));
    expect(rows(state)).toEqual([
      [2, 0, 0],
      [0, 0, 0],
      [0, 0, 2],
    ]);
  });

  it("is the same game for the same draws", () => {
    const sequence = () => {
      let seed = 44530;
      return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    };
    expect(start(4, sequence())).toEqual(start(4, sequence()));
  });
});

describe("won", () => {
  const nearly = [
    [1024, 1024, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [1024, 1024, 0, 0],
  ];

  it("is set by the first 2048 tile", () => {
    const before = board(nearly);
    expect(before.won).toBe(false);
    const result = move(before, "left");
    expect(result.won).toBe(true);
    expect(result.state.won).toBe(true);
    expect(result.state.score).toBe(4096);
  });

  it("is reported once: later 2048 tiles and later moves do not report it again", () => {
    const first = move(
      board([
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [1024, 0, 1024, 0],
      ]),
      "up",
    );
    // Column 0 holds 1024 and 1024: one 2048. The other two 1024s only slide up.
    expect(rows(first.state)[0]).toEqual([2048, 1024, 1024, 0]);
    expect(first.won).toBe(true);

    const settled = spawn(first.state, draws(15, 1));
    expect(settled.won).toBe(true);
    const second = move(settled, "left");
    expect(rows(second.state)[0]).toEqual([2048, 2048, 0, 0]);
    expect(second.won).toBe(false);
    expect(second.state.won).toBe(true);

    // Thirteen cells are empty: draw 12 is the last one (cell 15), away from the top row.
    const third = move(spawn(second.state, draws(12, 1)), "left");
    expect(rows(third.state)[0]).toEqual([4096, 0, 0, 0]);
    expect(third.won).toBe(false);
    expect(third.state.won).toBe(true);
  });

  it("is not set by smaller merges", () => {
    const result = move(
      board([
        [512, 512, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]),
      "left",
    );
    expect(result).toMatchObject({ merged: true, won: false });
    expect(result.state.won).toBe(false);
  });

  it("is already set on a board made with a 2048 tile", () => {
    const state = board([
      [2048, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(state.won).toBe(true);
    expect(move(state, "right").won).toBe(false);
  });
});

describe("over", () => {
  it("is set when the board is full with no equal neighbours (4×4)", () => {
    const state = board([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    expect(state.over).toBe(true);
  });

  it("is set when the board is full with no equal neighbours (3×3)", () => {
    const state = board([
      [2, 4, 8],
      [16, 32, 64],
      [128, 256, 512],
    ]);
    expect(state.over).toBe(true);
  });

  it("is not set while a horizontal or a vertical pair remains", () => {
    expect(
      board([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 8, 8],
      ]).over,
    ).toBe(false);
    expect(
      board([
        [2, 4, 8],
        [16, 32, 64],
        [16, 256, 512],
      ]).over,
    ).toBe(false);
  });

  it("does not pair the end of one row with the start of the next", () => {
    expect(
      board([
        [2, 4, 8],
        [8, 16, 32],
        [32, 64, 128],
      ]).over,
    ).toBe(true);
  });

  it("is not set while a cell is empty", () => {
    expect(
      board([
        [2, 4, 2],
        [4, 2, 4],
        [2, 4, 0],
      ]).over,
    ).toBe(false);
  });

  it("is set by the spawn that leaves no move", () => {
    const before = move(
      board([
        [4, 2, 4],
        [2, 4, 2],
        [8, 16, 0],
      ]),
      "right",
    ).state;
    expect(before.over).toBe(false);
    expect(before.pendingSpawn).toBe(true);
    // One cell is empty (cell 6), under a 2: a 4 there leaves no move, a 2 leaves one.
    const lost = spawn(before, draws(0, 10));
    expect(rows(lost)).toEqual([
      [4, 2, 4],
      [2, 4, 2],
      [4, 8, 16],
    ]);
    expect(lost.over).toBe(true);

    const alive = spawn(before, draws(0, 1));
    expect(rows(alive)[2]).toEqual([2, 8, 16]);
    expect(alive.over).toBe(false);
  });
});
