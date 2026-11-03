// Paints the Snake II board from the engine's render model (plan 23 Task 8), with the pictures
// cropped from the gameplay goldens (src/kit/ui/resources). Geometry (H1): cell (x, y) has its top-left
// pixel at (2 + 4x, 10 + 4y).
import type { Framebuffer } from "@hellotimber/phone-screen";
import { SNAKE_MAZES, SNAKE_SPRITES, type SnakeSpriteId } from "../../resources";

/** A board cell: x 0..19, y 0..8. */
export interface Cell {
  readonly x: number;
  readonly y: number;
}

export type CreatureKind = 0 | 1 | 2 | 3 | 4 | 5 | "large";

/** A direction of travel. */
export type Heading = "right" | "left" | "up" | "down";

/** A corner by the two cell edges it joins (`up-left`: in from the top, out to the left). */
export type Corner = "up-left" | "up-right" | "down-left" | "down-right";

/**
 * A segment's picture, named as the stock sprites are: heads (mouth closed or open) by heading,
 * tails by the way to the next segment, straights by heading, corners by their edges, and the
 * fat ones drawn where the snake ate.
 */
export type SegmentPicture =
  | `head/${Heading}`
  | `head-open/${Heading}`
  | `tail/${Heading}`
  | `body/${Heading}`
  | `body-fat/${Heading}`
  | `corner/${Corner}`
  | `corner-fat/${Corner}`;

export interface Segment extends Cell {
  /** The heading of the step that reached this cell. */
  readonly heading: Heading;
  readonly picture: SegmentPicture;
}

export interface SnakeRenderModel {
  readonly maze: number;
  /** Empty while the death blink hides the snake. */
  readonly segments: readonly Segment[];
  readonly food?: Cell;
  readonly creature?: {
    readonly kind: CreatureKind;
    readonly cells: readonly Cell[];
    readonly frame: 1 | 2;
  };
  /** The low 16 bits of the score (H16). */
  readonly score: number;
  /** The creature's steps left, shown beside its HUD icon while it is out. */
  readonly countdown?: number;
}

/** The game screen: the board the engine rendered. */
export interface SnakeModel {
  readonly kind: "snake";
  readonly board: SnakeRenderModel;
}

const cellLeft = (x: number) => 2 + 4 * x;
const cellTop = (y: number) => 10 + 4 * y;

/** HUD: the score's four digits at x 0, 4, 8, 12; the creature icon at (66, 1) and its
 * countdown's two digits at x 75 and 79, all from the top row. */
const SCORE_DIGITS_X = [0, 4, 8, 12] as const;
const ICON = { x: 66, y: 1 } as const;
const COUNTDOWN_DIGITS_X = [75, 79] as const;

function blit(fb: Framebuffer, id: SnakeSpriteId, x: number, y: number): void {
  fb.blitBitmap(SNAKE_SPRITES[id], x, y);
}

function digits(fb: Framebuffer, value: number, xs: readonly number[]): void {
  xs.forEach((x, i) => {
    const digit = Math.floor(value / 10 ** (xs.length - 1 - i)) % 10;
    blit(fb, `digit/${digit}` as SnakeSpriteId, x, 0);
  });
}

export function paintSnake(fb: Framebuffer, { board }: SnakeModel): void {
  const { width, height } = fb;
  // The HUD's double rule (y 6 and 8) and the board's frame (x 0 and 83 from y 8, row 47).
  fb.fillRect(0, 6, width, 1);
  fb.fillRect(0, 8, width, 1);
  fb.fillRect(0, height - 1, width, 1);
  fb.fillRect(0, 8, 1, height - 8);
  fb.fillRect(width - 1, 8, 1, height - 8);
  digits(fb, board.score, SCORE_DIGITS_X);

  // Walls: 2-px lines from cell centre to cell centre.
  const maze = SNAKE_MAZES[board.maze];
  if (maze === undefined) throw new Error(`No Snake II maze ${board.maze}.`);
  for (const { x1, y1, x2, y2 } of maze.walls) {
    const left = cellLeft(Math.min(x1, x2)) + 1;
    const top = cellTop(Math.min(y1, y2)) + 1;
    fb.fillRect(
      left,
      top,
      cellLeft(Math.max(x1, x2)) + 3 - left,
      cellTop(Math.max(y1, y2)) + 3 - top,
    );
  }

  for (const segment of board.segments) {
    blit(fb, segment.picture, cellLeft(segment.x), cellTop(segment.y));
  }
  if (board.food) blit(fb, "food", cellLeft(board.food.x), cellTop(board.food.y));

  const creature = board.creature;
  if (creature) {
    const [first] = creature.cells;
    const large = creature.kind === "large";
    blit(
      fb,
      large ? `large/${creature.frame}` : `creature/${creature.kind}`,
      cellLeft(first!.x),
      cellTop(first!.y),
    );
    blit(
      fb,
      large ? `large-icon/${creature.frame}` : `creature-icon/${creature.kind}`,
      ICON.x,
      ICON.y,
    );
    digits(fb, board.countdown ?? 0, COUNTDOWN_DIGITS_X);
  }
}
