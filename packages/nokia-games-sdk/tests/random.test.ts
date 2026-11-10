import { describe, expect, it } from "vite-plus/test";
import { createRandom, mixSeed } from "../src/index";

describe("createRandom", () => {
  // The reference mulberry32 (Tommy Ettinger's, as published in bryc's PRNG notes), before its
  // division by 2^32: seed 1 starts 0.6270739405881613.
  it.each([
    [1, [2693262067, 11749833, 2265367787, 4213581821]],
    [44530, [2864486351, 2488426969, 3681474832, 635350249]],
  ])("is mulberry32 for seed %i", (seed, expected) => {
    const random = createRandom(seed);
    expect(expected.map(() => random())).toEqual(expected);
  });

  it("returns uint32 values", () => {
    const random = createRandom(0xdeadbeef);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(Number.isInteger(value) && value >= 0 && value <= 0xffffffff).toBe(true);
    }
  });

  it("reads the seed as a uint32", () => {
    const sequence = (seed: number) => {
      const random = createRandom(seed);
      return [random(), random(), random()];
    };
    expect(sequence(-1)).toEqual(sequence(0xffffffff));
    expect(sequence(2 ** 32 + 7)).toEqual(sequence(7));
    expect(sequence(7)).not.toEqual(sequence(8));
  });

  it("gives each generator its own state", () => {
    const a = createRandom(5);
    const b = createRandom(5);
    a();
    expect(a()).not.toBe(b());
  });
});

describe("mixSeed", () => {
  it("is a deterministic uint32", () => {
    for (const [a, b] of [
      [0, 0],
      [1, 2],
      [0xffffffff, 0xffffffff],
      [44530, 7],
    ] as const) {
      const mixed = mixSeed(a, b);
      expect(mixed).toBe(mixSeed(a, b));
      expect(Number.isInteger(mixed) && mixed >= 0 && mixed <= 0xffffffff).toBe(true);
    }
  });

  it("is sensitive to both inputs and to their order", () => {
    const seen = new Set<number>();
    for (let a = 0; a < 32; a++) for (let b = 0; b < 32; b++) seen.add(mixSeed(a, b));
    expect(seen.size).toBe(32 * 32);
    expect(mixSeed(1, 2)).not.toBe(mixSeed(2, 1));
  });

  it("spreads neighbouring inputs across the range", () => {
    // Consecutive session counters must not give consecutive seeds.
    const high = new Set<number>();
    for (let b = 0; b < 64; b++) high.add(mixSeed(44530, b) >>> 26);
    expect(high.size).toBeGreaterThan(32);
  });

  it("keeps its published values", () => {
    expect([mixSeed(0, 0), mixSeed(1, 2), mixSeed(44530, 7)]).toEqual([
      2462723854, 4225345079, 366386766,
    ]);
  });
});
