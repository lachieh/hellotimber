// Snake II resources derived from the committed goldens (plan 23 Task 4, D3): the crop table of
// the board, HUD and creature pictures, the maze walls and start cells, and the tick, grace and
// death timing. `extract-resources.ts` runs `extractSnakeResources` and writes
// src/resources/generated/snake.ts. Nothing here comes from the firmware image.
//
// Geometry (H1): cell (x, y) of the 20x9 board has its top-left pixel at (2 + 4x, 10 + 4y); the
// snake, the food and the walls draw inside their cells. Imports only sibling scripts.
import {
  findGoldenImage,
  LCD_HEIGHT,
  LCD_WIDTH,
  type Golden,
  type TickGolden,
} from "./golden-format.ts";
import {
  framePeriod,
  isBoardFrame,
  numberTicks,
  PERIOD_BY_LEVEL,
  type PlayedFrame,
} from "./game-capture-set.ts";

export const BOARD_WIDTH = 20;
export const BOARD_HEIGHT = 9;
export const cellLeft = (x: number): number => 2 + 4 * x;
export const cellTop = (y: number): number => 10 + 4 * y;

/** One picture: a rectangle of a golden image. */
export interface SnakeCrop {
  readonly id: string;
  readonly golden: string;
  readonly image: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A picture filling `w`x`h` cells from cell (cx, cy). */
function cells(
  id: string,
  golden: string,
  image: string,
  cx: number,
  cy: number,
  w = 1,
  h = 1,
): SnakeCrop {
  return { id, golden, image, x: cellLeft(cx), y: cellTop(cy), width: 4 * w, height: 4 * h };
}

const LONG = "game/snake/bot-long";

/** The HUD creature icon: x 66..73, y 1..4 (one rectangle for every kind). */
function icon(id: string, golden: string, image: string): SnakeCrop {
  return { id, golden, image, x: 66, y: 1, width: 8, height: 4 };
}

/** A HUD digit: the score's last digit (x 12..15, y 0..4) in a still whose score ends in it. */
function digit(d: number, image: string): SnakeCrop {
  return { id: `digit/${d}`, golden: LONG, image, x: 12, y: 0, width: 4, height: 5 };
}

/**
 * Where each picture is seen (located by replaying the bot games' `input`). Directions are
 * directions of travel: a tail's is the way to the next segment; a corner is named by the two
 * cell edges it joins (`up-left`: entered heading down and left heading left, or entered heading
 * right and left heading up). Creature kinds are the generator's `rand16 mod 6` (H9), recovered
 * by replaying each game's seed (Task 0 `seeds.json`, Task 4 recaptures).
 */
export const SNAKE_CROPS: readonly SnakeCrop[] = [
  cells("head/right", LONG, "t0000", 11, 4),
  cells("head/left", LONG, "t0024", 11, 1),
  cells("head/up", LONG, "t0084", 12, 5),
  cells("head/down", LONG, "t0007", 14, 8),
  cells("head-open/right", LONG, "t0012", 18, 7),
  cells("head-open/left", LONG, "t0116", 15, 6),
  cells("head-open/up", LONG, "t0083", 12, 6),
  cells("head-open/down", LONG, "t0006", 14, 7),
  cells("tail/right", LONG, "t0000", 5, 4),
  cells("tail/left", LONG, "t0022", 19, 8),
  cells("tail/up", LONG, "t0100", 12, 7),
  cells("tail/down", LONG, "t0012", 14, 6),
  cells("body/right", LONG, "t0000", 6, 4),
  cells("body/left", LONG, "t0022", 18, 8),
  cells("body/up", LONG, "t0083", 12, 7),
  cells("body/down", LONG, "t0006", 14, 5),
  cells("body-fat/right", LONG, "t0294", 0, 3),
  cells("body-fat/left", LONG, "t0118", 14, 6),
  cells("body-fat/up", LONG, "t0147", 13, 7),
  // The only meal eaten heading down and left heading down: the virgin meal at (14, 8).
  cells("body-fat/down", "game/snake/virgin-meal", "i", 14, 8),
  cells("corner/up-left", LONG, "t0012", 15, 8),
  cells("corner/up-right", LONG, "t0083", 12, 8),
  cells("corner/down-left", LONG, "t0006", 14, 4),
  cells("corner/down-right", LONG, "t0022", 12, 8),
  cells("corner-fat/up-left", LONG, "t0024", 12, 1),
  cells("corner-fat/up-right", LONG, "t0008", 14, 8),
  cells("corner-fat/down-left", LONG, "t0014", 19, 7),
  cells("corner-fat/down-right", "game/snake/bot-maze2", "t0034", 0, 3),
  cells("food", LONG, "t0000", 14, 8),
  cells("creature/0", "game/snake/creature-0956", "t0037", 4, 5, 2),
  cells("creature/1", "game/snake/creature-1107", "t0030", 18, 8, 2),
  cells("creature/2", "game/snake/creature-1007", "t0036", 7, 7, 2),
  cells("creature/3", LONG, "t0261", 3, 1, 2),
  cells("creature/4", LONG, "t0095", 11, 2, 2),
  cells("creature/5", LONG, "t0045", 6, 1, 2),
  icon("creature-icon/0", "game/snake/creature-0956", "t0037"),
  icon("creature-icon/1", "game/snake/creature-1107", "t0030"),
  icon("creature-icon/2", "game/snake/creature-1007", "t0036"),
  icon("creature-icon/3", LONG, "t0261"),
  icon("creature-icon/4", LONG, "t0095"),
  icon("creature-icon/5", LONG, "t0045"),
  // The 2x2 creature alternates two pictures tick by tick from its first (long, tick 212).
  cells("large/1", LONG, "t0212", 17, 2, 2, 2),
  cells("large/2", LONG, "t0213", 17, 2, 2, 2),
  icon("large-icon/1", LONG, "t0212"),
  icon("large-icon/2", LONG, "t0213"),
  // Level 1 scores one point per meal and no creature is eaten before tick 105: 000n.
  digit(0, "t0000"),
  digit(1, "t0007"),
  digit(2, "t0013"),
  digit(3, "t0023"),
  digit(4, "t0037"),
  digit(5, "t0045"),
  digit(6, "t0050"),
  digit(7, "t0057"),
  digit(8, "t0066"),
  digit(9, "t0076"),
];

// ---------------------------------------------------------------- pixels

function lit(pixels: Uint8Array, x: number, y: number): boolean {
  return pixels[y * LCD_WIDTH + x] === 1;
}

function crop(pixels: Uint8Array, x0: number, y0: number, width: number, height: number): string[] {
  const rows: string[] = [];
  for (let y = y0; y < y0 + height; y++) {
    let row = "";
    for (let x = x0; x < x0 + width; x++) row += lit(pixels, x, y) ? "#" : ".";
    rows.push(row);
  }
  return rows;
}

const cellArt = (pixels: Uint8Array, cx: number, cy: number): string =>
  crop(pixels, cellLeft(cx), cellTop(cy), 4, 4).join("/");

/** The cell's 2x2 centre is lit, as on every wall cell (walls run through cell centres). */
function centreLit(pixels: Uint8Array, cx: number, cy: number): boolean {
  const x = cellLeft(cx) + 1;
  const y = cellTop(cy) + 1;
  return (
    lit(pixels, x, y) && lit(pixels, x + 1, y) && lit(pixels, x, y + 1) && lit(pixels, x + 1, y + 1)
  );
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ---------------------------------------------------------------- mazes

export interface WallSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface MazeData {
  /** The cell behind the tail: the snake's seven cells are (x + 1 .. x + 7, y) (H2). */
  readonly start: { readonly x: number; readonly y: number };
  readonly walls: readonly WallSegment[];
}

/** Paints walls as the firmware draws them: a 2-px line from cell centre to cell centre. */
function paintWalls(walls: readonly WallSegment[], pixels: Uint8Array): void {
  for (const { x1, y1, x2, y2 } of walls) {
    for (let y = cellTop(Math.min(y1, y2)) + 1; y <= cellTop(Math.max(y1, y2)) + 2; y++) {
      for (let x = cellLeft(Math.min(x1, x2)) + 1; x <= cellLeft(Math.max(x1, x2)) + 2; x++) {
        pixels[y * LCD_WIDTH + x] = 1;
      }
    }
  }
}

/**
 * The New game frame's seven-cell snake: inked cells in a row whose middle five show one
 * picture without a lit centre (so not a wall run) and whose two ends show others.
 */
function findSnake(pixels: Uint8Array, where: string): { x: number; y: number } {
  const found: { x: number; y: number }[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x0 = 0; x0 + 7 <= BOARD_WIDTH; x0++) {
      const arts = Array.from({ length: 7 }, (_, i) => cellArt(pixels, x0 + i, y));
      if (arts.some((art) => !art.includes("#"))) continue;
      const middle = arts.slice(1, 6);
      if (middle.some((art) => art !== middle[0])) continue;
      if (arts[0] === middle[0] || arts[6] === middle[0] || centreLit(pixels, x0 + 1, y)) continue;
      found.push({ x: x0 - 1, y });
    }
  }
  if (found.length !== 1) throw new Error(`${where}: ${found.length} seven-cell snakes, need one`);
  return found[0]!;
}

/** A maze from its New game frame: the start cell from the snake, walls as maximal segments. */
export function extractMaze(pixels: Uint8Array, where: string): MazeData {
  const start = findSnake(pixels, where);
  const snake = (x: number, y: number) => y === start.y && x > start.x && x <= start.x + 7;
  const wall = (x: number, y: number) =>
    x >= 0 &&
    x < BOARD_WIDTH &&
    y >= 0 &&
    y < BOARD_HEIGHT &&
    !snake(x, y) &&
    centreLit(pixels, x, y);
  /** The line from the centre of (x, y) to the centre of the next cell along (dx, dy) is drawn. */
  const linked = (x: number, y: number, dx: number, dy: number): boolean => {
    if (!wall(x, y) || !wall(x + dx, y + dy)) return false;
    for (let step = 2; step <= 5; step++) {
      for (let across = 1; across <= 2; across++) {
        const px = cellLeft(x) + (dx === 1 ? step : across);
        const py = cellTop(y) + (dy === 1 ? step : across);
        if (!lit(pixels, px, py)) return false;
      }
    }
    return true;
  };

  const walls: WallSegment[] = [];
  const covered = new Set<string>();
  const runs = (dx: number, dy: number): void => {
    const outer = dy === 0 ? BOARD_HEIGHT : BOARD_WIDTH;
    const inner = dy === 0 ? BOARD_WIDTH : BOARD_HEIGHT;
    for (let o = 0; o < outer; o++) {
      for (let i = 0; i < inner; i++) {
        const x = dy === 0 ? i : o;
        const y = dy === 0 ? o : i;
        if (!linked(x, y, dx, dy) || linked(x - dx, y - dy, dx, dy)) continue;
        let end = 0;
        while (linked(x + end * dx, y + end * dy, dx, dy)) end++;
        walls.push({ x1: x, y1: y, x2: x + end * dx, y2: y + end * dy });
        for (let k = 0; k <= end; k++) covered.add(`${x + k * dx},${y + k * dy}`);
      }
    }
  };
  runs(1, 0);
  runs(0, 1);
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (wall(x, y) && !covered.has(`${x},${y}`)) walls.push({ x1: x, y1: y, x2: x, y2: y });
    }
  }

  // The segments must redraw every wall cell's ink exactly.
  const drawn = new Uint8Array(LCD_WIDTH * LCD_HEIGHT);
  paintWalls(walls, drawn);
  for (let cy = 0; cy < BOARD_HEIGHT; cy++) {
    for (let cx = 0; cx < BOARD_WIDTH; cx++) {
      if (!wall(cx, cy)) continue;
      for (let y = cellTop(cy); y < cellTop(cy) + 4; y++) {
        for (let x = cellLeft(cx); x < cellLeft(cx) + 4; x++) {
          if (lit(pixels, x, y) !== (drawn[y * LCD_WIDTH + x] === 1)) {
            throw new Error(`${where}: wall cell (${cx}, ${cy}) is not lines through cell centres`);
          }
        }
      }
    }
  }
  return { start, walls };
}

