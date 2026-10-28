import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import type { Golden } from "../scripts/golden-format.ts";
import {
  extractSpaceImpactResources,
  extractSpaceImpactSprites,
  spaceImpactResourceModule,
  SPACE_IMPACT_CROPS,
} from "../scripts/space-impact-resources.ts";
import { timingToleranceMs } from "./support/golden.ts";
import { loadGolden } from "./support/goldens.ts";

const GLYPHS = [
  ["###", "#.#", "#.#", "#.#", "###"],
  [".#.", "##.", ".#.", ".#.", ".#."],
  ["###", "..#", "###", "#..", "###"],
  ["###", "..#", "###", "..#", "###"],
  ["#.#", "#.#", "###", "..#", "..#"],
  ["###", "#..", "###", "..#", "###"],
  ["###", "#..", "###", "#.#", "###"],
  ["###", "..#", ".#.", ".#.", ".#."],
  ["###", "#.#", "###", "#.#", "###"],
  ["###", "#.#", "###", "..#", "###"],
];

const OBJECT_SPRITES = {
  "ship/shielded/0":
    ".#.#........../.....#.#.#..../#.##........../...##.###...../.#..#.##.#..#./...#.####.##../.#..#.##.#..#./...##.###...../#.##........../.....#.#.#..../.#.#..........",
  "ship/shielded/1":
    "..#.#........./#.....#.#.#.../..##........../#..##.###...#./....#.##.#..../.#.#.####.##../....#.##.#..../#..##.###...#./..##........../#.....#.#.#.../..#.#.........",
  missile: "#.##./#####/#.##.",
  beam: Array.from({ length: 42 }, () => "#").join("/"),
  "wall/diamond": "..#../.#.#./#.#.#/.#.#./..#..",
  "boss/0/0":
    "......#########...../.....#..##.....#..../....#..##..#.#..#.../...#..##.###.....#../.##...#.###..##..#../#....##.##..#.##..#./#....#.##..#.#.#..#./.....#.....#...#..#./.....#.#.#..#.#...#./......#.#.#..#....#./......##.##......##./.......##.......####/.......##......#.#.#/.......#.#....#.##.#/.......#.##..#.##..#/.......#..#...#.#..#/.......#..#..#.#..#./.......#..#...#...#./........###.##...#../..........##....#.../.#...##........#..../..###..#....###...../........####........",
  "boss/0/1":
    "......#########...../.....#..##.....#..../....#..##..#.#..#.../....#.##.###.....#../...#..#.###..##..#../#..#.##.##..#.##..#./.##..#.##..#...#..#./.....#.....#.#.#..#./.....#.#.#..#.#...#./......#.#.#..#....#./......##.##......##./.......##.......####/.......#.#.....#.#.#/.......#.#....#.##.#/.......#..#..#.##..#/.......#..#...#.#..#/.......#..#..#.#..#./.......#..#...#...#./..##....###.##...#../.#..#.....##....#.../.....#.........#..../......#.....###...../.......#####........",
  "boss/1/0":
    ".........#####..###.../......###.....##...##./.....#...............#/.##.#...#####.###...##/..##..###...##..##.#.#/.#.#.##.........##..##/...###..####..###..#.#/.####..##...##....#.#./#.#...##.........#.##./.#...##.....##..#.##.#/.....#....###..#.#.#.#/....#.#..##.#...#.##.#/....##..####...#.#..##/....#.#.##....#.#...##/....##..#....####..#.#/.....#......##..#..###/.....#.....##..#..#.#./......######.##....#../.......####.##......../.......#.#.#........../........###...........",
  "boss/1/1":
    "..........#####..###.../...#...###.....##...##./..#.#.#...............#/...#.#...#####.###...##/.#..#..###...##..##.#.#/#.###.##.........##..##/.##..##..####..###..#.#/...###..##...##....#.#./.......##.........#.##./......##.....##..#.##.#/......#....###..#.#.#.#/.....#.#..#.##...#.##.#/.....##..####...#.#..##/.....#.#.##....#.#...##/.....##..#....####..#.#/......#......##..#..###/......#.....##..#....#./.......#####...#....#.#/.......#.....##......../........#####..........",
  "boss/2/0":
    "......####.....##..../.......#..#...#.#..../#.....#..#...#.#...../##...#####..#..#...../#.###.#.#.###..#...../#..#.#.#.#.#.###...../#..##........#.##..../.##....####...#.#..../.#....#..###.....#.../#....###..##..#..##../###..#.#..##...##..#./#.##..#####.....#.###/#.#.#........#..###.#/##.#.#........####.../.....#.#....#..#...../##.####...#..###...../#.#.#......#.#..#..../#........#.###...#.../.###...#..#...###..../....###.##...........",
  "boss/2/1":
    ".........####........./........#..#...####.../.......#..#...#..#..../###...#####..#..#...../#..###.#.#.###..#...../.#..#.#.#.#.#.###...../.#..##........#.##..../..##....####...#.#...#/..#....#..###.....#.##/.#....#.#..##..#..##.#/.#....###..##...##..##/.#.....#####.....#.##./.#.#..........#..###../.##.####.......####.../.##.#.#.#....#..#...../.##.####...#..###...../.#.#.#......#.#..#..../.#........#.###..#..../..###...#..#..##..#.../.....###.##....####...",
  "boss/3/0":
    "..###########../.#...........#./#######......#./#...........##./#....#######..#/.####.........#/..###.#.#.#.#.#/....##.#.#.#.##/....##########./.....########../.........#####./........###.#../.......###.#.../......###.#..../......#.##...../......#.#....../.....#####...../....#.##.##..../....#.##.##..../....#.##.##..../.....#####.....",
  "boss/3/1":
    "..###########../.#...........#./#######......#./#...........##./#......#####..#/.######.......#/..#####.#.#.#.#/......##.#.#.##/......########./.......######../.........#####./........###.#../.......###.#.../......###.#..../......#.##...../......#.#....../.....#####...../....#.##.##..../....#.##.##..../....#.##.##..../.....#####.....",
  "boss/4/0":
    ".....###.........../......#.#..###...../.......#.#...##..../.......#.##..#.#.../.....#######.#.#.../....#########.##.#./...###....#####...#/..###.#..#####..###/.###....####.######/.##########.#.####./##.#####.#.#.#.#.../..#.#.#.#.#.#.#.#../####.#.#.#.#.#...../.#..#.#.#.#....#.../..#..#.#....#..#.../..#.......##...##../...#...###...##.##./....#......##...##./....#.####.#...##../...#.##...##..##.../..###....##........",
  "boss/4/1":
    ".......#.........../......#.#........../.....#.#.#..###..../.......#.##..#.#.../.....#######.#.#.../....#########.##.../...###....#####..##/..###..#.#####....#/.###....####.##.###/.##########.#.####./##.#####.#.#.#.#.../....#.#.#.#.#.#.#../..##.#.#.#.#.#...../.#..#.#.#.#....#.../..#..#.#....#..#.../..#.......##...##../...#...###...##.##./....#......##...##./..#.#.####.#..###../...#.##.#.##......./....#....#.........",
  "boss/5/0":
    "....#######......./...#########....../..##.#.#.#.#####../..#.#.#.#.#.#...#./...........#.....#/..##.....##...##.#/....#####.#..#.#.#/..........#...#..#/...........#....#./....#####...####../..########.###.#../.############..#../......#####.#.#.../.........#.#..#.../###.#.#.#.#...#.../#..#.#.#.#..##..../.#.........#....../..#########.......",
  "boss/5/1":
    ".....######......./....########....../...##.#.#.###...../.....#.#.#.#####../..........#.#...#./...........#.....#/..#########...##.#/...######.#..###.#/..........#...#..#/...........#....#./....#####...####../..########.###.#../.############..#../#.#########.#.#.../.#.#.#.#.#.#..#.../.##.#.#.#.#...#.../..#.........##..../...##......#....../.....######.......",
  shot: "##",
  "special/wall": "#..../#####/#####/#....",
  "special/beam": ".###./##.##/##.##/.###.",
  "enemy/round-wide/0": ".###.#.#.../###.#.#..#./##.#...#.../###.#.#..../.###.#..#..",
  "enemy/round-wide/1": ".###.#.##../###.#.#..##/##.#.#.##../###.#....../.###.##.##.",
  "enemy/round-small/0": "..###.##./.#.###.../#.###.##./.#.###.../..###.##.",
  "enemy/round-small/1": "..##.##../.#.###.../#.###.#../.#.###.../..##.##..",
  "enemy/triangle/0": "....#./...#.#/.##.#./#.##.#/.##.#./...#.#/....#.",
  "enemy/triangle/1": ".....#/...##./.##..#/#####./.##..#/...##./.....#",
  "enemy/long-left/0": ".....####/.####.##./#.#######/.####.##./.....####",
  "enemy/round-tail/0": "....###../.#######./###.....#/.#######./...####..",
  "enemy/round-tail/1": "....###../.#######./###.....#/.#######./....###..",
  "enemy/zigzag/0": "#####..../#....#.../######.../...#####./.......##",
  "enemy/zigzag/1": "#####..../#....#.../######.##/...#####./.........",
  "enemy/lander/0": "..###../.###.#./####..#/#######/..###../##.#.##/#..#..#",
  "enemy/jet/0": ".#.###.../#.##.##../...##..##/#.##.##../.#.###...",
  "enemy/jet/1": "##.###.../..##.##../...##..#./..##.##../##.###...",
  "enemy/diamond/0": "#.###.#/.#.###./#.#.###/#..####/#.#.###/.#.###./#.###.#",
  "enemy/long-right/0": "#..##.##../.########./..#.#.#.##/.########./#..##.##..",
  "enemy/long-right/1": "#.....##../.########./..#.#.#.##/.########./#.....##..",
  "bonus/orb/0": "...##.../.#....#./...##.../#.#.##.#/...##.../.#....#./...##...",
  "bonus/orb/1": "..#.##../......../#..##..#/..##.#../#..##..#/......../..##.#..",
  "projectile/pellet/0": ".##./##.#/.##.",
  "projectile/cross/0": ".##.#/#####/.##.#",
  "explosion/checker/0": ".#.#./#.#.#/.#.#./#.#.#/##.##",
  "explosion/split/0": ".##.##./#.....#/#.#.#.#/.#...#./#.#.#.#/##...##/.##.##.",
};

