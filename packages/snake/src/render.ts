import { createBitmap, drawArt, fillRect } from "./bitmap";
import { drawNumber, drawText5x7, numberWidth } from "./font";
import {
  SPRITE_BODY_NOTCH,
  SPRITE_BODY_SOLID,
  SPRITE_BONUS,
  SPRITE_FOOD,
  SPRITE_HEAD,
} from "./sprites";
import type { Bitmap, Cell, SnakeState } from "./types";

const SCORE_BAR_H = 8;
const CELL = 4;

function cellOrigin(c: Cell): readonly [number, number] {
  return [c.x * CELL, SCORE_BAR_H + c.y * CELL];
}

/** Pure rasterizer: SnakeState → 84×48 1bpp Bitmap. Never mutates state. */
export function renderSnakeFrame(state: SnakeState): Bitmap {
  const b = createBitmap(84, 48);

  if (state.status === "game-over") {
    drawText5x7(b, 15, 14, "GAME OVER"); // 53px wide, centered
    drawNumber(b, Math.floor((b.width - numberWidth(state.score)) / 2), 28, state.score);
    return b;
  }

  // — score bar —
  drawNumber(b, 1, 1, state.score);
  if (state.bonus) {
    drawNumber(b, b.width - (numberWidth(state.bonus.value) + 1), 1, state.bonus.value);
  }
  fillRect(b, 0, SCORE_BAR_H - 1, b.width, 1);

  // — playfield —
  for (const w of state.walls) {
    const [x, y] = cellOrigin(w);
    fillRect(b, x, y, CELL, CELL);
  }
  {
    const [x, y] = cellOrigin(state.food);
    drawArt(b, x, y, SPRITE_FOOD);
  }
  if (state.bonus) {
    const [x, y] = cellOrigin(state.bonus.cell);
    drawArt(b, x, y, SPRITE_BONUS);
  }
  const snakeVisible = state.status !== "dying" || state.flashOn;
  if (snakeVisible) {
    state.snake.forEach((c, i) => {
      const [x, y] = cellOrigin(c);
      const sprite = i === 0 ? SPRITE_HEAD : i % 2 === 1 ? SPRITE_BODY_NOTCH : SPRITE_BODY_SOLID;
      drawArt(b, x, y, sprite);
    });
  }
  return b;
}
