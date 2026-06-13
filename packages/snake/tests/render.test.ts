import { describe, expect, it } from "vite-plus/test";
import { renderSnakeFrame } from "../src/index";
import type { SnakeState } from "../src/index";
import { expectFrame, frameRegion } from "./pixels";

function baseState(partial: Partial<SnakeState> = {}): SnakeState {
  return {
    cols: 21,
    rows: 10,
    snake: [
      { x: 6, y: 5 },
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ],
    dir: "right",
    pendingDir: null,
    food: { x: 13, y: 0 },
    bonus: null,
    foodsEaten: 0,
    score: 0,
    level: 1,
    maze: 0,
    walls: [],
    status: "running",
    flashOn: true,
    ...partial,
  };
}

describe("renderSnakeFrame", () => {
  it("returns a fresh 84x48 bitmap and does not mutate state", () => {
    const s = baseState();
    const before = JSON.stringify(s);
    const b = renderSnakeFrame(s);
    expect(b.width).toBe(84);
    expect(b.height).toBe(48);
    expect(b.pixels).toHaveLength(84 * 48);
    expect(JSON.stringify(s)).toBe(before);
    expect(renderSnakeFrame(s)).not.toBe(b);
  });

  it("draws the score top-left and the separator line at y=7", () => {
    const b = renderSnakeFrame(baseState({ score: 90 }));
    expectFrame(
      b,
      1,
      1,
      7,
      5,
      `
      ###.###
      #.#.#.#
      ###.#.#
      ..#.#.#
      ###.###
    `,
    );
    expect(frameRegion(b, 0, 7, 84, 1)).toBe("#".repeat(84));
    // score bar is otherwise empty
    const emptyRows = Array.from({ length: 7 }, () => ".".repeat(8)).join("\n");
    expect(frameRegion(b, 40, 0, 8, 7)).toBe(emptyRows);
  });

  it("draws head, notched and solid body segments at their cells", () => {
    const b = renderSnakeFrame(baseState());
    // head cell (6,5) → px (24,28)
    expectFrame(
      b,
      24,
      28,
      4,
      4,
      `
      ####
      #..#
      ####
      ####
    `,
    );
    // body index 1 (5,5) → notched
    expectFrame(
      b,
      20,
      28,
      4,
      4,
      `
      ####
      #..#
      #..#
      ####
    `,
    );
    // body index 2 (4,5) → solid
    expectFrame(
      b,
      16,
      28,
      4,
      4,
      `
      ####
      ####
      ####
      ####
    `,
    );
  });

  it("draws food as a 2x2 dot in its cell", () => {
    const b = renderSnakeFrame(baseState()); // food (13,0) → px (52,8)
    expectFrame(
      b,
      52,
      8,
      4,
      4,
      `
      ....
      .##.
      .##.
      ....
    `,
    );
  });

  it("draws walls as solid 4x4 blocks", () => {
    const b = renderSnakeFrame(
      baseState({
        walls: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      }),
    );
    expect(frameRegion(b, 0, 8, 8, 4)).toBe(
      ["########", "########", "########", "########"].join("\n"),
    );
  });

  it("draws the bonus bug and its countdown top-right", () => {
    const b = renderSnakeFrame(baseState({ bonus: { cell: { x: 10, y: 2 }, ttl: 20, value: 15 } }));
    // bonus cell (10,2) → px (40,16)
    expectFrame(
      b,
      40,
      16,
      4,
      4,
      `
      .##.
      ####
      ####
      #..#
    `,
    );
    // countdown "15" right-aligned: x = 84 - 2*4 = 76
    expectFrame(
      b,
      76,
      1,
      7,
      5,
      `
      .#..###
      ##..#..
      .#..###
      .#....#
      ###.###
    `,
    );
  });

  it("renders idle and paused exactly like running", () => {
    const run = renderSnakeFrame(baseState());
    expect(renderSnakeFrame(baseState({ status: "idle" })).pixels).toEqual(run.pixels);
    expect(renderSnakeFrame(baseState({ status: "paused" })).pixels).toEqual(run.pixels);
  });
});
