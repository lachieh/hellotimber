import { describe, expect, it } from "vite-plus/test";
import { createGameRandom, GAME_RANDOM_MODULUS } from "../src/kit/apps/games/random";
import { spaceImpactBonus } from "../src/kit/apps/games/space-impact/random";
import {
  filterSpaceImpactSeedEvents,
  spaceImpactU32SeedAliases,
  searchSpaceImpactSeeds,
} from "../scripts/space-impact-seeds";
import { SPACE_IMPACT_LEVEL_OBSERVATIONS } from "../src/kit/ui/resources/generated/space-impact-levels";

const hud = { lives: 3, weapon: "missile", count: 3, score: 100 } as const;

function draws(values: readonly number[]) {
  let count = 0;
  return {
    next: () => {
      const value = values[count++];
      if (value === undefined) throw new Error("Unexpected RNG consumer");
      return value;
    },
    consumed: () => count,
  };
}

describe("Space impact bonus RNG chain", () => {
  it.each([
    [0, { ...hud, lives: 4 }],
    [1, { ...hud, count: 6 }],
    [2, { ...hud, weapon: "wall", count: 3 }],
    [3, { ...hud, weapon: "beam", count: 1 }],
  ] as const)("maps H9 result %i without another draw", (value, expected) => {
    const random = draws([value]);
    expect(spaceImpactBonus(random, hud)).toEqual(expected);
    expect(random.consumed()).toBe(1);
  });

  it.each(["missile", "wall", "beam"] as const)("stacks another %s pickup", (weapon) => {
    const value = { missile: 1, wall: 2, beam: 3 }[weapon];
    expect(spaceImpactBonus(draws([value]), { ...hud, weapon })).toEqual({
      ...hud,
      weapon,
      count: weapon === "beam" ? 4 : 6,
    });
  });

  it("rerolls capped lives on the same chain before the next pickup (accepted UNVERIFIED default)", () => {
    const random = draws([0, 4, 2, 3]);
    const first = spaceImpactBonus(random, { ...hud, lives: 5 });
    expect(first).toEqual({ ...hud, lives: 5, weapon: "wall" });
    expect(random.consumed()).toBe(3);
    expect(spaceImpactBonus(random, first)).toEqual({ ...hud, lives: 5, weapon: "beam", count: 1 });
    expect(random.consumed()).toBe(4);
  });
});

describe("Space impact LCD seed identifiability", () => {
  it("keeps a no-draw trace noninformative", () => {
    const result = searchSpaceImpactSeeds([]);
    expect(result.kind).toBe("noninformative");
    expect(result.candidates).toHaveLength(GAME_RANDOM_MODULUS);
  });

  it("keeps the first wall outcome ambiguous under H9 and the first-draw hypothesis", () => {
    const frame = SPACE_IMPACT_LEVEL_OBSERVATIONS.frames.find((frame) => frame.image === "ik");
    if (frame?.kind !== "decoded") throw new Error("Missing decoded pickup LCD");
    expect(frame.hud).toEqual({ ...hud, weapon: "wall", count: 3 });
    const result = searchSpaceImpactSeeds([
      { draw: 1, mask: 3, value: 2, source: "game/space-impact/level-0/ik" },
    ]);
    expect(result.kind).toBe("noninformative");
    expect(result.candidates).toHaveLength(16380);
    expect(result.candidates).not.toContain(0);
    expect(result.candidates).not.toContain(610);
  });

  it("recovers an effective state only when the complete supplied observations are unique", () => {
    // Synthetic controls test the search, not a recovered firmware or clock seed.
    const random = createGameRandom(1234);
    const observations = Array.from({ length: 10 }, (_, index) => ({
      draw: index + 1,
      mask: 3,
      value: random.next() & 3,
      source: `synthetic/${index}`,
    }));
    const result = searchSpaceImpactSeeds(observations);
    expect(result).toMatchObject({ kind: "unique", effectiveSeed: 1234, candidates: [1234] });
    expect(searchSpaceImpactSeeds(observations.slice(0, 1)).kind).toBe("noninformative");
  });

  it("reports a model mismatch instead of choosing a candidate when none fits", () => {
    expect(() =>
      searchSpaceImpactSeeds([
        { draw: 1, mask: 3, value: 0, source: "synthetic/a" },
        { draw: 1, mask: 3, value: 1, source: "synthetic/b" },
      ]),
    ).toThrow(/No effective seed.*draw order/);
  });

  it.each([
    { draw: 0, mask: 3, value: 2, source: "invalid/zero-index" },
    { draw: 1.5, mask: 3, value: 2, source: "invalid/fractional-index" },
    { draw: 1, mask: -1, value: 2, source: "invalid/mask" },
    { draw: 1, mask: 3, value: 4, source: "invalid/value" },
    { draw: 1, mask: 3, value: 2, source: "" },
  ])("rejects an invalid recovery constraint %j", (observation) => {
    expect(() => searchSpaceImpactSeeds([observation])).toThrow(
      /Invalid Space impact random observation/,
    );
  });
});

