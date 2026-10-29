import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import type { Golden } from "../scripts/golden-format.ts";
import {
  extractSpaceImpactResources,
  extractSpaceImpactSprites,
  spaceImpactResourceModule,
  SPACE_IMPACT_CROPS,
  SPACE_IMPACT_TERRAIN_SPECIMENS,
  SPACE_IMPACT_TERRAIN_FRAMES,
  renderSpaceImpactTerrain,
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
  "ship/shielded/2":
    ".#.#........../.....#.#.#..../#.##.......#../...##.###...../.#..#.##.#..#./...#.####.##../.#..#.##.#..#./...##.###...../#.##.......#../.....#.#.#..../.#.#..........",
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
  "explosion/spark/0": "#.#/.#./#.#",
  "explosion/split/0": ".##.##./#.....#/#.#.#.#/.#...#./#.#.#.#/##...##/.##.##.",
};

it.each(Object.entries(OBJECT_SPRITES))("extracts the independently read %s picture", (id, art) => {
  expect(resources.sprites[id]).toEqual(art.split("/"));
});

const TERRAIN_TILES = {
  "terrain/0":
    "........##....................../.......#..##..................../.....##.....##....##............/....#.........#.##..#.........../...#...........#.....#........../...#........###.......#..####.../....#......#..........#.#....#../.....#....#............#......#.",
  "terrain/1":
    ".....##....................##.../...##..##................##..#../..#......#..............#.....#./.#........##............#.....#./.#..........#............##...#./..###....###......###......###../.....####.......##...##........./...............#.......#........",
  "terrain/2":
    "................................/................................/....................##........../........##.........#..#........./.....###..#.......#....##..##.../....#......#......#......##..#../..##........##...#............#./.#............#..#............#.",
  "terrain/3":
    "......##.#....................#./........#......................#/........#......................#/........#.....................#./.........#...................#../...##.....#......####....####.../..#..##....######....####......./.#.....#........................",
  "terrain/4":
    "..........##..................../.........#.##...#.............../.........#..##.#.#............../........#..#.##.####............/.......#..#.#########...###...../.......#.#.##########...#.##..../......#...#.#######......####.../.....#...#.#####.#.......#.##...",
  "terrain/5":
    "................................/.......#####..................../......#..#.###.......######...../.....#..#.#.###.....##....##..../...##....#.#.##....##.###..##.../..#.....#.#.####..##.##..#..#.../##...#.#.#.#.####.####...#..####/#...#.#.#.#.#.##################",
  "terrain/6":
    "....##........................../...##.#............##.........../...#.##...........#.##........../..#.#.##.........#.#.##....##.../..#..#.##......##...#.###.#.##../.##.#.####...##....#.#.####..##./##...#.######...#.#.#.#.##..####/################################",
  "terrain/7":
    ".....#..#.#####.#........##.#.../.....#.#.#.###.##.......#..##.../....#...#.#####.#.......#.#.##../...#...#.#.###.##......#...#.#../..#...#.#.#####.##.....#..#.###./.#.....#.#.#####.##..##..#.####./#...#.#.#.###########...########/##.#############################",
  "terrain/8":
    "..........##..................../..........#.#.................../..........#..#................../..........#..##................./..........#...##................/..........#..#.#................/..........#...##................/..........#..#.#................",
  "terrain/9":
    "..###.........................../.#...#........................../..#.#.###.......######...####.../..#.#.#.#..###.#..#.###.#....#../..#.#.#.###..#.#...#.#.#####..#./..#.###.#.#..####.#.##.#.#.#..#./##..#...#.#..##.#..#.#.#.#.#...#/################################",
  "terrain/10":
    "....................###........./......###.######....#.#........./....##..#.#....#....#.#....####./...#.#..#.#.#####...#.#...#...#./..#..#..###.#...#######..######./.#...#..#.#.######....####.#..#./#....#..#.#.#...##.....#.#.#...#/################################",
  "terrain/11":
    "..........#...##................/........###..#.#.....####......./......###.#...##...###..###...../......#.#.#..#.#..#..#..#..#..../..###.#.#.#...####...#..#...#.../.#...##.#.#..#.#..############../#.....#.#.#...##..#.#.........##/################################",
  "terrain/12":
    "################################/#.##.##..##..##..##..##..##....#/.#.#.##..##..##..##..##..##.##.#/.#..##..##..##..##..##..##..##.#/.#..##..##..##..##..##..##.##.#./.#.##..##..##..##..##..##..#..#./.#.#...#...#...#...#...#...#..#./.#.##...#...#...#...#...#...#.#.",
  "terrain/13":
    "################################/#.#.#..#..#..#..#..#..#..#...###/.#.#.#..#..#..#..#..#..#..#.#.#./.#.#.########################.#./.#.##.##.##.##.##.##.##.##.##.#./..#..#..#..#..#..#..#..#..#..#../..##..##.##.##.##.##.##.##.#.#../...###.##.##.##.##.##.##.##.#...",
  "terrain/14":
    "##.###.###.###.###.###.##..#####/#.#.###.###.###.###.###.###.#..#/.#.#.#.#.#.#.#.#.#.#.#.#.#.#.##./.#..##..##..##..##..##..##..##../..###.###.###.###.###.###.###.../................................/................................/................................",
  "terrain/15":
    "..#.##..##..##..##..##..##..##../...#.##..##..##..##..##..##..#../...##.#...#...#...#...#...#..##./...##.##..##..##..##..##..##..#./..##.##..##..##..##..##..##.#.#./..#.##..##..##..##..##..##..##../..#.###.###.###.###.###.###.#.../...#..##..##..##..##..##..##....",
  "terrain/16":
    "...........###................../...........#.##................./............#.##................/............#.##................/............#.##................/...........#..##................/..........#..###................/..........#..##.................",
  "terrain/17":
    "..................##............/..................#.#.........../.................#..#.........../#...............#..#............/#...............#..#............/##################..############/.#.#.#.#.#.#.#.#.##..#.#.#.#.#.#/################################",
  "terrain/18":
    "..................##............/..................#.#.........../.................#..#.........../................#..#............/................#..#............/##################..############/.#.#.#.#.#.#.#.#.##..#.#.#.#.#.#/################################",
  "terrain/19":
    ".###......####............##..../.#..#....#..##............#.#.../..#..#..#..##............#..#.../...#..##..##............#..#..../....#....##.............#..#..../######..##################..####/.#.#.#..##.#.#.#.#.#.#.#.##..#.#/################################",
  "terrain/20":
    ".###......####............##..../.#..#....#..##............#.#.../..#..#..#..##............#..#.../.###..##..###############..#####/..#.#....##.#.#.#.#.#.#.#..##.#./######..##################..####/.#.#.#..##.#.#.#.#.#.#.#.##..#.#/################################",
  "terrain/21":
    ".###......####............##..../.#..#....#..##............#.#.../..#..#..#..##............#..#.../####..##..###############..#####/#.#.#....##.#.#.#.#.#.#.#..##.#./######..##################..####/.#.#.#..##.#.#.#.#.#.#.#.##..#.#/################################",
  "terrain/22":
    "..........#...##..........##..../........#########.........#.#.../.......##.......##.......#..#.../#########################..####./#.#.#.#.#.#.#.#.#.#.#.#.#..##.#./##########################..####/.#.#.#.#.#.#.#.#.#.#.#.#.##..#.#/################################",
  "terrain/23":
    ".###......####............##..../.#..#....#..##............#.#.../..#..#..#..##............#..#.../#..#..##..##............#..#..../#...#....##.............#..#..../######..##################..####/.#.#.#..##.#.#.#.#.#.#.#.##..#.#/################################",
  "terrain/24":
    "...............####............./................#..###........../.................##..###......../...................#..###......./....................#.#.##....../....................#..#.#....../.....####..........#..#.##....../......#..###......#..#.##.......",
  "terrain/25":
    "................................/................................/................................/################################/#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#./################################/.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#/################################",
  "terrain/26":
    ".......##..###...#..#.#.#......./.........#..###..#...#.##......./..........#...##..#.#.#.##....../###########..#.#####.#.#########/#.#.#.#.##..#.###.##..#######.#./#########..#.######..#.#########/.#.#.#.#..#.#.####..#.#.##.#####/########...#.####..#.#.#.##.####",
};