it.each(Object.entries(OBJECT_SPRITES))("extracts the independently read %s picture", (id, art) => {
  expect(resources.sprites[id]).toEqual(art.split("/"));
});

let resources: ReturnType<typeof extractSpaceImpactResources>;
beforeAll(() => {
  resources = extractSpaceImpactResources(loadGolden);
});

describe("Space impact HUD and ship resources", () => {
  it("extracts independently read ship, heart, weapon and continue pictures", () => {
    const { sprites } = resources;
    expect(sprites.ship).toEqual([
      "##........",
      ".##.###...",
      "..#.##.#..",
      ".#.####.##",
      "..#.##.#..",
      ".##.###...",
      "##........",
    ]);
    expect(sprites.heart).toEqual(["##.##", "#####", ".###.", "..#.."]);
    expect(sprites["special/missile"]).toEqual(["#.##.", "#####", "#####", "#.##."]);
    expect(sprites["continue/icon"]).toEqual([".###.", "##.##", "##.##", ".###."]);
    GLYPHS.forEach((art, n) => expect(sprites[`digit/${n}`]).toEqual(art));
  });
  it("checks every ship/HUD specimen against the same sprite in both LCD polarities", () => {
    const ids = ["ship", "heart", "special/missile", ...GLYPHS.map((_, n) => `digit/${n}`)];
    for (const id of ids) {
      expect(
        new Set(SPACE_IMPACT_CROPS.filter((crop) => crop.id === id).map((crop) => crop.inverted)),
      ).toEqual(new Set([true, false]));
    }
    expect(Object.keys(resources.sprites)).toHaveLength(57);
  });
  it("requires independent specimens for every new picture and both polarities for shared pictures", () => {
    for (const id of Object.keys(OBJECT_SPRITES)) {
      const sources = SPACE_IMPACT_CROPS.filter((crop) => crop.id === id);
      expect(new Set(sources.map((c) => `${c.golden}:${c.image}`)).size, id).toBeGreaterThanOrEqual(
        2,
      );
    }
    const shared = [
      "ship/shielded/1",
      "shot",
      "missile",
      "special/wall",
      "enemy/round-small/0",
      "enemy/round-small/1",
      "enemy/triangle/0",
      "enemy/triangle/1",
      "enemy/long-left/0",
      "enemy/round-tail/0",
      "enemy/round-tail/1",
      "enemy/zigzag/0",
      "enemy/zigzag/1",
      "enemy/lander/0",
      "enemy/jet/0",
      "enemy/jet/1",
      "enemy/long-right/0",
      "enemy/long-right/1",
      "bonus/orb/0",
      "bonus/orb/1",
      "projectile/pellet/0",
      "explosion/checker/0",
      "explosion/split/0",
    ];
    for (const id of shared) {
      expect(
        new Set(SPACE_IMPACT_CROPS.filter((c) => c.id === id).map((c) => c.inverted)),
        id,
      ).toEqual(new Set([true, false]));
    }
  });
  it("writes the module declared by plan 24 byte for byte", () => {
    const io = {
      golden: loadGolden,
      ticks: () => {
        throw new Error("LCD only");
      },
      sound: () => {
        throw new Error("LCD only");
      },
    };
    expect(spaceImpactResourceModule.extract(io)).toBe(
      readFileSync(join(import.meta.dirname, "../src/resources/generated/space-impact.ts"), "utf8"),
    );
  });
});

