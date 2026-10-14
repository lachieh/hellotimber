// Reads a Snake II screen back into cells (plan 23 D5.3): the snake's segments and head, the
// food, the creature, the score and the countdown, by matching the Task 4 sprites cell by cell.
// Anything it cannot match throws, naming the cell. Also turns a gameplay golden into the
// placement sequence the seed search replays (Task 5).
import { findGoldenImage, LCD_WIDTH, type Golden } from "../../scripts/golden-format.ts";
import { framePeriod, isBoardFrame, numberTicks } from "../../scripts/game-capture-set.ts";
import type { SeedPlacement } from "../../scripts/snake-seeds.ts";
import type { Cell, CreatureKind } from "../../src/games/snake/rng";
import {
  SNAKE_MAZES,
  SNAKE_SPRITE_IDS,
  SNAKE_SPRITES,
  type SnakeHeading,
  type SnakeMaze,
  type SnakeSpriteId,
} from "../../src/resources";
import { loadGolden } from "./goldens";

export interface DecodedSegment extends Cell {
  /** Every snake picture the cell's ink equals (the fat straights coincide in pairs). */
  readonly pictures: readonly SnakeSpriteId[];
}

export interface DecodedBoard {
  readonly score: number;
  /** The creature countdown, shown while a creature is out. */
  readonly countdown?: number;
  readonly head?: Cell & { readonly heading: SnakeHeading; readonly open: boolean };
  /** Snake cells, row by row; empty while the death blink hides the snake. */
  readonly segments: readonly DecodedSegment[];
  readonly food?: Cell;
  readonly creature?: { readonly kind: CreatureKind; readonly cells: readonly Cell[] };
}

const W = 20;
const H = 9;

function art(pixels: Uint8Array, left: number, top: number, width: number, height: number) {
  let out = "";
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) out += pixels[y * LCD_WIDTH + x] ? "#" : ".";
  }
  return out;
}

const spriteArt = (id: SnakeSpriteId) =>
  Array.from(SNAKE_SPRITES[id].pixels, (p) => (p ? "#" : ".")).join("");

const byArt = (ids: readonly SnakeSpriteId[]) => {
  const map = new Map<string, SnakeSpriteId[]>();
  for (const id of ids) map.set(spriteArt(id), [...(map.get(spriteArt(id)) ?? []), id]);
  return map;
};

const CELL_PICTURES = byArt(
  SNAKE_SPRITE_IDS.filter((id) =>
    /^(head|head-open|tail|body|body-fat|corner|corner-fat)\//.test(id),
  ),
);
const FOOD = spriteArt("food");
const DIGITS = byArt(SNAKE_SPRITE_IDS.filter((id) => id.startsWith("digit/")));
const CREATURES = byArt(SNAKE_SPRITE_IDS.filter((id) => id.startsWith("creature/")));
const LARGE = byArt(["large/1", "large/2"]);
const ICONS = byArt(
  SNAKE_SPRITE_IDS.filter((id) => id.startsWith("creature-icon/") || id.startsWith("large-icon/")),
);

const cellLeft = (x: number) => 2 + 4 * x;
const cellTop = (y: number) => 10 + 4 * y;
const EMPTY = ".".repeat(16);

function digitAt(pixels: Uint8Array, left: number, where: string): number {
  const id = DIGITS.get(art(pixels, left, 0, 4, 5))?.[0];
  if (id === undefined) throw new Error(`${where}: no HUD digit at x ${left}`);
  return Number(id.slice("digit/".length));
}

