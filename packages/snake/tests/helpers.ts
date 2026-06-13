import type { Cell, SnakeGame, SnakeInput } from "../src/types";

const DELTAS: Record<SnakeInput, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
const OPPOSITE: Record<SnakeInput, SnakeInput> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

/** Dispatch+tick once, greedily moving the head toward `target`
 * (wrap-aware distance, avoids the snake's own body, never reverses). */
export function stepToward(game: SnakeGame, target: Cell): void {
  const { cols, rows, snake, dir } = game.state;
  const head = snake[0];
  const dist = (x: number, y: number) => {
    const dx = Math.min((x - target.x + cols) % cols, (target.x - x + cols) % cols);
    const dy = Math.min((y - target.y + rows) % rows, (target.y - y + rows) % rows);
    return dx + dy;
  };
  const body = new Set(snake.slice(0, -1).map((c) => `${c.x},${c.y}`));
  const moves = (Object.keys(DELTAS) as SnakeInput[])
    .filter((m) => m !== OPPOSITE[dir])
    .map((m) => {
      const [dx, dy] = DELTAS[m];
      const nx = (head.x + dx + cols) % cols;
      const ny = (head.y + dy + rows) % rows;
      return { m, d: dist(nx, ny), safe: !body.has(`${nx},${ny}`) };
    })
    .sort((a, b) => Number(b.safe) - Number(a.safe) || a.d - b.d);
  game.dispatch(moves[0].m);
  game.tick();
}

/** Drive the snake until its head reaches `target`. Throws if it dies or stalls. */
export function steerToCell(game: SnakeGame, target: Cell, maxTicks = 400): void {
  for (let i = 0; i < maxTicks; i++) {
    if (game.state.status === "dying" || game.state.status === "game-over") {
      throw new Error("snake died while steering");
    }
    stepToward(game, target);
    const h = game.state.snake[0];
    if (h.x === target.x && h.y === target.y) return;
  }
  throw new Error("failed to reach target");
}

/** Steer to the current food and eat it. */
export function eatNextFood(game: SnakeGame): void {
  steerToCell(game, { ...game.state.food });
}