describe("Space impact timing resources", () => {
  it("takes medians of independent no-key games, including countdown hold, steps and final zero", () => {
    expect(resources.timings).toEqual({
      tickMs: 93,
      firstTickMs: 173,
      continueHoldMs: 1548,
      continueStepMs: 775,
      continueZeroMs: 856,
      newGameShieldMs: 2992,
      respawnShieldMs: 3002,
      respawnMs: 471,
    });
  });
  it("cross-checks the independently measured 12-unit game tick and 100-unit countdown", () => {
    const { timings: t } = resources;
    expect(t.tickMs).toBeCloseTo((t.continueStepMs * 12) / 100, 0);
    expect(Math.abs(t.continueHoldMs - 2 * t.continueStepMs)).toBeLessThan(4);
  });
  it.each([
    ["newGameShieldMs", 376],
    ["respawnShieldMs", 376],
    ["respawnMs", 62],
  ] as const)("cross-checks %s against the captured timer unit", (key, units) => {
    const observed = resources.timings[key];
    const expected = (units * resources.timings.continueStepMs) / 100;
    expect(Math.abs(observed - expected)).toBeLessThanOrEqual(timingToleranceMs(expected));
  });
  it("rejects a missing shield edge", () => {
    expect(() =>
      extractSpaceImpactResources((id) => {
        const golden = loadGolden(id);
        return id.endsWith("nokeys")
          ? { ...golden, timeline: golden.timeline?.filter((row) => row.image !== "df") }
          : golden;
      }),
    ).toThrow(/nokeys.*df.*bare.*edge/);
  });
  it("rejects a respawn timestamp before its death", () => {
    expect(() =>
      extractSpaceImpactResources((id) => {
        const golden = loadGolden(id);
        return id.endsWith("nokeys")
          ? {
              ...golden,
              timeline: golden.timeline?.map((row) =>
                row.image === "ca" ? { ...row, startMs: 1 } : row,
              ),
            }
          : golden;
      }),
    ).toThrow(/nokeys.*invalid shield\/respawn timing/);
  });
  it("rejects incomplete countdown evidence rather than inventing a duration", () => {
    expect(() =>
      extractSpaceImpactResources((id) => {
        const golden = loadGolden(id);
        return id.endsWith("nokeys")
          ? { ...golden, timeline: golden.timeline?.slice(0, 274) }
          : golden;
      }),
    ).toThrow(/nokeys.*countdown/);
  });
});

