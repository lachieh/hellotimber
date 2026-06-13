import { describe, expect, it } from "vite-plus/test";
import * as snake from "../src/index";
import type { Cell, SnakeInput, SnakeState } from "../src/index";

describe("package surface", () => {
  it("module loads", () => {
    expect(typeof snake).toBe("object");
  });

  it("SnakeState has the contracted shape", () => {
    const cell: Cell = { x: 0, y: 0 };
    const input: SnakeInput = "up";
    const s: SnakeState = {
      cols: 21,
      rows: 10,
      snake: [cell],
      dir: "right",
      pendingDir: null,
      food: cell,
      bonus: null,
      foodsEaten: 0,
      score: 0,
      level: 1,
      maze: 0,
      walls: [],
      status: "idle",
      flashOn: true,
    };
    expect(s.status).toBe("idle");
    expect(input).toBe("up");
  });
});