describe("Space impact joint event filtering", () => {
  it("keeps both level-0 pickup outcomes in one chain, with a checkpoint per event", () => {
    for (const [image, weapon] of [
      ["ik", "wall"],
      ["afp", "missile"],
    ] as const) {
      const frame = SPACE_IMPACT_LEVEL_OBSERVATIONS.frames.find((frame) => frame.image === image);
      expect(frame).toMatchObject({ kind: "decoded", hud: { weapon, count: 3 } });
    }
    const result = filterSpaceImpactSeedEvents([
      { draw: 1, kind: "mask", mask: 3, value: 2, source: "game/space-impact/level-0/ik" },
      { draw: 20, kind: "mask", mask: 3, value: 1, source: "game/space-impact/level-0/afp" },
    ]);
    expect(result.kind).toBe("ambiguous");
    expect(result.checkpoints.map((event) => event.remaining)).toEqual([16380, 4093]);
    expect(result.candidates).toHaveLength(4093);
  });

  it("rejects a conflicting order at the responsible event and preserves its checkpoints", () => {
    const result = filterSpaceImpactSeedEvents([
      { draw: 1, kind: "mask", mask: 3, value: 2, source: "pickup/wall" },
      { draw: 1, kind: "mask", mask: 3, value: 1, source: "pickup/missile-at-same-draw" },
    ]);
    expect(result.kind).toBe("rejected");
    expect(result.candidates).toEqual([]);
    expect(result.checkpoints.map((event) => [event.source, event.remaining])).toEqual([
      ["pickup/wall", 16380],
      ["pickup/missile-at-same-draw", 0],
    ]);
  });

  it("filters shot and non-shot opportunities at their positions in the same chain", () => {
    const result = filterSpaceImpactSeedEvents([
      {
        draw: 1,
        kind: "remainder",
        modulus: 65521,
        value: 32727,
        equal: true,
        source: "synthetic/first-draw",
      },
      {
        draw: 2,
        kind: "remainder",
        modulus: 5,
        value: 0,
        equal: false,
        source: "synthetic/no-shot",
      },
      { draw: 3, kind: "remainder", modulus: 3, value: 0, equal: true, source: "synthetic/shot" },
    ]);
    expect(result.kind).toBe("unique");
    expect(result.checkpoints.map((event) => event.remaining)).toEqual([1, 1, 1]);
    expect(result.candidates).toEqual([1234]);
  });

  it("does not mistake a unique effective chain for the original u32 seed", () => {
    const aliases = spaceImpactU32SeedAliases(1234);
    expect(aliases).toHaveLength(65551);
    expect(aliases).toContain(1234);
    expect(aliases.some((seed) => seed > 0xffff0000)).toBe(true);
    expect(new Set(aliases).size).toBe(aliases.length);
    const expected = createGameRandom(1234);
    const first = expected.next(),
      second = expected.next();
    for (const seed of aliases) {
      const random = createGameRandom(seed);
      expect([random.next(), random.next()]).toEqual([first, second]);
    }
  });

  it("requires an ordered, valid consumer hypothesis", () => {
    expect(() =>
      filterSpaceImpactSeedEvents([
        { draw: 2, kind: "mask", mask: 3, value: 2, source: "later" },
        { draw: 1, kind: "mask", mask: 3, value: 1, source: "earlier" },
      ]),
    ).toThrow(/order/);
    expect(() =>
      filterSpaceImpactSeedEvents([
        { draw: 1, kind: "remainder", modulus: 0, value: 0, equal: true, source: "invalid" },
      ]),
    ).toThrow(/Invalid/);
  });
});
