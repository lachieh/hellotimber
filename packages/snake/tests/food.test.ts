import { describe, expect, it } from "vite-plus/test";
import { createSnake } from "../src/index";
import { eatNextFood } from "./helpers";

describe("food", () => {
  it("eating grows the snake by one and scores `level` points", () => {
    const g = createSnake({ seed: 1, speed: 2 });
    const food0 = { ...g.state.food };
    expect(food0).toEqual({ x: 13, y: 0 });
    eatNextFood(g);
    expect(g.state.snake[0]).toEqual(food0);
    expect(g.state.snake).toHaveLength(4);
    expect(g.state.score).toBe(2);
    expect(g.state.foodsEaten).toBe(1);
  });

  it("respawns food deterministically, never on the snake", () => {
    const g = createSnake({ seed: 1, speed: 2 });
    eatNextFood(g);
    expect(g.state.food).toEqual({ x: 11, y: 9 });
    expect(g.state.snake).not.toContainEqual(g.state.food);
  });

  it("score scales with level for the same seed", () => {
    const a = createSnake({ seed: 1, speed: 1 });
    const b = createSnake({ seed: 1, speed: 9 });
    eatNextFood(a);
    eatNextFood(b);
    expect(a.state.score).toBe(1);
    expect(b.state.score).toBe(9);
  });

  it("eats several foods in a row and keeps growing", () => {
    const g = createSnake({ seed: 1 });
    for (let i = 0; i < 4; i++) eatNextFood(g);
    expect(g.state.foodsEaten).toBe(4);
    expect(g.state.snake).toHaveLength(7);
    expect(g.state.status).toBe("running");
  });
});
