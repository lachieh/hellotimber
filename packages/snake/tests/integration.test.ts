import { describe, expect, it } from "vite-plus/test";
import { createSnake, renderSnakeFrame, tickIntervalMs } from "../src/index";
import { expectFrame } from "./pixels";

describe("full game on the Box maze", () => {
  it("plays from idle to GAME OVER deterministically", () => {
    const g = createSnake({ seed: 1, maze: 1, speed: 4 });
    expect(tickIntervalMs(4)).toBe(380); // host cadence for this game
    g.dispatch("right");
    let ticks = 0;
    while (g.tick()) ticks += 1;
    expect(ticks).toBe(15);
    expect(g.state.status).toBe("game-over");
    expect(g.state.score).toBe(0); // food at (12,7) was never on the path

    const frame = renderSnakeFrame(g.state);
    expectFrame(
      frame,
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
    expectFrame(
      frame,
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
    expect(g.tick()).toBe(false);
    g.reset();
    expect(g.state.status).toBe("idle");
    expect(g.state.food).toEqual({ x: 12, y: 7 }); // reseeded PRNG
  });
});
