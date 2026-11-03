// Snake II's placements (plan 23 D4, H8, H9): the RE notes' rules, kept because one seed per
// recorded game reproduces every food and creature placement (tests/snake-rng.test.ts). They
// draw from the games' shared generator (`../random.ts`, plan 24 D5). Pure: no time, no I/O.
import type { Cell, CreatureKind } from "../../../ui/display/widgets/snake";
import type { RandomSource } from "../random";

export type { Cell, CreatureKind };

export const BOARD_WIDTH = 20;
export const BOARD_HEIGHT = 9;

/** Whether a cell is free of walls and snake (food and creatures do not occupy cells). */
export type CellFree = (x: number, y: number) => boolean;

const TRIES = 100;

/**
 * New food (H8): up to 100 tries of x = draw mod 20, then y = draw mod 9, on a free cell that
 * shares no row and no column with a creature cell; then the first free cell row by row,
 * without the creature test. Undefined when the board is full (the food is hidden).
 */
export function placeFood(
  rng: RandomSource,
  free: CellFree,
  creature: readonly Cell[],
): Cell | undefined {
  for (let i = 0; i < TRIES; i++) {
    const x = rng.next() % BOARD_WIDTH;
    const y = rng.next() % BOARD_HEIGHT;
    if (free(x, y) && creature.every((c) => c.x !== x && c.y !== y)) return { x, y };
  }
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) if (free(x, y)) return { x, y };
  }
  return undefined;
}

export interface CreaturePlacement {
  /** False when 100 tries found no place: the cells are the last try's (RE, UNVERIFIED). */
  readonly placed: boolean;
  readonly kind: CreatureKind;
  /** Small: (x, y), (x + 1, y). Large: (x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1). */
  readonly cells: readonly Cell[];
}

/**
 * A bonus creature (H9): a draw ≡ 0 mod 50 tries the 2x2 creature when `largeAllowed`
 * (x = draw mod 19, y = draw mod 8, no kind draw); otherwise a 2x1 creature (x = draw mod 19,
 * y = draw mod 9) whose kind is the next draw mod 6, drawn whether or not it found a place.
 * Every cell must be free and clear of the food's row and column; up to 100 tries.
 */
export function placeCreature(
  rng: RandomSource,
  free: CellFree,
  food: Cell | undefined,
  largeAllowed: boolean,
): CreaturePlacement {
  const large = rng.next() % 50 === 0 && largeAllowed;
  const clear = (cells: readonly Cell[]) =>
    cells.every((c) => free(c.x, c.y) && c.x !== food?.x && c.y !== food?.y);
  let cells: readonly Cell[] = [];
  let placed = false;
  for (let i = 0; i < TRIES && !placed; i++) {
    const x = rng.next() % (BOARD_WIDTH - 1);
    const y = rng.next() % (large ? BOARD_HEIGHT - 1 : BOARD_HEIGHT);
    cells = large
      ? [
          { x, y },
          { x: x + 1, y },
          { x, y: y + 1 },
          { x: x + 1, y: y + 1 },
        ]
      : [
          { x, y },
          { x: x + 1, y },
        ];
    placed = clear(cells);
  }
  const kind: CreatureKind = large ? "large" : ((rng.next() % 6) as CreatureKind);
  return { placed, kind, cells };
}