// ---------------------------------------------------------------- timing

/** The median (the upper middle of an even count, as `framePeriod`). */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function playedFrames(golden: Golden): PlayedFrame[] {
  if (!golden.timeline) throw new Error(`${golden.id}: not a timeline`);
  return golden.timeline.map((row, i) => ({
    pixels: findGoldenImage(golden, row.image).pixels,
    startMs: row.startMs,
    durationMs: row.durationMs,
    dir: golden.id,
    frame: i,
  }));
}

function ticksOf(golden: Golden, level: number) {
  const frames = playedFrames(golden);
  return numberTicks(frames, PERIOD_BY_LEVEL[level] ?? framePeriod(frames));
}

/** A timeline's first tick (after tick 0, the New game frame) and its median interval. */
function timelinePeriod(golden: Golden, level: number): { firstMs: number; periodMs: number } {
  const starts = ticksOf(golden, level)
    .filter((tick) => !tick.virtual)
    .map((tick) => tick.startMs);
  if (starts.length < 4) throw new Error(`${golden.id}: ${starts.length} tick frames, need 4`);
  return {
    firstMs: Math.round(starts[1]! - starts[0]!),
    periodMs: Math.round(median(starts.slice(2).map((start, i) => start - starts[i + 1]!))),
  };
}

export interface DeathStep {
  readonly visible: boolean;
  readonly durationMs: number;
}

