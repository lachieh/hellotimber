// Snake II random numbers (plan 23 Task 5, D4, H8, H9, H12): the generator, food and creature
// placement on synthetic boards, and the seed of every gameplay golden.
import { describe, expect, it } from "vite-plus/test";
import { replaySeed, searchSeeds } from "../scripts/snake-seeds.ts";
import {
  createSnakeRandom,
  placeCreature,
  placeFood,
  type Cell,
  type RandomSource,
} from "../src/games/snake/rng";
import { seedFromClock } from "../src/games/snake/seed";
import { goldenPlacements } from "./support/snake-decode";

/** Draws the given values in order, then fails. */
function draws(values: readonly number[]): RandomSource & { readonly used: () => number } {
  let i = 0;
  return {
    next: () => {
      if (i >= values.length) throw new Error(`draw ${i + 1}: only ${values.length} scripted`);
      return values[i++]!;
    },
    used: () => i,
  };
}

const free = (taken: readonly Cell[] = []) => {
  const set = new Set(taken.map((c) => `${c.x},${c.y}`));
  return (x: number, y: number) => !set.has(`${x},${y}`);
};

describe("the generator (H12)", () => {
  it("steps seed = (seed × 0x625f + 0x3623) mod 0xfff1", () => {
    const rng = createSnakeRandom(1);
    expect([rng.next(), rng.next()]).toEqual([39042, (39042 * 0x625f + 0x3623) % 0xfff1]);
    expect(rng.seed).toBe((39042 * 0x625f + 0x3623) % 0xfff1);
  });

  it("puts the 10:10 game's first food at (14, 8): x from the first draw, y from the second", () => {
    const rng = createSnakeRandom(44530);
    expect(placeFood(rng, free(), [])).toEqual({ x: 14, y: 8 });
  });

  it("rejects seeds outside 0..65520", () => {
    expect(() => createSnakeRandom(65521)).toThrow();
    expect(() => createSnakeRandom(-1)).toThrow();
    expect(() => createSnakeRandom(1.5)).toThrow();
  });
});

describe("placeFood (H8)", () => {
  it("draws x mod 20, then y mod 9", () => {
    expect(placeFood(draws([34, 17]), free(), [])).toEqual({ x: 14, y: 8 });
  });

  it("retries a taken cell", () => {
    const rng = draws([14, 8, 3, 4]);
    expect(placeFood(rng, free([{ x: 14, y: 8 }]), [])).toEqual({ x: 3, y: 4 });
    expect(rng.used()).toBe(4);
  });

  it("keeps out of a creature's rows and columns", () => {
    const creature = [
      { x: 5, y: 2 },
      { x: 6, y: 2 },
    ];
    expect(placeFood(draws([5, 7, 9, 2, 9, 3]), free(), creature)).toEqual({ x: 9, y: 3 });
  });

  it("after 100 failed tries takes the first free cell row by row, ignoring the creature", () => {
    const rng = draws(Array.from({ length: 200 }, () => 0));
    const taken = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    expect(placeFood(rng, free(taken), [{ x: 3, y: 5 }])).toEqual({ x: 3, y: 0 });
    expect(rng.used()).toBe(200);
  });

  it("finds nothing on a full board", () => {
    const rng = draws(Array.from({ length: 200 }, () => 0));
    expect(placeFood(rng, () => false, [])).toBeUndefined();
  });
});