/** The wall cells of `maze` and the ink each shows (2-px lines through the cell centres). */
function wallArt(maze: SnakeMaze | undefined): Map<string, string> {
  const pixels = new Uint8Array(LCD_WIDTH * 48);
  const cells = new Set<string>();
  for (const { x1, y1, x2, y2 } of maze?.walls ?? []) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) cells.add(`${x},${y}`);
    }
    for (let y = cellTop(Math.min(y1, y2)) + 1; y <= cellTop(Math.max(y1, y2)) + 2; y++) {
      for (let x = cellLeft(Math.min(x1, x2)) + 1; x <= cellLeft(Math.max(x1, x2)) + 2; x++) {
        pixels[y * LCD_WIDTH + x] = 1;
      }
    }
  }
  return new Map(
    [...cells].map((c) => {
      const [x, y] = c.split(",").map(Number);
      return [c, art(pixels, cellLeft(x!), cellTop(y!), 4, 4)];
    }),
  );
}

/** Decodes one Snake II screen; `maze` names the walls the board shows (none by default). */
export function decodeBoard(pixels: Uint8Array, maze?: SnakeMaze, where = "board"): DecodedBoard {
  if (!isBoardFrame(pixels)) throw new Error(`${where}: not the Snake II board`);
  const score = [0, 4, 8, 12].reduce((n, left) => n * 10 + digitAt(pixels, left, where), 0);

  let countdown: number | undefined;
  if (art(pixels, 64, 0, 20, 6).includes("#")) {
    if (!ICONS.has(art(pixels, 66, 1, 8, 4)))
      throw new Error(`${where}: no creature icon in the HUD`);
    countdown = digitAt(pixels, 75, where) * 10 + digitAt(pixels, 79, where);
  }

  const walls = wallArt(maze);
  const done = new Set<string>();
  for (const [cell, ink] of walls) {
    const [x, y] = cell.split(",").map(Number);
    if (art(pixels, cellLeft(x!), cellTop(y!), 4, 4) !== ink) {
      throw new Error(`${where}: wall cell (${x}, ${y}) is not drawn as the maze's wall`);
    }
    done.add(cell);
  }

  let creature: DecodedBoard["creature"];
  for (let y = 0; y < H && !creature; y++) {
    for (let x = 0; x < W - 1 && !creature; x++) {
      const large = y < H - 1 && LARGE.get(art(pixels, cellLeft(x), cellTop(y), 8, 8));
      const small = CREATURES.get(art(pixels, cellLeft(x), cellTop(y), 8, 4));
      if (large) {
        creature = {
          kind: "large",
          cells: [
            { x, y },
            { x: x + 1, y },
            { x, y: y + 1 },
            { x: x + 1, y: y + 1 },
          ],
        };
      } else if (small) {
        const kind = Number(small[0]!.slice("creature/".length)) as CreatureKind;
        creature = {
          kind,
          cells: [
            { x, y },
            { x: x + 1, y },
          ],
        };
      }
    }
  }
  for (const c of creature?.cells ?? []) done.add(`${c.x},${c.y}`);

  let food: Cell | undefined;
  const segments: DecodedSegment[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (done.has(`${x},${y}`)) continue;
      const ink = art(pixels, cellLeft(x), cellTop(y), 4, 4);
      if (ink === EMPTY) continue;
      if (ink === FOOD) {
        if (food) throw new Error(`${where}: food at (${food.x}, ${food.y}) and (${x}, ${y})`);
        food = { x, y };
        continue;
      }
      const pictures = CELL_PICTURES.get(ink);
      if (!pictures) throw new Error(`${where}: cannot read cell (${x}, ${y}): ${ink}`);
      segments.push({ x, y, pictures });
    }
  }

  const heads = segments.filter((s) => s.pictures.some((p) => p.startsWith("head")));
  if (heads.length > 1) throw new Error(`${where}: ${heads.length} heads`);
  if (heads.length === 0 && segments.length > 0)
    throw new Error(`${where}: a snake without a head`);
  const head = heads[0];
  const headPicture = head?.pictures[0];
  return {
    score,
    ...(countdown === undefined ? {} : { countdown }),
    ...(head && headPicture
      ? {
          head: {
            x: head.x,
            y: head.y,
            heading: headPicture.split("/")[1] as SnakeHeading,
            open: headPicture.startsWith("head-open/"),
          },
        }
      : {}),
    segments,
    ...(food ? { food } : {}),
    ...(creature ? { creature } : {}),
  };
}

