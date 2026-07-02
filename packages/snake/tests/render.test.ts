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

  it("draws the zero-padded 3x5 score, underline and solid frame", () => {
    const b = renderSnakeFrame(baseState({ score: 90 }));
    expectFrame(
      b,
      1,
      0,
      15,
      5,
      `
      ###.###.###.###
      #.#.#.#.#.#.#.#
      #.#.#.#.###.#.#
      #.#.#.#...#.#.#
      ###.###.###.###
    `,
    );
    // solid score underline (y6) and frame top (y7), full width
    expect(frameRegion(b, 0, 6, 84, 1)).toBe("#".repeat(84));
    expect(frameRegion(b, 0, 7, 84, 1)).toBe("#".repeat(84));
    // frame bottom and sides
    expect(frameRegion(b, 0, 47, 84, 1)).toBe("#".repeat(84));
    expect(frameRegion(b, 0, 20, 1, 1)).toBe("#");
    expect(frameRegion(b, 83, 20, 1, 1)).toBe("#");
    // score bar is otherwise empty
    const emptyRows = Array.from({ length: 5 }, () => ".".repeat(8)).join("\n");
    expect(frameRegion(b, 40, 0, 8, 5)).toBe(emptyRows);
  });

  it("draws the directed head, wavy body and thin tail", () => {
    const b = renderSnakeFrame(baseState());
    // head cell (6,5) → px (24,28), facing right (open jaws)
    expectFrame(
      b,
      24,
      28,
      4,
      4,
      `
      ###.
      ##.#
      ###.
      ##.#
    `,
    );
    // body (5,5): horizontal wave block on the even-parity band + wings
    expectFrame(
      b,
      20,
      28,
      4,
      4,
      `
      .##.
      ####
      ....
      ....
    `,
    );
    // tail (4,5): thin line on the odd-parity band
    expectFrame(
      b,
      16,
      28,
      4,
      4,
      `
      ....
      ....
      ####
      ....
    `,
    );
  });

  it("draws food as the hollow diamond", () => {
    const b = renderSnakeFrame(baseState()); // food (13,0) → px (52,8)
    expectFrame(
      b,
      52,
      8,
      4,
      4,
      `
      .#..
      #.#.
      .#..
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
    // bonus cell (10,2) → px (40,16): the beetle
    expectFrame(
      b,
      40,
      16,
      4,
      4,
      `
      #..#
      .##.
      ####
      .##.
    `,
    );
    // countdown "15" right-aligned: width 7 → x = 84 - 8 = 76
    expectFrame(
      b,
      76,
      0,
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