describe("placeCreature (H9)", () => {
  it("draws the large-creature choice, then x mod 19 and y mod 9, then the kind mod 6", () => {
    const rng = draws([1, 25, 13, 11]);
    expect(placeCreature(rng, free(), undefined, true)).toEqual({
      placed: true,
      kind: 5,
      cells: [
        { x: 6, y: 4 },
        { x: 7, y: 4 },
      ],
    });
    expect(rng.used()).toBe(4);
  });

  it("needs both cells free and clear of the food's row and column", () => {
    const food = { x: 7, y: 0 };
    // (6, 4): column 7 is the food's; (1, 0): row 0 is; (2, 3): (3, 3) is taken; then (10, 6).
    const rng = draws([1, 6, 4, 1, 0, 2, 3, 10, 6, 2]);
    expect(placeCreature(rng, free([{ x: 3, y: 3 }]), food, true)).toEqual({
      placed: true,
      kind: 2,
      cells: [
        { x: 10, y: 6 },
        { x: 11, y: 6 },
      ],
    });
  });

  it("tries the 2x2 creature on a draw ≡ 0 mod 50 when allowed: x mod 19, y mod 8, no kind", () => {
    const rng = draws([100, 17, 10]);
    expect(placeCreature(rng, free(), undefined, true)).toEqual({
      placed: true,
      kind: "large",
      cells: [
        { x: 17, y: 2 },
        { x: 18, y: 2 },
        { x: 17, y: 3 },
        { x: 18, y: 3 },
      ],
    });
    expect(rng.used()).toBe(3);
  });

  it("places a small creature on a draw ≡ 0 mod 50 when the large one is not allowed", () => {
    const rng = draws([100, 1, 1, 0]);
    expect(placeCreature(rng, free(), undefined, false).kind).toBe(0);
  });

  it("fails after 100 tries, keeping the last try's cells, and still draws the kind (RE, UNVERIFIED)", () => {
    const rng = draws([1, ...Array.from({ length: 200 }, () => 0), 9]);
    expect(placeCreature(rng, () => false, undefined, true)).toEqual({
      placed: false,
      kind: 3,
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    });
    expect(rng.used()).toBe(202);
  });
});

/**
 * Every gameplay golden that starts at New game, with its recording's seeds: exactly one seed
 * where three or more placements decide it (two for seed-0759 and creature-0914), else (the
 * timelines, one or two placements) the clock's seed among the ones that fit. The C7 key
 * probes hold no New game board.
 */
const SEEDS: readonly { id: string; maze?: number; seeds: readonly number[]; exact: boolean }[] = [
  { id: "bot-long", seeds: [44530], exact: true },
  { id: "bot-short", seeds: [44530], exact: true },
  { id: "bot-maze2", maze: 2, seeds: [44530], exact: true },
  { id: "bot-maze3", maze: 3, seeds: [44530], exact: true },
  { id: "bot-grace", seeds: [44530], exact: true },
  { id: "pause-bot", seeds: [44530], exact: true },
  { id: "score-8", seeds: [44530], exact: true },
  { id: "seed-1010", seeds: [44530], exact: true },
  { id: "seed-1010-second", seeds: [44530], exact: true },
  { id: "seed-1011", seeds: [44590], exact: true },
  { id: "seed-1200", seeds: [51130], exact: true },
  { id: "seed-1948", seeds: [13689], exact: true },
  { id: "seed-0759", seeds: [36670, 60943], exact: true },
  { id: "seed-2359", seeds: [38909], exact: true },
  { id: "seed-0000", seeds: [7995], exact: true },
  { id: "seed-0001", seeds: [7995], exact: true },
  { id: "seed-1010-14102026", seeds: [10048], exact: true },
  { id: "creature-0914", seeds: [5371, 41170], exact: true },
  { id: "creature-0956", seeds: [43690], exact: true },
  { id: "creature-1007", seeds: [44350], exact: true },
  { id: "creature-1021", seeds: [45190], exact: true },
  { id: "creature-1035", seeds: [46030], exact: true },
  { id: "creature-1107", seeds: [47950], exact: true },
  { id: "creature-1221", seeds: [52390], exact: true },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => ({ id: `ticks-l${l}`, seeds: [44530], exact: false })),
  ...[0, 1, 2, 3, 4, 5].map((m) => ({ id: `maze-${m}`, maze: m, seeds: [44530], exact: false })),
  { id: "virgin-meal", seeds: [44530], exact: false },
  { id: "virgin-game", maze: 1, seeds: [44530], exact: false },
];

