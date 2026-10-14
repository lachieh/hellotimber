// Snake II resources derived from the goldens (plan 23 Task 4): the crop table, the mazes and
// the timing tables. Expected values come from the Task 0 outcome and from reading the goldens.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { LCD_WIDTH, parseTickGolden } from "../scripts/golden-format.ts";
import { extractMaze, SNAKE_CROPS } from "../scripts/snake-resources.ts";
import { missingStockGlyphs } from "../src/index";
import {
  SNAKE_DEATH_STEPS,
  SNAKE_FIRST_TICK,
  SNAKE_GRACE_MS,
  SNAKE_TOP_SCORE_MS,
  SNAKE_MAZES,
  SNAKE_PERIODS,
  SNAKE_SPRITE_IDS,
  SNAKE_SPRITES,
  WIDGET_SPRITES,
} from "../src/resources";
import { SNAKE_DATA } from "../src/resources/generated/snake";
import { loadGolden } from "./support/goldens";

const cellLeft = (x: number) => 2 + 4 * x;
const cellTop = (y: number) => 10 + 4 * y;

function imageOf(id: string, name: string): Uint8Array {
  const image = loadGolden(id).images.find((i) => i.name === name);
  if (!image) throw new Error(`${id} has no image ${name}`);
  return image.pixels;
}

/** Walls as the firmware draws them: a 2-px line from cell centre to cell centre (H1). */
function paintWalls(walls: readonly { x1: number; y1: number; x2: number; y2: number }[]) {
  const pixels = new Uint8Array(LCD_WIDTH * 48);
  for (const { x1, y1, x2, y2 } of walls) {
    for (let y = cellTop(Math.min(y1, y2)) + 1; y <= cellTop(Math.max(y1, y2)) + 2; y++) {
      for (let x = cellLeft(Math.min(x1, x2)) + 1; x <= cellLeft(Math.max(x1, x2)) + 2; x++) {
        pixels[y * LCD_WIDTH + x] = 1;
      }
    }
  }
  return pixels;
}

const STRAIGHT = ["....", "##.#", "#.##", "...."];
const TAIL = ["....", "..##", "####", "...."];
const HEAD = ["#...", ".##.", "###.", "...."];
const FOOD = [".#..", "#.#.", ".#..", "...."];

/** A synthetic New game frame: the board frame, a seven-cell snake heading right, food, walls. */
function startFrame(
  start: { x: number; y: number },
  walls: readonly { x1: number; y1: number; x2: number; y2: number }[],
  food: { x: number; y: number },
): Uint8Array {
  const pixels = paintWalls(walls);
  const put = (art: readonly string[], cx: number, cy: number) =>
    art.forEach((row, dy) =>
      Array.from(row).forEach((ch, dx) => {
        if (ch === "#") pixels[(cellTop(cy) + dy) * LCD_WIDTH + cellLeft(cx) + dx] = 1;
      }),
    );
  for (let x = 0; x < LCD_WIDTH; x++) {
    pixels[6 * LCD_WIDTH + x] = 1;
    pixels[8 * LCD_WIDTH + x] = 1;
    pixels[47 * LCD_WIDTH + x] = 1;
  }
  for (let y = 8; y < 48; y++) {
    pixels[y * LCD_WIDTH] = 1;
    pixels[y * LCD_WIDTH + 83] = 1;
  }
  put(TAIL, start.x + 1, start.y);
  for (let i = 2; i < 7; i++) put(STRAIGHT, start.x + i, start.y);
  put(HEAD, start.x + 7, start.y);
  put(FOOD, food.x, food.y);
  return pixels;
}

describe("maze extraction (synthetic frames)", () => {
  it("reads walls as maximal segments and the start cell from the snake", () => {
    const walls = [
      { x1: 0, y1: 0, x2: 19, y2: 0 },
      { x1: 0, y1: 0, x2: 0, y2: 8 },
      { x1: 8, y1: 6, x2: 8, y2: 8 },
      { x1: 15, y1: 2, x2: 15, y2: 2 },
    ];
    const maze = extractMaze(startFrame({ x: 3, y: 4 }, walls, { x: 12, y: 1 }), "synthetic");
    expect(maze.start).toEqual({ x: 3, y: 4 });
    expect(maze.walls).toEqual(walls);
  });

  it("finds no walls on an open board, and rejects a frame without a snake", () => {
    expect(extractMaze(startFrame({ x: 4, y: 4 }, [], { x: 14, y: 8 }), "open").walls).toEqual([]);
    expect(() => extractMaze(new Uint8Array(LCD_WIDTH * 48), "blank")).toThrow(/blank: .*snake/);
  });
});