export interface TickBoard {
  readonly tick: number;
  readonly board: DecodedBoard;
  /** The golden's pixels for the board, and where they come from (for messages). */
  readonly pixels: Uint8Array;
  readonly where: string;
}

/**
 * A gameplay golden's boards in tick order: a tick-stills golden's images (`t<tick>`), or a
 * timeline's engine ticks (their finished frames) up to the first board without the snake.
 */
export function goldenBoards(id: string, maze?: SnakeMaze): TickBoard[] {
  const golden: Golden = loadGolden(id);
  if (!golden.timeline) {
    return golden.images.map((image) => {
      if (!/^t\d{4}$/.test(image.name)) throw new Error(`${id}: image ${image.name} is not a tick`);
      const where = `${id} ${image.name}`;
      return {
        tick: Number(image.name.slice(1)),
        board: decodeBoard(image.pixels, maze, where),
        pixels: image.pixels,
        where,
      };
    });
  }
  const frames = golden.timeline.map((row, i) => ({
    pixels: findGoldenImage(golden, row.image).pixels,
    startMs: row.startMs,
    durationMs: row.durationMs,
    dir: id,
    frame: i,
  }));
  const boards: TickBoard[] = [];
  for (const tick of numberTicks(frames, framePeriod(frames))) {
    if (tick.virtual) continue;
    const where = `${id} frame ${tick.last!.frame}`;
    const board = decodeBoard(tick.last!.pixels, maze, where);
    if (board.segments.length === 0) break;
    boards.push({ tick: tick.tick, board, pixels: tick.last!.pixels, where });
  }
  return boards;
}

const sameCells = (a: readonly Cell[] | undefined, b: readonly Cell[] | undefined) =>
  a !== undefined &&
  b !== undefined &&
  a.map((c) => `${c.x},${c.y}`).join() === b.map((c) => `${c.x},${c.y}`).join();

/**
 * The food and creature placements a golden shows, in order: the New game food, then on each
 * board whose food moved (a meal) the new food, and on each board with a creature the previous
 * board lacked, the creature (spawned after that tick's food). The board right after a
 * placement holds the snake it was placed around.
 */
export function goldenPlacements(id: string, mazeIndex?: number): SeedPlacement[] {
  const maze = mazeIndex === undefined ? undefined : SNAKE_MAZES[mazeIndex];
  const boards = goldenBoards(id, maze);
  if (boards[0]?.tick !== 0) throw new Error(`${id}: no New game board (tick 0)`);
  const walls: Cell[] = [];
  for (const { x1, y1, x2, y2 } of maze?.walls ?? []) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) walls.push({ x, y });
    }
  }
  const taken = (board: DecodedBoard): Cell[] => [
    ...walls,
    ...board.segments.map(({ x, y }) => ({ x, y })),
  ];
  const first = boards[0]!.board;
  const placements: SeedPlacement[] = [
    { kind: "food", tick: 0, cell: first.food, taken: taken(first), creature: [] },
  ];
  for (let i = 1; i < boards.length; i++) {
    const before = boards[i - 1]!.board;
    const { tick, board } = boards[i]!;
    const stayed = sameCells(before.creature?.cells, board.creature?.cells);
    if (board.food?.x !== before.food?.x || board.food?.y !== before.food?.y) {
      placements.push({
        kind: "food",
        tick,
        cell: board.food,
        taken: taken(board),
        creature: stayed ? board.creature!.cells : [],
      });
    }
    if (board.creature && !stayed) {
      placements.push({
        kind: "creature",
        tick,
        creatureKind: board.creature.kind,
        cells: board.creature.cells,
        taken: taken(board),
        food: board.food,
      });
    }
  }
  return placements;
}