describe("the seed of every gameplay golden (D4)", () => {
  for (const { id, maze, seeds, exact } of SEEDS) {
    it(`${id}: ${exact ? "exactly" : "among the fits:"} ${seeds.join(", ")}`, () => {
      const placements = goldenPlacements(`game/snake/${id}`, maze);
      expect(placements.length, "placements").toBeGreaterThan(0);
      const found = searchSeeds(placements);
      if (exact) expect(found).toEqual(seeds);
      else for (const seed of seeds) expect(found).toContain(seed);
    });
  }

  it("decides the seed where placements are plenty: dozens in the long game", () => {
    expect(goldenPlacements("game/snake/bot-long").length).toBeGreaterThanOrEqual(36);
  });

  it("reseeds at New game: the second game of a power cycle draws the first game's placements", () => {
    const first = goldenPlacements("game/snake/seed-1010");
    const second = goldenPlacements("game/snake/seed-1010-second");
    expect(searchSeeds(second)).toEqual(searchSeeds(first));
    // Not a continuation: the generator as the first game left it does not draw the second's.
    const after = replaySeed(44530, first);
    expect(after).toBeDefined();
    expect(replaySeed(after!, second)).toBeUndefined();
  });

  it("does not reseed at Continue: pause-bot's placements run on from its New game's seed", () => {
    // pause-bot suspends after tick 3, before any meal, and its placements across Continue
    // reproduce from the 10:10 seed as one sequence (Task 0: Continue does not reseed).
    const placements = goldenPlacements("game/snake/pause-bot");
    expect(placements.length).toBeGreaterThanOrEqual(4);
    expect(searchSeeds(placements)).toContain(44530);
  });
});

describe("seedFromClock (D4 fallback)", () => {
  // No function of the clock and date fits every C9 seed (see the Task 5 deviation in plan 23):
  // (seconds of the day + 7930) mod 65521 fits the clocks from 07:59 to 19:48 on 13.10.2026,
  // 23:59 and 14.10.2026 fit it only with a 32-bit overflow term whose epoch the data leave
  // open, and 00:00 and 00:01 draw the same seed. The stock phone therefore seeds from the
  // minutes of the day (UNVERIFIED) and tests inject the recovered seeds.
  it("uses the minutes of the day (UNVERIFIED fallback; no clock function fits every C9 seed)", () => {
    expect(seedFromClock("10:10")).toBe(610);
    expect(seedFromClock("00:00")).toBe(0);
    expect(seedFromClock("23:59")).toBe(1439);
    expect(seedFromClock("7:05")).toBe(425);
  });

  it("leaves the seed alone when the clock is not set", () => {
    expect(seedFromClock(undefined)).toBeUndefined();
    expect(seedFromClock("")).toBeUndefined();
    expect(seedFromClock("25:00")).toBeUndefined();
  });

  it("records the evidence: (seconds + 7930) mod 65521 fits only the 07:59-19:48 clocks of 13.10.2026", () => {
    const clocks: readonly [string, string, boolean][] = [
      ["seed-0759", "07:59", true],
      ["seed-1010", "10:10", true],
      ["seed-1011", "10:11", true],
      ["seed-1200", "12:00", true],
      ["seed-1948", "19:48", true],
      ["seed-0000", "00:00", false],
      ["seed-0001", "00:01", false],
      ["seed-2359", "23:59", false],
      ["seed-1010-14102026", "10:10", false],
    ];
    for (const [id, clock, fits] of clocks) {
      const [h, m] = clock.split(":").map(Number);
      const candidate = (h! * 3600 + m! * 60 + 7930) % 65521;
      const found = searchSeeds(goldenPlacements(`game/snake/${id}`));
      expect(found.includes(candidate), `${id} (${clock})`).toBe(fits);
    }
  });
});