/**
 * A timeline's death blink: the frames before the game-over screen (the first frame that is not
 * the board: the note or the fireworks) alternate the hidden and the shown snake, starting hidden; the frame before the first
 * hidden one is the last tick (the snake shown). Undefined when nothing blinks.
 */
function blinkOf(golden: Golden): DeathStep[] | undefined {
  const frames = playedFrames(golden);
  const over = frames.findIndex(
    (f, i) => i > 0 && !isBoardFrame(f.pixels) && isBoardFrame(frames[i - 1]!.pixels),
  );
  if (over < 3) return undefined;
  const hidden = frames[over - 1]!.pixels;
  const shown = frames[over - 2]!.pixels;
  if (same(hidden, shown)) return undefined;
  let first = over - 1;
  while (
    first >= 3 &&
    same(frames[first - 2]!.pixels, hidden) &&
    same(frames[first - 1]!.pixels, shown)
  ) {
    first -= 2;
  }
  return frames.slice(first, over).map((frame) => ({
    visible: same(frame.pixels, shown),
    durationMs: frame.durationMs,
  }));
}

/** Timelines with a death blink (C4 mazes, C5 bot deaths, C6, the Task 4 score-8 recapture). */
const DEATH_GOLDENS = [
  "game/snake/maze-1",
  "game/snake/maze-3",
  "game/snake/maze-4",
  "game/snake/bot-short.death",
  "game/snake/bot-maze2.death",
  "game/snake/bot-maze3.death",
  "game/snake/bot-grace.death",
  "game/snake/virgin-game",
  "game/snake/score-8.death",
] as const;