describe("Snake II mazes", () => {
  it("start each maze from the captured start cell (H2)", () => {
    expect(SNAKE_MAZES.map((maze) => maze.start)).toEqual([
      { x: 4, y: 4 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
      { x: 0, y: 5 },
      { x: 4, y: 7 },
      { x: 4, y: 4 },
    ]);
  });

  it("draw exactly the walls of each maze's New game frame", () => {
    SNAKE_MAZES.forEach((maze, m) => {
      const golden = imageOf(`game/snake/maze-${m}`, "b");
      const drawn = paintWalls(maze.walls);
      const snake = new Set(Array.from({ length: 7 }, (_, i) => `${maze.start.x + 1 + i}`));
      for (let y = 9; y <= 46; y++) {
        for (let x = 1; x <= 82; x++) {
          const cx = Math.floor((x - 2) / 4);
          const cy = Math.floor((y - 10) / 4);
          if (cy === maze.start.y && snake.has(String(cx))) continue;
          if (drawn[y * LCD_WIDTH + x] === 1) {
            expect(golden[y * LCD_WIDTH + x], `maze ${m} (${x}, ${y})`).toBe(1);
          }
        }
      }
      // Every lit board pixel outside the snake and the food (a 3x3 diamond) is wall.
      let unexplained = 0;
      for (let y = 9; y <= 46; y++) {
        for (let x = 1; x <= 82; x++) {
          if (golden[y * LCD_WIDTH + x] !== 1 || drawn[y * LCD_WIDTH + x] === 1) continue;
          const cy = Math.floor((y - 10) / 4);
          const cx = Math.floor((x - 2) / 4);
          if (cy === maze.start.y && snake.has(String(cx))) continue;
          unexplained++;
        }
      }
      expect(unexplained, `maze ${m}: lit pixels that are not wall or snake`).toBe(4); // the food
    });
  });

  it("have no walls without a maze, and the board's border on Maze 1", () => {
    expect(SNAKE_MAZES[0]!.walls).toEqual([]);
    const cells = new Set<string>();
    for (const { x1, y1, x2, y2 } of SNAKE_MAZES[1]!.walls) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) cells.add(`${x},${y}`);
    }
    const border: string[] = [];
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 20; x++)
        if (x === 0 || x === 19 || y === 0 || y === 8) border.push(`${x},${y}`);
    expect([...cells].sort()).toEqual(border.sort());
  });

  it("leave the start cell and the snake's seven cells free", () => {
    SNAKE_MAZES.forEach((maze, m) => {
      for (let x = maze.start.x; x <= maze.start.x + 7; x++) {
        for (const w of maze.walls) {
          const inside =
            x >= Math.min(w.x1, w.x2) &&
            x <= Math.max(w.x1, w.x2) &&
            maze.start.y >= Math.min(w.y1, w.y2) &&
            maze.start.y <= Math.max(w.y1, w.y2);
          expect(inside, `maze ${m} cell (${x}, ${maze.start.y})`).toBe(false);
        }
      }
    });
  });
});