it("extracts exact crop pixels in either polarity and rejects conflicting specimens", () => {
  const pixels = new Uint8Array(84 * 48);
  pixels[84 + 2] = 1;
  const specimen: Golden = loadGolden("game/space-impact/keys-tap-5");
  const normal = { ...specimen, images: [{ name: "sample", pixels }] };
  const inverse = { ...specimen, images: [{ name: "sample", pixels: pixels.map((p) => p ^ 1) }] };
  const crop = {
    id: "sample",
    golden: "normal",
    image: "sample",
    x: 1,
    y: 1,
    width: 3,
    height: 2,
    inverted: false,
  };
  const load = (id: string) => (id === "normal" ? normal : inverse);
  expect(
    extractSpaceImpactSprites(load, [crop, { ...crop, golden: "inverse", inverted: true }]),
  ).toEqual({ sample: [".#.", "..."] });
  expect(() => extractSpaceImpactSprites(load, [crop, { ...crop, inverted: true }])).toThrow(
    /sample.*disagree/,
  );
  expect(() => extractSpaceImpactSprites(load, [{ ...crop, x: 83 }])).toThrow(/sample.*rectangle/);
  expect(() => extractSpaceImpactSprites(load, [{ ...crop, image: "missing" }])).toThrow(/missing/);
  expect(() => extractSpaceImpactSprites(load, [{ ...crop, y: 4 }])).toThrow(/sample.*no ink/);
});
