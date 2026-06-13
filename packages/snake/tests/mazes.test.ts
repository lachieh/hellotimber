import { describe, expect, it } from "vite-plus/test";
import { MAZE_ART, MAZE_NAMES, parseMaze } from "../src/mazes";

describe("mazes", () => {
  it("defines six named mazes", () => {
    expect(MAZE_NAMES).toEqual(["No maze", "Box", "Tunnel", "Mill", "Rails", "Apartment"]);
    expect(MAZE_ART).toHaveLength(6);
  });

  it("every maze is a 21x10 grid of # and .", () => {
    for (const art of MAZE_ART) {
      expect(art).toHaveLength(10);
      for (const row of art) expect(row).toMatch(/^[#.]{21}$/);
    }
  });

  it("has the expected wall counts", () => {
    expect(MAZE_ART.map((_, i) => parseMaze(i).length)).toEqual([0, 58, 24, 18, 34, 76]);
  });

  it("Box is the perimeter", () => {
    const walls = new Set(parseMaze(1).map((c) => `${c.x},${c.y}`));
    expect(walls.has("0,0")).toBe(true);
    expect(walls.has("20,9")).toBe(true);
    expect(walls.has("0,5")).toBe(true);
    expect(walls.has("13,0")).toBe(true);
    expect(walls.has("1,1")).toBe(false);
    expect(walls.has("10,5")).toBe(false);
  });

  it("leaves the snake start row free in every maze", () => {
    for (let m = 0; m < 6; m++) {
      const walls = new Set(parseMaze(m).map((c) => `${c.x},${c.y}`));
      for (const x of [4, 5, 6, 7, 8, 9, 10]) expect(walls.has(`${x},5`)).toBe(false);
    }
  });

  it("out-of-range index falls back to No maze", () => {
    expect(parseMaze(99)).toEqual([]);
  });
});
