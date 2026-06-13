import { describe, expect, it } from "vite-plus/test";
import { createSnake } from "../src/index";

describe("initial state", () => {
  it("starts idle with a 3-segment snake heading right", () => {
    const g = createSnake({ seed: 1 });
    expect(g.state.status).toBe("idle");
    expect(g.state.snake).toEqual([
      { x: 6, y: 5 },
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ]);
    expect(g.state.dir).toBe("right");
    expect(g.state.pendingDir).toBeNull();
    expect(g.state.cols).toBe(21);
    expect(g.state.rows).toBe(10);
    expect(g.state.score).toBe(0);
    expect(g.state.foodsEaten).toBe(0);
    expect(g.state.level).toBe(1);
    expect(g.state.maze).toBe(0);
    expect(g.state.walls).toEqual([]);
    expect(g.state.bonus).toBeNull();
    expect(g.state.flashOn).toBe(true);
  });

  it("clamps speed and maze options", () => {
    expect(createSnake({ speed: 99 }).state.level).toBe(9);
    expect(createSnake({ speed: -3 }).state.level).toBe(1);
    expect(createSnake({ maze: 1 }).state.walls).toHaveLength(58);
    expect(createSnake({ maze: 99 }).state.maze).toBe(5);
  });

  it("places food deterministically from the seed", () => {
    expect(createSnake({ seed: 1 }).state.food).toEqual({ x: 13, y: 0 });
    expect(createSnake({ seed: 42 }).state.food).toEqual({ x: 12, y: 4 });
    const a = createSnake({ seed: 5 });
    const b = createSnake({ seed: 5 });
    const c = createSnake({ seed: 6 });
    expect(a.state.food).toEqual(b.state.food);
    expect(a.state.food).not.toEqual(c.state.food);
  });

  it("never places food on the snake or walls", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const g = createSnake({ seed, maze: 1 });
      expect(g.state.snake).not.toContainEqual(g.state.food);
      expect(g.state.walls).not.toContainEqual(g.state.food);
    }
  });
});

describe("ticking", () => {
  it("does nothing while idle", () => {
    const g = createSnake({ seed: 1 });
    expect(g.tick()).toBe(true);
    expect(g.state.snake[0]).toEqual({ x: 6, y: 5 });
    expect(g.state.status).toBe("idle");
  });

  it("moves one cell per tick once started", () => {
    const g = createSnake({ seed: 1 });
    g.dispatch("right");
    expect(g.state.status).toBe("running");
    expect(g.tick()).toBe(true);
    expect(g.state.snake).toEqual([
      { x: 7, y: 5 },
      { x: 6, y: 5 },
      { x: 5, y: 5 },
    ]);
  });

  it("wraps around the right edge", () => {
    const g = createSnake({ seed: 1 });
    g.dispatch("right");
    for (let i = 0; i < 14; i++) g.tick();
    expect(g.state.snake[0]).toEqual({ x: 20, y: 5 });
    g.tick();
    expect(g.state.snake[0]).toEqual({ x: 0, y: 5 });
  });

  it("wraps around the top edge", () => {
    const g = createSnake({ seed: 1 });
    g.dispatch("up");
    for (let i = 0; i < 5; i++) g.tick();
    expect(g.state.snake[0]).toEqual({ x: 6, y: 0 });
    g.tick();
    expect(g.state.snake[0]).toEqual({ x: 6, y: 9 });
  });
});

describe("direction queueing", () => {
  it("ignores reversing into the snake", () => {
    const g = createSnake({ seed: 1 });
    g.dispatch("left"); // starts the game, but reverse of 'right' is ignored
    g.tick();
    expect(g.state.dir).toBe("right");
    expect(g.state.snake[0]).toEqual({ x: 7, y: 5 });
  });

  it("last legal input before the tick wins", () => {
    const g = createSnake({ seed: 1 });
    g.dispatch("up");
    g.dispatch("down"); // legal vs current dir 'right' — replaces 'up'
    g.tick();
    expect(g.state.dir).toBe("down");
    expect(g.state.snake[0]).toEqual({ x: 6, y: 6 });
  });

  it("an illegal reverse does not clobber a queued legal turn", () => {
    const g = createSnake({ seed: 1 });
    g.dispatch("up");
    g.dispatch("left"); // reverse of 'right' — ignored, 'up' stays queued
    g.tick();
    expect(g.state.snake[0]).toEqual({ x: 6, y: 4 });
  });

  it("applies at most one turn per tick", () => {
    const g = createSnake({ seed: 1 });
    g.dispatch("up");
    g.tick();
    expect(g.state.snake[0]).toEqual({ x: 6, y: 4 });
    expect(g.state.pendingDir).toBeNull();
    g.tick();
    expect(g.state.snake[0]).toEqual({ x: 6, y: 3 }); // keeps going up
  });
});

describe("pause/resume/reset", () => {
  it("pauses and resumes", () => {
    const g = createSnake({ seed: 1 });
    g.dispatch("right");
    g.tick();
    g.pause();
    expect(g.state.status).toBe("paused");
    expect(g.tick()).toBe(true);
    expect(g.state.snake[0]).toEqual({ x: 7, y: 5 }); // frozen
    g.resume();
    expect(g.state.status).toBe("running");
    g.tick();
    expect(g.state.snake[0]).toEqual({ x: 8, y: 5 });
  });

  it("any dispatch resumes a paused game", () => {
    const g = createSnake({ seed: 1 });
    g.dispatch("right");
    g.tick();
    g.pause();
    g.dispatch("down");
    expect(g.state.status).toBe("running");
  });

  it("reset restores the identical initial state", () => {
    const g = createSnake({ seed: 42 });
    const food0 = { ...g.state.food };
    g.dispatch("up");
    g.tick();
    g.tick();
    g.reset();
    expect(g.state.status).toBe("idle");
    expect(g.state.snake[0]).toEqual({ x: 6, y: 5 });
    expect(g.state.food).toEqual(food0);
    expect(g.state.score).toBe(0);
  });
});
