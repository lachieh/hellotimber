// The games' random numbers (plan 24 D5): one generator, `game_rand16` of the RE notes, that
// Snake II, Space impact and Pairs II draw from, one chain per game from the seed New game
// writes. Pure: no time, no I/O.

/** seed = (seed × 0x625f + 0x3623) mod 0xfff1 (plan 23 H12). */
export const GAME_RANDOM_MODULUS = 0xfff1;
const MULTIPLIER = 0x625f;
const INCREMENT = 0x3623;
const U32 = 2 ** 32;

/** A source of 16-bit draws (the placement helpers take any, tests script them). */
export interface RandomSource {
  /** The next draw, 0..0xfff0. */
  next(): number;
}

export interface GameRandom extends RandomSource {
  /** The u32 seed before the first draw, then the last draw. */
  readonly state: number;
}

/**
 * The generator from the u32 New game writes (Task 0 S7: `0x10da5c`). Its first step runs in
 * 32-bit wrapping arithmetic, so a seed above 2^32 / 0x625f overflows there (the 10160 shift
 * plan 23 found at 23:59 and on 14.10.2026); every later state is below the modulus.
 */
export function createGameRandom(seedU32: number): GameRandom {
  if (!Number.isInteger(seedU32) || seedU32 < 0 || seedU32 >= U32) {
    throw new Error(`Game seed ${seedU32} is not a u32 integer.`);
  }
  let state = seedU32;
  return {
    get state() {
      return state;
    },
    next() {
      // Below 2^53: a u32 times 0x625f is exact in a double.
      state = ((state * MULTIPLIER + INCREMENT) % U32) % GAME_RANDOM_MODULUS;
      return state;
    },
  };
}

export interface AnsiRandom {
  next(): number;
  readonly state: number;
}

/** Phone-wide ANSI rand, fitted to plan 24 S8's twelve LCD spawn rows. */
export function createAnsiRandom(seedU32 = 0x7fffffff): AnsiRandom {
  if (!Number.isInteger(seedU32) || seedU32 < 0 || seedU32 >= U32) {
    throw new Error(`ANSI seed ${seedU32} is not a u32 integer.`);
  }
  let state = seedU32;
  return {
    get state() {
      return state;
    },
    next() {
      state = (Math.imul(state, 1103515245) + 12345) >>> 0;
      return (state >>> 16) & 0x7fff;
    },
  };
}
