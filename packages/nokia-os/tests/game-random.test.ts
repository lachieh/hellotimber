// The games' shared random numbers (plan 24 D5): the generator every game draws from, its u32
// seed state, and the seed New game takes from the clock.
import { describe, expect, it } from "vite-plus/test";
import { searchSeeds } from "../scripts/snake-seeds.ts";
import { createGameRandom, GAME_RANDOM_MODULUS } from "../src/games/random";
import { gameSeed } from "../src/games/seed";
import { goldenPlacements } from "./support/snake-decode";

const step = (seed: number) => (seed * 0x625f + 0x3623) % GAME_RANDOM_MODULUS;

/**
 * The u32 New game writes at 0x10da5c (plan 24 Task 0 S7, RAM peeks: a cross-check, never the
 * proof) for the clocks of Snake II's seed goldens (plan 23 C9), all on 13.10.2026 unless named.
 */
const NEW_GAME_U32: readonly { golden: string; clock: string; u32: number }[] = [
  { golden: "seed-0759", clock: "07:59", u32: 0xd4536ec4 },
  { golden: "seed-1010", clock: "10:10", u32: 0xd4538d78 },
  { golden: "seed-1011", clock: "10:11", u32: 0xd4538db4 },
  { golden: "seed-1200", clock: "12:00", u32: 0xd453a740 },
  { golden: "seed-1948", clock: "19:48", u32: 0xd45414f0 },
  { golden: "seed-2359", clock: "23:59", u32: 0xd4544fc4 },
  { golden: "seed-0000", clock: "00:00", u32: 0xd452fec1 },
  { golden: "seed-0001", clock: "00:01", u32: 0xd452fec1 },
  { golden: "seed-1010-14102026", clock: "10:10 14.10.2026", u32: 0xd454def8 },
];

describe("createGameRandom (D5)", () => {
  it("steps Snake II's generator for seeds below 0xfff1", () => {
    const rng = createGameRandom(1);
    expect([rng.next(), rng.next()]).toEqual([39042, step(39042)]);
    expect(rng.state).toBe(step(39042));
    const snake = createGameRandom(44530);
    expect(snake.state).toBe(44530);
    expect(snake.next()).toBe(step(44530));
  });

  it("takes a u32 seed's first step in 32-bit wrapping arithmetic", () => {
    // 10:10 and 19:48 (planning investigation item 5): their first draws are those after
    // Snake II's recovered seeds 44530 and 13689.
    expect(createGameRandom(0xd4538d78).next()).toBe(step(44530));
    expect(createGameRandom(0xd45414f0).next()).toBe(step(13689));
    const rng = createGameRandom(0xd4538d78);
    rng.next();
    expect(rng.next()).toBe(step(step(44530)));
  });

  it("keeps every draw below the modulus", () => {
    const rng = createGameRandom(0xffffffff);
    for (let i = 0; i < 1000; i++) expect(rng.next()).toBeLessThan(GAME_RANDOM_MODULUS);
  });

  it("rejects seeds that are not u32 integers", () => {
    expect(() => createGameRandom(-1)).toThrow();
    expect(() => createGameRandom(2 ** 32)).toThrow();
    expect(() => createGameRandom(1.5)).toThrow();
  });

  for (const { golden, clock, u32 } of NEW_GAME_U32) {
    it(`New game's u32 at ${clock} draws the first placement draw of game/snake/${golden}`, () => {
      // The u32 explains every seed plan 23 recovered from the LCD, the 32-bit overflow of
      // 23:59 and 14.10.2026 and the shared seed of 00:00 and 00:01 included.
      const recovered = searchSeeds(goldenPlacements(`game/snake/${golden}`));
      expect(recovered.map(step)).toContain(createGameRandom(u32).next());
    });
  }
});

describe("gameSeed (D5: the minutes-of-the-day fallback stays, UNVERIFIED)", () => {
  it("records why no clock function replaces it: 00:00 and 00:01 write the same u32", () => {
    // u32 = 0xd452fe80 + seconds of the day + 86400 × days since 13.10.2026 fits every other
    // clock (the constant holds the seconds the capture spends between setting the clock and
    // New game), but 00:00 and 00:01 both write 0xd452fec1: 65 s and 5 s above it.
    const fit = (clock: string, days = 0) => {
      const [h, m] = clock.split(":").map(Number);
      return 0xd452fe80 + h! * 3600 + m! * 60 + 86400 * days;
    };
    for (const { clock, u32 } of NEW_GAME_U32) {
      const [time, date] = clock.split(" ");
      const fits = fit(time!, date === undefined ? 0 : 1) === u32;
      expect(fits, clock).toBe(!time!.startsWith("00:"));
    }
  });

  it("plan 23's evidence: (seconds + 7930) mod 65521 fits only the 07:59-19:48 clocks of 13.10.2026", () => {
    for (const { golden, clock } of NEW_GAME_U32) {
      const [h, m] = clock.split(/[: ]/).map(Number);
      const candidate = (h! * 3600 + m! * 60 + 7930) % GAME_RANDOM_MODULUS;
      const fits = !clock.includes(" ") && h! >= 7 && h! <= 19;
      expect(searchSeeds(goldenPlacements(`game/snake/${golden}`)).includes(candidate), clock).toBe(
        fits,
      );
    }
  });

  it("is the minutes of the day, below the modulus", () => {
    expect(gameSeed("10:10", "13.10.2026")).toBe(610);
    expect(gameSeed("00:00", undefined)).toBe(0);
    expect(gameSeed("23:59", "14.10.2026")).toBe(1439);
    expect(gameSeed("7:05", undefined)).toBe(425);
  });

  it("is undefined without a clock", () => {
    expect(gameSeed(undefined, "13.10.2026")).toBeUndefined();
    expect(gameSeed("", undefined)).toBeUndefined();
    expect(gameSeed("25:00", undefined)).toBeUndefined();
  });
});
