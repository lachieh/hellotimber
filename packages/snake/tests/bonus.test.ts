import { describe, expect, it } from "vite-plus/test";
import { createSnake } from "../src/index";
import { eatNextFood, stepToward } from "./helpers";

function gameWithBonus(speed = 3) {
  const g = createSnake({ seed: 1, speed });
  for (let i = 0; i < 5; i++) eatNextFood(g);
  return g;
}

describe("bonus bug", () => {
  it("spawns on the 5th food with ttl 20 and value level*5", () => {
    const g = gameWithBonus();
    expect(g.state.foodsEaten).toBe(5);
    expect(g.state.bonus).toEqual({ cell: { x: 2, y: 4 }, ttl: 20, value: 15 });
  });

  it("does not spawn before the 5th food", () => {
    const g = createSnake({ seed: 1, speed: 3 });
    for (let i = 0; i < 4; i++) eatNextFood(g);
    expect(g.state.bonus).toBeNull();
  });

  it("never spawns on the snake, walls or food", () => {
    const g = gameWithBonus();
    const b = g.state.bonus!;
    expect(g.state.snake).not.toContainEqual(b.cell);
    expect(g.state.food).not.toEqual(b.cell);
  });

  it("counts down ttl and value each tick, value floors at 1", () => {
    const g = gameWithBonus();
    g.tick();
    expect(g.state.bonus).toEqual({ cell: { x: 2, y: 4 }, ttl: 19, value: 14 });
    for (let i = 0; i < 15; i++) g.tick();
    expect(g.state.bonus).toEqual({ cell: { x: 2, y: 4 }, ttl: 4, value: 1 });
  });

  it("expires after 20 ticks, awarding nothing", () => {
    const g = gameWithBonus();
    const score = g.state.score;
    for (let i = 0; i < 20; i++) g.tick();
    expect(g.state.bonus).toBeNull();
    expect(g.state.score).toBe(score);
    expect(g.state.status).toBe("running");
    expect(g.state.foodsEaten).toBe(5);
  });

  it("eating the bonus scores its current value and does not grow", () => {
    const g = gameWithBonus();
    const cell = { ...g.state.bonus!.cell };
    const scoreBefore = g.state.score;
    const lenBefore = g.state.snake.length;
    let lastValue = g.state.bonus!.value;
    for (let i = 0; i < 100 && g.state.bonus; i++) {
      lastValue = g.state.bonus.value;
      stepToward(g, cell);
    }
    expect(g.state.snake[0]).toEqual(cell); // reached it before expiry
    expect(g.state.score).toBe(scoreBefore + lastValue);
    expect(g.state.snake).toHaveLength(lenBefore);
  });
});
