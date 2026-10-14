// The Snake II seed search (plan 23 Task 5, D4): which of the 65,521 generator states before a
// game's first draw reproduce every food and creature placement decoded from its golden. The
// placements come from tests/support/snake-decode.ts (`goldenPlacements`); the generator and
// the placement rules are the engine's own (src/games/snake/rng.ts).
import {
  createSnakeRandom,
  placeCreature,
  placeFood,
  RNG_MODULUS,
  type Cell,
  type CreatureKind,
} from "../src/games/snake/rng.ts";

/** One placement as the board showed it right after it, with the board it was made on. */
export type SeedPlacement =
  | {
      readonly kind: "food";
      readonly tick: number;
      /** Undefined: no free cell (the food hidden). */
      readonly cell: Cell | undefined;
      /** Walls and snake when the food was placed. */
      readonly taken: readonly Cell[];
      /** The cells of the creature already out (food keeps out of their rows and columns). */
      readonly creature: readonly Cell[];
    }
  | {
      readonly kind: "creature";
      readonly tick: number;
      readonly creatureKind: CreatureKind;
      readonly cells: readonly Cell[];
      readonly taken: readonly Cell[];
      /** The food just placed on the same tick. */
      readonly food: Cell | undefined;
    };

const key = (c: Cell) => `${c.x},${c.y}`;
const sameCells = (a: readonly Cell[], b: readonly Cell[]) =>
  a.length === b.length && [...a].map(key).sort().join() === [...b].map(key).sort().join();

/**
 * The generator's state after drawing `placements` from `seed`, or undefined when a placement
 * differs. The large creature is allowed (this EEPROM has its bit set, Task 0) until one is
 * eaten, which no recording does.
 */
export function replaySeed(seed: number, placements: readonly SeedPlacement[]): number | undefined {
  const rng = createSnakeRandom(seed);
  for (const p of placements) {
    const taken = new Set(p.taken.map(key));
    const free = (x: number, y: number) => !taken.has(`${x},${y}`);
    if (p.kind === "food") {
      const cell = placeFood(rng, free, p.creature);
      if (cell?.x !== p.cell?.x || cell?.y !== p.cell?.y) return undefined;
    } else {
      const placed = placeCreature(rng, free, p.food, true);
      if (!placed.placed || placed.kind !== p.creatureKind || !sameCells(placed.cells, p.cells)) {
        return undefined;
      }
    }
  }
  return rng.seed;
}

/** Every seed (0..65520, ascending) that reproduces all of `placements`. */
export function searchSeeds(placements: readonly SeedPlacement[]): number[] {
  const found: number[] = [];
  for (let seed = 0; seed < RNG_MODULUS; seed++) {
    if (replaySeed(seed, placements) !== undefined) found.push(seed);
  }
  return found;
}
