import { describe, expect, it } from "vite-plus/test";
import { createSnake } from "../src/index";
import type { SnakeInput } from "../src/index";
import { eatNextFood } from "./helpers";

const CLOCKWISE: Record<SnakeInput, SnakeInput> = {
  right: "down",
  down: "left",
  left: "up",
  up: "right",
};

function dyingGame() {
  const g = createSnake({ seed: 1, maze: 1 });
  g.dispatch("right");
  for (let i = 0; i < 14; i++) g.tick();
  return g;
}

describe("wall collision", () => {
  it("hits the Box east wall on the 14th tick", () => {
    const g = createSnake({ seed: 1, maze: 1 });
    g.dispatch("right");
    for (let i = 0; i < 13; i++) {
      expect(g.tick()).toBe(true);
      expect(g.state.status).toBe("running");
    }
    expect(g.tick()).toBe(true); // collision tick enters 'dying'
    expect(g.state.status).toBe("dying");
    expect(g.state.snake[0]).toEqual({ x: 19, y: 5 }); // never enters the wall
    expect(g.state.flashOn).toBe(false);
  });
});

describe("self collision", () => {
  it("dies when U-turning into its own body", () => {
    const g = createSnake({ seed: 1 });
    eatNextFood(g);
    eatNextFood(g); // length 5 — long enough to turn back into
    for (let i = 0; i < 3; i++) {
      g.dispatch(CLOCKWISE[g.state.dir]);
      g.tick();
    }
    expect(g.state.status).toBe("dying");
    expect(g.state.snake).toHaveLength(5);
  });

  it("moving into the vacating tail cell is safe", () => {
    // length 3: a tight clockwise circle revisits the old tail cell — no death
    const g = createSnake({ seed: 1 });
    g.dispatch("right");
    g.tick();
    for (const turn of ["down", "left", "up"] as const) {
      g.dispatch(turn);
      g.tick();
    }
    expect(g.state.status).toBe("running");
  });
});

describe("death sequence", () => {
  it("flashes for two ticks, then game over", () => {
    const g = dyingGame();
    expect(g.state.status).toBe("dying");
    expect(g.state.flashOn).toBe(false);
    expect(g.tick()).toBe(true);
    expect(g.state.flashOn).toBe(true);
    expect(g.tick()).toBe(false);
    expect(g.state.status).toBe("game-over");
    expect(g.tick()).toBe(false); // stays over
  });

  it("ignores input while dying and after game over", () => {
    const g = dyingGame();
    g.dispatch("up");
    expect(g.state.pendingDir).toBeNull();
    g.tick();
    g.tick();
    g.dispatch("up");
    expect(g.state.status).toBe("game-over");
    expect(g.state.pendingDir).toBeNull();
  });

  it("reset starts a fresh game after game over", () => {
    const g = dyingGame();
    g.tick();
    g.tick();
    expect(g.state.status).toBe("game-over");
    g.reset();
    expect(g.state.status).toBe("idle");
    g.dispatch("right");
    expect(g.tick()).toBe(true);
    expect(g.state.snake[0]).toEqual({ x: 7, y: 5 });
  });
});