/** The death timeline with a blink and a new top score (fireworks, `TOP SCORE: 175`). */
const TOP_SCORE_DEATH = "game/snake/virgin-game";

/**
 * The timeline whose snake a turn in the grace saves (C6: ← after the blocked tick 7): its move
 * frame comes one grace after the blocked tick. A crash draws its first hidden frame -5..+17 ms
 * around the grace tick (maze-1/3/4), within the game tolerance (D6).
 */
const GRACE_GOLDEN = { id: "game/snake/virgin-game", level: 175 } as const;

// ---------------------------------------------------------------- extraction

export interface SnakeResourceData {
  readonly sprites: Readonly<Record<string, readonly string[]>>;
  /** No maze, then Maze 1..5. */
  readonly mazes: readonly MazeData[];
  /** Level → tick period, and the first tick after the New game frame (ms). */
  readonly periods: Readonly<Record<string, number>>;
  readonly firstTick: Readonly<Record<string, number>>;
  /** A blocked tick → the grace tick (ms, H6). */
  readonly graceMs: number;
  /** From the crash (the second blocked tick) to the game-over screen (H11). */
  readonly death: readonly DeathStep[];
  /** A new top score's game-over screen comes this much later (the score is written first). */
  readonly topScoreMs: number;
}

export function extractSnakeResources(
  golden: (id: string) => Golden,
  tickGolden: (id: string) => TickGolden,
): SnakeResourceData {
  const sprites: Record<string, readonly string[]> = {};
  for (const c of SNAKE_CROPS) {
    if (sprites[c.id]) throw new Error(`snake sprite "${c.id}" is listed twice`);
    const pixels = findGoldenImage(golden(c.golden), c.image).pixels;
    const art = crop(pixels, c.x, c.y, c.width, c.height);
    if (!art.some((row) => row.includes("#"))) {
      throw new Error(`snake sprite "${c.id}": no ink in ${c.golden} image "${c.image}"`);
    }
    sprites[c.id] = art;
  }

  const mazes = Array.from({ length: 6 }, (_, m) => {
    const id = `game/snake/maze-${m}`;
    const g = golden(id);
    const trigger = g.triggerFrame;
    if (typeof trigger !== "number") throw new Error(`${id}: no New game frame`);
    return extractMaze(findGoldenImage(g, g.timeline![trigger]!.image).pixels, id);
  });

  const periods: Record<string, number> = {};
  const firstTick: Record<string, number> = {};
  for (let level = 1; level <= 9; level++) {
    const { firstMs, periodMs } = timelinePeriod(golden(`game/snake/ticks-l${level}`), level);
    periods[level] = periodMs;
    firstTick[level] = firstMs;
  }
  for (const row of tickGolden("game/snake/periods").rows) {
    periods[row.level] = median(row.intervalsMs);
    firstTick[row.level] = row.firstMs;
  }
  for (let level = 1; level <= 175; level++) {
    if (!(periods[level]! > 0) || !(firstTick[level]! > 0)) {
      throw new Error(`level ${level}: no positive period and first tick`);
    }
  }

  const graceTicks = ticksOf(golden(GRACE_GOLDEN.id), GRACE_GOLDEN.level);
  const blocked = graceTicks.findIndex((tick) => tick.virtual);
  const after = graceTicks[blocked + 1];
  if (blocked < 0 || !after) throw new Error(`${GRACE_GOLDEN.id}: no blocked tick`);
  const graceMs = Math.round(after.startMs - graceTicks[blocked]!.startMs);

  const blinks = DEATH_GOLDENS.map((id) => {
    const steps = blinkOf(golden(id));
    if (!steps) throw new Error(`${id}: no death blink before the game-over screen`);
    return steps;
  });
  const pattern = (steps: readonly DeathStep[]) => steps.map((s) => s.visible).join();
  blinks.forEach((steps, i) => {
    if (pattern(steps) !== pattern(blinks[0]!)) {
      throw new Error(`${DEATH_GOLDENS[i]}: the blink differs from ${DEATH_GOLDENS[0]}'s`);
    }
  });
  const death = blinks[0]!.map((step, j) => ({
    visible: step.visible,
    durationMs: median(blinks.map((steps) => steps[j]!.durationMs)),
  }));

  // The one blinking death with a new top score (virgin-game, 175) holds its last step longer
  // than the others: the fireworks wait for the top score to be written.
  const topScoreSteps = blinks[DEATH_GOLDENS.indexOf(TOP_SCORE_DEATH)]!;
  const topScoreMs = topScoreSteps.at(-1)!.durationMs - death.at(-1)!.durationMs;
  if (!(topScoreMs > 0)) throw new Error(`${TOP_SCORE_DEATH}: no top-score delay`);

  return { sprites, mazes, periods, firstTick, graceMs, death, topScoreMs };
}