describe("Snake II timing", () => {
  it("ticks levels 1-9 at the captured periods and first ticks (Task 0, C2)", () => {
    const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    // The median of each golden's seven intervals. Task 0's medians over the whole 10 s
    // recordings read 286 and 170 for levels 4 and 6 (37 and 22 units: 286.6 and 170.4 ms).
    expect(levels.map((l) => SNAKE_PERIODS[l])).toEqual([
      635, 465, 364, 287, 217, 171, 132, 101, 85,
    ]);
    expect(levels.map((l) => SNAKE_FIRST_TICK[l])).toEqual([
      616, 445, 347, 267, 197, 150, 112, 81, 65,
    ]);
  });

  it("has a positive integer period and first tick for every storable level 1..175 (D2)", () => {
    for (let level = 1; level <= 175; level++) {
      for (const table of [SNAKE_PERIODS, SNAKE_FIRST_TICK]) {
        const ms = table[level];
        expect(Number.isInteger(ms) && ms! > 0, `level ${level}: ${ms}`).toBe(true);
      }
    }
    expect(Object.keys(SNAKE_PERIODS)).toHaveLength(175);
    // The virgin level runs at one timer unit (C3).
    expect(SNAKE_PERIODS[175]).toBe(8);
  });

  it("takes levels 10..175 from the period fixture: a period among each level's intervals", () => {
    const fixture = parseTickGolden(
      readFileSync(join(import.meta.dirname, "../goldens/game/snake/periods.ticks.txt"), "utf8"),
      "periods.ticks.txt",
    );
    expect(fixture.rows.map((row) => row.level)).toEqual(
      Array.from({ length: 166 }, (_, i) => i + 10),
    );
    for (const row of fixture.rows) {
      expect(row.intervalsMs, `level ${row.level}`).toContain(SNAKE_PERIODS[row.level]);
      expect(SNAKE_FIRST_TICK[row.level], `level ${row.level}`).toBe(row.firstMs);
    }
  });

  it("gives the grace tick ≈93 ms after a blocked tick (H6)", () => {
    expect(SNAKE_GRACE_MS).toBeGreaterThanOrEqual(88);
    expect(SNAKE_GRACE_MS).toBeLessThanOrEqual(104);
  });

  it("blinks a dead snake in nine frames ≈240 ms apart, game over ≈2.07 s after the crash (H11)", () => {
    expect(SNAKE_DEATH_STEPS.map((s) => s.visible)).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
    for (const step of SNAKE_DEATH_STEPS.slice(0, -1)) {
      expect(step.durationMs).toBeGreaterThanOrEqual(235);
      expect(step.durationMs).toBeLessThanOrEqual(245);
    }
    const total = SNAKE_DEATH_STEPS.reduce((sum, s) => sum + s.durationMs, 0);
    expect(total).toBeGreaterThanOrEqual(2060);
    expect(total).toBeLessThanOrEqual(2085);
  });

  it("holds a new top score's game-over screen ≈45 ms longer (virgin-game: 190 ms, not 145)", () => {
    expect(SNAKE_TOP_SCORE_MS).toBe(45);
  });
});

describe("Snake II sprites", () => {
  it("crops every listed sprite from its golden: binary art with ink, lit only where the golden is", () => {
    for (const crop of SNAKE_CROPS) {
      const art = SNAKE_DATA.sprites[crop.id]!;
      expect(art, crop.id).toHaveLength(crop.height);
      expect(art.join(""), crop.id).toMatch(/^[#.]*#[#.]*$/);
      const pixels = imageOf(crop.golden, crop.image);
      art.forEach((row, dy) => {
        expect(row, crop.id).toHaveLength(crop.width);
        Array.from(row).forEach((ch, dx) => {
          expect(ch === "#", `${crop.id} (${dx}, ${dy})`).toBe(
            pixels[(crop.y + dy) * LCD_WIDTH + crop.x + dx] === 1,
          );
        });
      });
    }
  });

  it("lists each sprite once and covers every picture the painter needs", () => {
    const ids = SNAKE_CROPS.map((crop) => crop.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...SNAKE_SPRITE_IDS].sort());
    for (const id of SNAKE_SPRITE_IDS) expect(SNAKE_SPRITES[id], id).toBeDefined();
  });

  it("sizes pictures by kind: 4x4 cells, 8x4 creatures, 8x8 large creature, 4x5 digits", () => {
    for (const id of SNAKE_SPRITE_IDS) {
      const { width, height } = SNAKE_SPRITES[id];
      const size = id.startsWith("large/")
        ? [8, 8]
        : id.startsWith("creature") || id.startsWith("large-icon/")
          ? [8, 4]
          : id.startsWith("digit/")
            ? [4, 5]
            : [4, 4];
      expect([width, height], id).toEqual(size);
    }
  });

  it("draws the HUD's 0000 with the digit sprites (ticks-l1, the New game frame)", () => {
    const pixels = imageOf("game/snake/ticks-l1", "b");
    const zero = SNAKE_SPRITES["digit/0"];
    for (const left of [0, 4, 8, 12]) {
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 4; x++)
          expect(pixels[y * LCD_WIDTH + left + x], `x ${left + x}, y ${y}`).toBe(
            zero.pixels[y * 4 + x],
          );
    }
  });
});

describe("game-over screens", () => {
  it("render their texts in the large face (D13)", () => {
    for (const text of ["Game over!", "Your score:", "TOP SCORE:", "0123456789"]) {
      expect(missingStockGlyphs(text, "large"), text).toEqual([]);
    }
  });

  it("has the Snake II Level page's bars for every count; nine bars is the virgin page (D11)", () => {
    for (let n = 1; n <= 9; n++) expect(WIDGET_SPRITES[`level/snake-${n}`], `${n}`).toBeDefined();
    expect(WIDGET_SPRITES["level/snake-9"]!.bitmap.pixels).toEqual(
      WIDGET_SPRITES["level/8-1"]!.bitmap.pixels,
    );
  });
});
