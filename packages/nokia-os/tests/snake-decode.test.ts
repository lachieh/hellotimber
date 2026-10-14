// The test-support decoder that reads a Snake II screen back into cells (plan 23 Task 5, D5.3),
// checked on synthetic frames painted from known cells with the Task 4 sprites.
import type { Bitmap } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { SNAKE_MAZES, SNAKE_SPRITES, type SnakeSpriteId } from "../src/resources";
import { decodeBoard } from "./support/snake-decode";
import { loadGolden } from "./support/goldens";

const W = 84;

function blank(): Uint8Array {
  const pixels = new Uint8Array(W * 48);
  for (let x = 0; x < W; x++) {
    pixels[6 * W + x] = 1;
    pixels[8 * W + x] = 1;
    pixels[47 * W + x] = 1;
  }
  for (let y = 8; y < 48; y++) {
    pixels[y * W] = 1;
    pixels[y * W + 83] = 1;
  }
  return pixels;
}

function blit(pixels: Uint8Array, bitmap: Bitmap, left: number, top: number): void {
  for (let y = 0; y < bitmap.height; y++)
    for (let x = 0; x < bitmap.width; x++)
      if (bitmap.pixels[y * bitmap.width + x]) pixels[(top + y) * W + left + x] = 1;
}

const at = (pixels: Uint8Array, id: SnakeSpriteId, cx: number, cy: number) =>
  blit(pixels, SNAKE_SPRITES[id], 2 + 4 * cx, 10 + 4 * cy);

function hud(pixels: Uint8Array, score: string, countdown?: string, icon?: SnakeSpriteId) {
  Array.from(score).forEach((d, i) =>
    blit(pixels, SNAKE_SPRITES[`digit/${d}` as SnakeSpriteId], 4 * i, 0),
  );
  if (countdown !== undefined) {
    blit(pixels, SNAKE_SPRITES[`digit/${countdown[0]}` as SnakeSpriteId], 75, 0);
    blit(pixels, SNAKE_SPRITES[`digit/${countdown[1]}` as SnakeSpriteId], 79, 0);
    blit(pixels, SNAKE_SPRITES[icon!], 66, 1);
  }
}

describe("decodeBoard (synthetic frames)", () => {
  it("reads the head, every segment, the food and the score", () => {
    const pixels = blank();
    hud(pixels, "0042");
    at(pixels, "tail/up", 3, 6);
    at(pixels, "corner/down-right", 3, 5);
    at(pixels, "body-fat/right", 4, 5);
    at(pixels, "body/right", 5, 5);
    at(pixels, "head-open/right", 6, 5);
    at(pixels, "food", 8, 5);
    const board = decodeBoard(pixels);
    expect(board.score).toBe(42);
    expect(board.head).toEqual({ x: 6, y: 5, heading: "right", open: true });
    expect(board.segments.map((s) => `${s.x},${s.y}`).sort()).toEqual(
      ["3,6", "3,5", "4,5", "5,5", "6,5"].sort(),
    );
    expect(board.food).toEqual({ x: 8, y: 5 });
    expect(board.creature).toBeUndefined();
    expect(board.countdown).toBeUndefined();
  });

  it("reads a creature's cells and kind, and the countdown beside its HUD icon", () => {
    for (let kind = 0; kind < 6; kind++) {
      const pixels = blank();
      hud(pixels, "0005", "17", `creature-icon/${kind}` as SnakeSpriteId);
      at(pixels, "head/up", 10, 3);
      at(pixels, "body/up", 10, 4);
      at(pixels, "tail/up", 10, 5);
      blit(pixels, SNAKE_SPRITES[`creature/${kind}` as SnakeSpriteId], 2 + 4 * 15, 10 + 4 * 7);
      const board = decodeBoard(pixels);
      expect(board.creature, `kind ${kind}`).toEqual({
        kind,
        cells: [
          { x: 15, y: 7 },
          { x: 16, y: 7 },
        ],
      });
      expect(board.countdown).toBe(17);
      expect(board.head).toEqual({ x: 10, y: 3, heading: "up", open: false });
    }
  });

  it("reads the large creature in either picture", () => {
    for (const frame of [1, 2] as const) {
      const pixels = blank();
      hud(pixels, "0005", "03", `large-icon/${frame}`);
      at(pixels, "head/left", 1, 1);
      at(pixels, "tail/left", 2, 1);
      blit(pixels, SNAKE_SPRITES[`large/${frame}`], 2 + 4 * 17, 10 + 4 * 2);
      const board = decodeBoard(pixels);
      expect(board.creature).toEqual({
        kind: "large",
        cells: [
          { x: 17, y: 2 },
          { x: 18, y: 2 },
          { x: 17, y: 3 },
          { x: 18, y: 3 },
        ],
      });
      expect(board.countdown).toBe(3);
    }
  });

  it("skips a maze's walls and reads a board with the snake hidden (the death blink)", () => {
    const g = loadGolden("game/snake/maze-1");
    const start = g.images.find((i) => i.name === "b")!.pixels;
    const board = decodeBoard(start, SNAKE_MAZES[1]);
    expect(board.head).toEqual({ x: 11, y: 4, heading: "right", open: false });
    expect(board.food).toEqual({ x: 12, y: 1 });
    const hidden = decodeBoard(g.images.find((i) => i.name === "j")!.pixels, SNAKE_MAZES[1]);
    expect(hidden.segments).toEqual([]);
    expect(hidden.head).toBeUndefined();
  });

  it("rejects what it cannot read: a stray picture, two heads, a non-board screen, walls it was not told of", () => {
    const stray = blank();
    hud(stray, "0000");
    stray[(10 + 4 * 2 + 1) * W + 2 + 4 * 3 + 1] = 1;
    expect(() => decodeBoard(stray)).toThrow(/cell \(3, 2\)/);

    const twoHeads = blank();
    hud(twoHeads, "0000");
    at(twoHeads, "head/up", 1, 1);
    at(twoHeads, "head/down", 5, 5);
    expect(() => decodeBoard(twoHeads)).toThrow(/2 heads/);

    expect(() => decodeBoard(new Uint8Array(W * 48))).toThrow(/not the Snake II board/);

    const g = loadGolden("game/snake/maze-1");
    expect(() => decodeBoard(g.images.find((i) => i.name === "b")!.pixels)).toThrow(/cell/);
  });

  it("reads the virgin New game frame: seven segments on row 4 heading right, food at (14, 8)", () => {
    const board = decodeBoard(loadGolden("tree/08-games/8-1-1.leaf").images[1]!.pixels);
    expect(board.head).toEqual({ x: 11, y: 4, heading: "right", open: false });
    expect(board.segments.map((s) => s.x)).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(board.food).toEqual({ x: 14, y: 8 });
    expect(board.score).toBe(0);
  });
});
