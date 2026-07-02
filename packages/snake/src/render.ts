import { createBitmap, drawArt, fillRect, setPixel } from "./bitmap";
import { drawNumber, drawText5x7, numberWidth } from "./font";
import { HEAD, SPRITE_BONUS, SPRITE_FOOD } from "./sprites";
import type { Bitmap, Cell, SnakeState } from "./types";

const SCORE_BAR_H = 8;
const CELL = 4;

function cellOrigin(c: Cell): readonly [number, number] {
  return [c.x * CELL, SCORE_BAR_H + c.y * CELL];
}

type Dir = "up" | "right" | "down" | "left";

/** Direction from `from` toward `to`, normalized across board wrap. */
function dirBetween(from: Cell, to: Cell): Dir {
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  if (dx > 1) dx = -1;
  else if (dx < -1) dx = 1;
  if (dy > 1) dy = -1;
  else if (dy < -1) dy = 1;
  if (dx === 1) return "right";
  if (dx === -1) return "left";
  if (dy === 1) return "down";
  return "up";
}

const HORIZONTAL = (d: Dir): boolean => d === "left" || d === "right";

/** Header rule + playfield frame, solid 1px (reference-measured: the
 *  "dashes" in photos are the LCD pixel grid, not gaps). Layout per the
 *  reference: digits rows 0–4, gap 5, underline 6, gap 7, frame top 8.
 *  The frame overlaps the outermost pixel of edge cells on all four sides
 *  (left/right/bottom always did; the top now matches). */
function drawFrame(b: Bitmap): void {
  const top = SCORE_BAR_H; // y 8
  const bottom = b.height - 1; // y 47
  fillRect(b, 0, top - 2, b.width, 1); // score underline (y 6); y 7 stays clear
  fillRect(b, 0, top, b.width, 1);
  fillRect(b, 0, bottom, b.width, 1);
  for (let y = top; y <= bottom; y++) {
    setPixel(b, 0, y);
    setPixel(b, b.width - 1, y);
  }
}

/** Pure rasterizer: SnakeState → 84×48 1bpp Bitmap. Never mutates state. */
export function renderSnakeFrame(state: SnakeState): Bitmap {
  const b = createBitmap(84, 48);

  if (state.status === "game-over") {
    drawText5x7(b, 15, 14, "GAME OVER"); // 53px wide, centered
    drawNumber(b, Math.floor((b.width - numberWidth(state.score)) / 2), 28, state.score);
    return b;
  }

  // — score bar: 4-digit zero-padded, bold, top-left (Snake II style) —
  drawNumber(b, 1, 0, state.score, 4);
  if (state.bonus) {
    drawNumber(b, b.width - (numberWidth(state.bonus.value) + 1), 0, state.bonus.value);
  }
  drawFrame(b);

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
  if (!snakeVisible) return b;

  const { snake } = state;
  snake.forEach((c, i) => {
    const [x, y] = cellOrigin(c);
    const parity = (c.x + c.y) % 2 === 0;

    if (i === 0) {
      const facing = snake.length > 1 ? dirBetween(snake[1]!, c) : "right";
      drawArt(b, x, y, HEAD[facing]);
      return;
    }

    const toPrev = dirBetween(c, snake[i - 1]!);
    if (i === snake.length - 1) {
      // Tail: a thin line tapering off in the travel axis, riding the wave band.
      if (HORIZONTAL(toPrev)) {
        const row = y + (parity ? 1 : 2);
        for (let dx = 0; dx < CELL; dx++) setPixel(b, x + dx, row);
      } else {
        const col = x + (parity ? 1 : 2);
        for (let dy = 0; dy < CELL; dy++) setPixel(b, col, y + dy);
      }
      return;
    }

    const toNext = dirBetween(c, snake[i + 1]!);
    if (HORIZONTAL(toPrev) && HORIZONTAL(toNext)) {
      // Straight horizontal: 2×2 block on the parity band + stepping wings.
      const off = parity ? 0 : 2;
      fillRect(b, x + 1, y + off, 2, 2);
      const wingRow = y + (parity ? 1 : 2);
      setPixel(b, x, wingRow);
      setPixel(b, x + 3, wingRow);
    } else if (!HORIZONTAL(toPrev) && !HORIZONTAL(toNext)) {
      // Straight vertical: transposed wave.
      const off = parity ? 0 : 2;
      fillRect(b, x + off, y + 1, 2, 2);
      const wingCol = x + (parity ? 1 : 2);
      setPixel(b, wingCol, y);
      setPixel(b, wingCol, y + 3);
    } else {
      // Corner: chunky center block + a pixel toward each neighbor.
      fillRect(b, x + 1, y + 1, 2, 2);
      for (const d of [toPrev, toNext]) {
        if (d === "left") setPixel(b, x, y + 1);
        else if (d === "right") setPixel(b, x + 3, y + 2);
        else if (d === "up") setPixel(b, x + 2, y);
        else setPixel(b, x + 1, y + 3);
      }
    }
  });
  return b;
}
