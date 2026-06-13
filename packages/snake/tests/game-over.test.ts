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

describe("dying flash", () => {
  it("hides the snake when flashOn is false, keeps food visible", () => {
    const b = renderSnakeFrame(baseState({ status: "dying", flashOn: false }));
    // head cell (6,5) → px (24,28): empty
    expectFrame(
      b,
      24,
      28,
      4,
      4,
      `
      ....
      ....
      ....
      ....
    `,
    );
    // food still drawn
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

  it("shows the snake when flashOn is true", () => {
    const b = renderSnakeFrame(baseState({ status: "dying", flashOn: true }));
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
  });
});

describe("game over screen", () => {
  it("draws GAME OVER centered with no separator or playfield", () => {
    const b = renderSnakeFrame(baseState({ status: "game-over" }));
    // 'G' at x=15
    expectFrame(
      b,
      15,
      14,
      5,
      7,
      `
      .####
      #....
      #....
      #.###
      #...#
      #...#
      .###.
    `,
    );
    // 'R' (last letter) at x = 15 + 8*6 = 63
    expectFrame(
      b,
      63,
      14,
      5,
      7,
      `
      ####.
      #...#
      #...#
      ####.
      #.#..
      #..#.
      #...#
    `,
    );
    // no separator line, no snake
    expect(frameRegion(b, 0, 7, 8, 1)).toBe("........");
    expect(frameRegion(b, 24, 28, 4, 1)).toBe("....");
  });

  it("centers the final score below the text", () => {
    const zero = renderSnakeFrame(baseState({ status: "game-over", score: 0 }));
    // one digit: width 3 → x = 40
    expectFrame(
      zero,
      40,
      28,
      3,
      5,
      `
      ###
      #.#
      #.#
      #.#
      ###
    `,
    );
    const b = renderSnakeFrame(baseState({ status: "game-over", score: 123 }));
    // three digits: width 11 → x = 36
    expectFrame(
      b,
      36,
      28,
      11,
      5,
      `
      .#..###.###
      ##....#...#
      .#..###.###
      .#..#.....#
      ###.###.###
    `,
    );
  });
});