it.each(Object.entries(TERRAIN_TILES))(
  "extracts the independently inspected 32x8 %s tile",
  (id, art) => {
    expect(resources.sprites[id]).toEqual(art.split("/"));
    const specimens = SPACE_IMPACT_CROPS.filter((crop) => crop.id === id);
    expect(specimens).toHaveLength(2);
    expect(new Set(specimens.map((crop) => `${crop.golden}:${crop.image}`)).size).toBe(2);
    expect(new Set(specimens.map((crop) => crop.x)).size).toBe(2);
    for (const specimen of specimens) {
      expect([specimen.width, specimen.height]).toEqual([32, 8]);
    }
  },
);

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
    expect(Object.keys(resources.sprites)).toHaveLength(86);
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
      "ship/shielded/2",
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
      resumeShieldMs: 1512,
      levelExitStepMs: 92,
      repeatMs: 94,
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
    ["resumeShieldMs", 188],
    ["levelExitStepMs", 12],
    ["repeatMs", 12],
  ] as const)("cross-checks %s against the captured timer unit", (key, units) => {
    const observed = resources.timings[key];
    const expected = (units * resources.timings.continueStepMs) / 100;
    expect(Math.abs(observed - expected)).toBeLessThanOrEqual(timingToleranceMs(expected));
  });
  it.each(["0", "8"])("rejects held-%s without its repeats", (key) => {
    expect(() =>
      extractSpaceImpactResources((id) => {
        const golden = loadGolden(id);
        return id.endsWith(`keys-hold-${key}.timeline`)
          ? { ...golden, timeline: golden.timeline?.slice(0, 4) }
          : golden;
      }),
    ).toThrow(/held-repeat evidence/);
  });
  it.each([
    ["pause-continue-1", "s"],
    ["pause-continue-8", "k"],
  ])("rejects %s without its bare resume edge", (name, image) => {
    expect(() =>
      extractSpaceImpactResources((id) => {
        const golden = loadGolden(id);
        return id.endsWith(name)
          ? { ...golden, timeline: golden.timeline?.filter((row) => row.image !== image) }
          : golden;
      }),
    ).toThrow(/resume shield edge/);
  });
  it("rejects an exit without the ship's fly-off", () => {
    expect(() =>
      extractSpaceImpactResources((id) => {
        const golden = loadGolden(id);
        return id.endsWith("level-0.exit")
          ? { ...golden, timeline: golden.timeline?.slice(0, 4) }
          : golden;
      }),
    ).toThrow(/level-0.exit.*incomplete level exit/);
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

const terrainGoldens = new Map<string, Golden>();
function terrainGolden(level: number, restart = false): Golden {
  const id = `game/space-impact/level-${level}${restart ? ".restart" : ""}`;
  let golden = terrainGoldens.get(id);
  if (!golden) {
    golden = loadGolden(id);
    terrainGoldens.set(id, golden);
  }
  return golden;
}

describe("Space impact terrain maps from clean LCD specimens", () => {
  it("derives eight 2×16 maps and records unsupported cells without inventing pixels", () => {
    expect(resources.terrain).toHaveLength(8);
    expect(resources.terrain.map((level) => level.top)).toEqual([32, 32, 32, 32, 0, 0, 32, 32]);
    for (const level of resources.terrain) {
      expect(level.rows).toHaveLength(2);
      expect(level.rows.every((row) => row.length === 16)).toBe(true);
      expect(level.unverifiedColumns).toEqual(
        Array.from({ length: 16 }, (_, column) => column).filter((column) =>
          level.rows.some((row) => row[column] === null),
        ),
      );
    }
    expect(resources.terrain[2]!.rows[1]).toEqual(
      [5, 6, 7, 7, 6, 5, 7, 5, 6, 7, 6, 5, 7, 5, 7, 6].map((id) => `terrain/${id}`),
    );
    expect(resources.terrain[1]!.unverifiedColumns).toEqual([15]);
    expect(resources.terrain[7]!.unverifiedColumns).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it.each(SPACE_IMPACT_TERRAIN_SPECIMENS)(
    "re-renders the exact map specimen $level:$image at scroll $scroll, x $x, row $row",
    ({ level, image, scroll, x, row, width = 32, restart }) => {
      const terrain = resources.terrain[level]!;
      const source = loadGolden(
        `game/space-impact/level-${level}${restart ? ".restart" : ""}`,
      ).images.find((entry) => entry.name === image)!;
      const actual = renderSpaceImpactTerrain(resources, level, scroll, x, row * 8, width, 8);
      const expected = Array.from({ length: 8 }, (_, dy) =>
        Array.from({ length: width }, (_, dx) =>
          (source.pixels[(terrain.top + row * 8 + dy) * 84 + x + dx] === 1) !== terrain.inverted
            ? "#"
            : ".",
        ).join(""),
      );
      expect(actual).toEqual(expected);
    },
  );

  it.each(SPACE_IMPACT_TERRAIN_FRAMES)(
    "re-renders every pixel of clean band $level:$image at scroll $scroll",
    ({ level, image, scroll }) => {
      const terrain = resources.terrain[level]!;
      const source = terrainGolden(level).images.find((entry) => entry.name === image)!;
      expect(renderSpaceImpactTerrain(resources, level, scroll)).toEqual(
        Array.from({ length: 16 }, (_, dy) =>
          Array.from({ length: 84 }, (_, x) =>
            (source.pixels[(terrain.top + dy) * 84 + x] === 1) !== terrain.inverted ? "#" : ".",
          ).join(""),
        ),
      );
    },
  );

  it("preserves the observed viewport-edge variants rather than changing tile pixels", () => {
    expect(resources.terrain[6]!.leadingTiles).toEqual({
      0: "terrain/18",
      4: "terrain/21",
      9: "terrain/19",
      12: "terrain/21",
    });
    expect(resources.terrain[6]!.rows[1]![4]).toBe("terrain/20");
    expect(renderSpaceImpactTerrain(resources, 6, 128, 0, 11, 1, 2)).toEqual(["#", "#"]);
    expect(renderSpaceImpactTerrain(resources, 6, 96, 32, 11, 1, 2)).toEqual([".", "."]);
  });

  it("moves one terrain pixel per scroll step and wraps after 512 pixels", () => {
    const first = renderSpaceImpactTerrain(resources, 2, 0);
    const next = renderSpaceImpactTerrain(resources, 2, 1);
    expect(next.map((row) => row.slice(0, 83))).toEqual(first.map((row) => row.slice(1)));
    expect(renderSpaceImpactTerrain(resources, 2, 512)).toEqual(first);
    const source = terrainGolden(2).images.find((image) => image.name === "b")!;
    const observed = Array.from({ length: 16 }, (_, dy) =>
      Array.from({ length: 84 }, (_, x) => (source.pixels[(32 + dy) * 84 + x] ? "#" : ".")).join(
        "",
      ),
    );
    expect(first).toEqual(observed);
    expect(next).not.toEqual(observed);
  });

  it("fails when rendering needs an unverified map column", () => {
    expect(() => renderSpaceImpactTerrain(resources, 1, 480)).toThrow(/UNVERIFIED.*15/);
  });

  it("rejects a changed clean specimen instead of voting away its mismatch", () => {
    const specimen = SPACE_IMPACT_TERRAIN_SPECIMENS.find((entry) => entry.level === 2)!;
    const id = `game/space-impact/level-${specimen.level}`;
    const golden = loadGolden(id);
    const images = golden.images.map((image) => {
      if (image.name !== specimen.image) return image;
      const pixels = image.pixels.slice();
      pixels[(32 + specimen.row * 8) * 84 + specimen.x] ^= 1;
      return { ...image, pixels };
    });
    expect(() =>
      extractSpaceImpactResources((key) => (key === id ? { ...golden, images } : loadGolden(key))),
    ).toThrow(/terrain.*specimen/);
  });
});
