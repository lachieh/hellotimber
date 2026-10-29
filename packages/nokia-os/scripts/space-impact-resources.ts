// Plan 24 Task 4: committed LCD sprite/tile specimens and measured timing.
// Later level acceptance replays extend the sprite inventory and prove complete settled frames.
import { findGoldenImage, LCD_WIDTH, LCD_HEIGHT, type Golden } from "./golden-format.ts";
import { framePeriod } from "./game-capture.ts";
import { isSpaceImpactFrame, normalized, shipAt } from "./space-impact-capture-set.ts";
import {
  resourceModule,
  type GeneratedResourceModule,
  type ResourceDeclarations,
} from "./resource-declarations.ts";

export interface SpaceImpactCrop {
  readonly id: string;
  readonly golden: string;
  readonly image: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly inverted: boolean;
}

const ROOT = "game/space-impact/";
function crop(
  id: string,
  golden: string,
  image: string,
  x: number,
  y: number,
  width: number,
  height: number,
  inverted: boolean,
): SpaceImpactCrop {
  return { id, golden: ROOT + golden, image, x, y, width, height, inverted };
}

// Repeated ids are independent specimens of one sprite, including both LCD polarities.
export const SPACE_IMPACT_CROPS: readonly SpaceImpactCrop[] = [
  crop("ship", "keys-tap-5", "t0040", 5, 20, 10, 7, true),
  crop("ship", "level-1", "b", 5, 20, 10, 7, false),
  crop("heart", "keys-tap-5", "t0040", 0, 0, 5, 4, true),
  crop("heart", "level-1", "b", 0, 0, 5, 4, false),
  crop("special/missile", "keys-tap-5", "t0040", 36, 0, 5, 4, true),
  crop("special/missile", "level-1", "b", 36, 0, 5, 4, false),
  crop("boss/0/0", "level-0", "aht", 62, 12, 20, 23, true),
  crop("boss/0/0", "level-0", "ahu", 61, 12, 20, 23, true),
  crop("boss/0/1", "level-0", "ahs", 63, 12, 20, 23, true),
  crop("boss/0/1", "level-0", "ahw", 60, 12, 20, 23, true),
  crop("boss/1/0", "level-1", "ub", 59, 12, 22, 21, false),
  crop("boss/1/0", "level-1", "uc", 58, 12, 22, 21, false),
  crop("boss/1/1", "level-1", "ty", 60, 12, 23, 20, false),
  crop("boss/1/1", "level-1", "ua", 59, 12, 23, 20, false),
  crop("boss/2/0", "level-2", "aay", 62, 12, 21, 20, false),
  crop("boss/2/0", "level-2", "abc", 59, 12, 21, 20, false),
  crop("boss/2/1", "level-2", "aaz", 60, 12, 22, 20, false),
  crop("boss/2/1", "level-2", "aba", 59, 12, 22, 20, false),
  crop("boss/3/0", "level-3", "ajv", 56, 14, 15, 21, false),
  crop("boss/3/0", "level-3", "ajw", 56, 15, 15, 21, false),
  crop("boss/3/1", "level-3", "ajz", 56, 17, 15, 21, false),
  crop("boss/3/1", "level-3", "akd", 56, 16, 15, 21, false),
  crop("boss/4/0", "level-4", "anf", 56, 17, 19, 21, true),
  crop("boss/4/0", "level-4", "ano", 56, 18, 19, 21, true),
  crop("boss/4/1", "level-4", "ang", 56, 18, 19, 21, true),
  crop("boss/4/1", "level-4", "anm", 56, 19, 19, 21, true),
  crop("boss/5/0", "level-5", "aec", 65, 9, 18, 18, true),
  crop("boss/5/0", "level-5", "aef", 62, 9, 18, 18, true),
  crop("boss/5/1", "level-5", "aer", 56, 10, 18, 19, true),
  crop("boss/5/1", "level-5", "aes", 56, 11, 18, 19, true),
  crop("ship/shielded/0", "nokeys", "b", 3, 18, 14, 11, true),
  crop("ship/shielded/0", "keys-continue-6", "b", 3, 18, 14, 11, true),
  crop("ship/shielded/1", "nokeys", "c", 3, 18, 14, 11, true),
  crop("ship/shielded/1", "deaths-3-key1-level-3", "t0000", 3, 18, 14, 11, false),
  crop("missile", "keys-special-4", "t0076", 35, 20, 5, 3, true),
  crop("missile", "level-7.restart", "jj", 33, 24, 5, 3, false),
  crop("beam", "variety-level-0.beam-enemy-special", "f", 15, 6, 1, 42, true),
  crop("beam", "variety-level-0.beam-enemy-special", "g", 17, 6, 1, 42, true),
  crop("wall/diamond", "variety-level-2.wall-enemy-special", "h", 26, 28, 5, 5, false),
  crop("wall/diamond", "variety-level-2.wall-boss-special", "k", 30, 22, 5, 5, false),
  crop("enemy/round-wide/0", "level-0", "ah", 72, 8, 11, 5, true),
  crop("enemy/round-wide/0", "keys-continue-6", "i", 72, 8, 11, 5, true),
  crop("enemy/round-wide/1", "level-0", "aj", 70, 8, 11, 5, true),
  crop("enemy/round-wide/1", "keys-continue-6", "j", 70, 8, 11, 5, true),
  crop("enemy/round-small/0", "level-0", "ru", 74, 12, 9, 5, true),
  crop("enemy/round-small/0", "level-1", "gj", 73, 9, 9, 5, false),
  crop("enemy/round-small/1", "level-4", "mf", 72, 24, 9, 5, true),
  crop("enemy/round-small/1", "level-1", "gi", 74, 9, 9, 5, false),
  crop("enemy/triangle/0", "level-0", "lg", 56, 7, 6, 7, true),
  crop("enemy/triangle/0", "level-1", "ac", 76, 8, 6, 7, false),
  crop("enemy/triangle/1", "level-0", "lh", 55, 8, 6, 7, true),
  crop("enemy/triangle/1", "level-1", "ab", 77, 8, 6, 7, false),
  crop("enemy/long-left/0", "level-0", "afo", 74, 14, 9, 5, true),
  crop("enemy/long-left/0", "level-1", "nt", 72, 24, 9, 5, false),
  crop("enemy/round-tail/0", "level-5", "gu", 69, 32, 9, 5, true),
  crop("enemy/round-tail/0", "level-1", "dg", 73, 7, 9, 5, false),
  crop("enemy/round-tail/1", "level-5", "gw", 66, 33, 9, 5, true),
  crop("enemy/round-tail/1", "level-1", "df", 74, 7, 9, 5, false),
  crop("enemy/zigzag/0", "level-4", "in", 68, 34, 9, 5, true),
  crop("enemy/zigzag/0", "level-2", "am", 74, 9, 9, 5, false),
  crop("enemy/zigzag/1", "level-4", "ik", 74, 36, 9, 5, true),
  crop("enemy/zigzag/1", "level-2", "an", 73, 9, 9, 5, false),
  crop("enemy/lander/0", "level-4", "dr", 76, 17, 7, 7, true),
  crop("enemy/lander/0", "level-2", "pz", 76, 12, 7, 7, false),
  crop("enemy/jet/0", "level-4", "anw", 45, 30, 9, 5, true),
  crop("enemy/jet/0", "level-3", "ag", 74, 10, 9, 5, false),
  crop("enemy/jet/1", "level-4", "anx", 43, 30, 9, 5, true),
  crop("enemy/jet/1", "level-3", "ai", 72, 10, 9, 5, false),
  crop("enemy/diamond/0", "level-3", "si", 76, 12, 7, 7, false),
  crop("enemy/diamond/0", "level-3", "sk", 75, 12, 7, 7, false),
  crop("enemy/long-right/0", "level-5", "ph", 70, 16, 10, 5, true),
  crop("enemy/long-right/0", "level-7", "ca", 73, 27, 10, 5, false),
  crop("enemy/long-right/1", "level-5", "pg", 72, 16, 10, 5, true),
  crop("enemy/long-right/1", "level-7", "cc", 72, 27, 10, 5, false),
  crop("projectile/pellet/0", "level-0", "gs", 76, 11, 4, 3, true),
  crop("projectile/pellet/0", "level-1", "dv", 77, 26, 4, 3, false),
  crop("projectile/cross/0", "level-3", "akk", 55, 18, 5, 3, false),
  crop("projectile/cross/0", "level-3", "akl", 52, 19, 5, 3, false),
  crop("explosion/spark/0", "level-0", "dz", 79, 19, 3, 3, true),
  crop("explosion/spark/0", "level-1", "bh", 57, 17, 3, 3, false),
  crop("explosion/checker/0", "level-0", "dx", 78, 18, 5, 5, true),
  crop("explosion/checker/0", "level-1", "bg", 56, 16, 5, 5, false),
  crop("explosion/split/0", "level-0", "bh", 32, 8, 7, 7, true),
  crop("explosion/split/0", "level-1", "bf", 55, 15, 7, 7, false),
  crop("shot", "keys-tap-1", "t0042", 15, 23, 2, 1, true),
  crop("shot", "level-2", "aam", 25, 27, 2, 1, false),
  crop("special/wall", "variety-level-2.wall-enemy-special", "a", 36, 0, 5, 4, false),
  crop("special/wall", "level-5.exit", "a", 36, 43, 5, 4, true),
  crop("special/beam", "variety-level-0.beam-enemy-special", "a", 36, 0, 5, 4, true),
  crop("special/beam", "variety-level-0.beam-boss-special", "a", 36, 0, 5, 4, true),
  crop("bonus/orb/0", "level-2", "jl", 18, 27, 8, 7, false),
  crop("bonus/orb/0", "seed-0000", "t0625", 70, 24, 8, 7, true),
  crop("bonus/orb/1", "level-0", "aes", 31, 24, 8, 7, true),
  crop("bonus/orb/1", "deaths-3-key1-level-3.restart-2", "t0336", 61, 16, 8, 7, false),
  crop("terrain/0", "level-1", "re", 52, 32, 32, 8, false),
  crop("terrain/0", "level-1", "rg", 51, 32, 32, 8, false),
  crop("terrain/1", "level-1", "c", 32, 40, 32, 8, false),
  crop("terrain/1", "level-1", "d", 31, 40, 32, 8, false),
  crop("terrain/2", "level-1", "n", 51, 40, 32, 8, false),
  crop("terrain/2", "level-1", "o", 50, 40, 32, 8, false),
  crop("terrain/3", "level-1", "re", 52, 40, 32, 8, false),
  crop("terrain/3", "level-1", "rg", 51, 40, 32, 8, false),
  crop("terrain/4", "level-2", "r", 52, 32, 32, 8, false),
  crop("terrain/4", "level-2", "s", 51, 32, 32, 8, false),
  crop("terrain/5", "level-2", "b", 0, 40, 32, 8, false),
  crop("terrain/5", "level-2", "wl", 52, 40, 32, 8, false),
  crop("terrain/6", "level-2", "b", 32, 40, 32, 8, false),
  crop("terrain/6", "level-2", "c", 31, 40, 32, 8, false),
  crop("terrain/7", "level-2", "r", 52, 40, 32, 8, false),
  crop("terrain/7", "level-2", "s", 51, 40, 32, 8, false),
  crop("terrain/8", "level-3", "s", 52, 32, 32, 8, false),
  crop("terrain/8", "level-3", "t", 51, 32, 32, 8, false),
  crop("terrain/9", "level-3", "c", 0, 40, 32, 8, false),
  crop("terrain/9", "level-3", "wr", 52, 40, 32, 8, false),
  crop("terrain/10", "level-3", "c", 32, 40, 32, 8, false),
  crop("terrain/10", "level-3", "f", 30, 40, 32, 8, false),
  crop("terrain/11", "level-3", "s", 52, 40, 32, 8, false),
  crop("terrain/11", "level-3", "t", 51, 40, 32, 8, false),
  crop("terrain/12", "level-4", "b", 0, 0, 32, 8, true),
  crop("terrain/12", "level-4", "vd", 52, 0, 32, 8, true),
  crop("terrain/13", "level-4", "b", 32, 0, 32, 8, true),
  crop("terrain/13", "level-4", "e", 31, 0, 32, 8, true),
  crop("terrain/14", "level-4", "t", 52, 0, 32, 8, true),
  crop("terrain/14", "level-4", "u", 51, 0, 32, 8, true),
  crop("terrain/15", "level-4", "b", 0, 8, 32, 8, true),
  crop("terrain/15", "level-4", "vd", 52, 8, 32, 8, true),
  crop("terrain/16", "level-6", "gz", 35, 32, 32, 8, false),
  crop("terrain/16", "level-6", "ha", 34, 32, 32, 8, false),
  crop("terrain/17", "level-6", "wm", 52, 40, 32, 8, false),
  crop("terrain/17", "level-6", "wn", 51, 40, 32, 8, false),
  crop("terrain/18", "level-6", "c", 32, 40, 32, 8, false),
  crop("terrain/18", "level-6", "d", 31, 40, 32, 8, false),
  crop("terrain/19", "level-6", "r", 52, 40, 32, 8, false),
  crop("terrain/19", "level-6", "t", 51, 40, 32, 8, false),
  crop("terrain/20", "level-6", "cx", 52, 40, 32, 8, false),
  crop("terrain/20", "level-6", "cy", 51, 40, 32, 8, false),
  crop("terrain/21", "level-6", "em", 52, 40, 32, 8, false),
  crop("terrain/21", "level-6", "en", 51, 40, 32, 8, false),
  crop("terrain/22", "level-6", "gc", 52, 40, 32, 8, false),
  crop("terrain/22", "level-6", "ge", 51, 40, 32, 8, false),
  crop("terrain/23", "level-6", "kz", 52, 40, 32, 8, false),
  crop("terrain/23", "level-6", "la", 51, 40, 32, 8, false),
  crop("terrain/24", "level-7", "q", 52, 32, 32, 8, false),
  crop("terrain/24", "level-7", "r", 51, 32, 32, 8, false),
  crop("terrain/25", "level-7", "c", 32, 40, 32, 8, false),
  crop("terrain/25", "level-7", "d", 31, 40, 32, 8, false),
  crop("terrain/26", "level-7", "q", 52, 40, 32, 8, false),
  crop("terrain/26", "level-7", "r", 51, 40, 32, 8, false),
  crop("ship/shielded/2", "pause-continue-1", "b", 3, 18, 14, 11, true),
  crop("ship/shielded/2", "pause-continue-8", "b", 3, 18, 14, 11, true),
  crop("ship/shielded/2", "level-1", "d", 3, 18, 14, 11, false),
  crop("continue/icon", "keys-continue-5", "a", 0, 0, 5, 4, true),
  ...(
    [
      [0, "b", 57],
      [1, "bg", 69],
      [2, "bo", 69],
      [3, "b", 47],
      [4, "bw", 69],
      [5, "ch", 69],
      [6, "dv", 69],
      [7, "fb", 69],
      [8, "gk", 69],
      [9, "gq", 69],
    ] as const
  ).map(([digit, image, x]) => crop(`digit/${digit}`, "level-0", image, x, 0, 3, 5, true)),
  ...(
    [
      [0, "b", 57],
      [1, "bn", 69],
      [2, "bp", 69],
      [3, "b", 47],
      [4, "cb", 69],
      [5, "b", 65],
      [6, "bd", 65],
      [7, "cw", 69],
      [8, "b", 69],
      [9, "bb", 69],
    ] as const
  ).map(([digit, image, x]) => crop(`digit/${digit}`, "level-1", image, x, 0, 3, 5, false)),
];

export function extractSpaceImpactSprites(
  load: (id: string) => Golden,
  crops: readonly SpaceImpactCrop[] = SPACE_IMPACT_CROPS,
): Record<string, readonly string[]> {
  const sprites: Record<string, readonly string[]> = {};
  for (const c of crops) {
    if (
      ![c.x, c.y, c.width, c.height].every(Number.isInteger) ||
      c.x < 0 ||
      c.y < 0 ||
      c.width <= 0 ||
      c.height <= 0 ||
      c.x + c.width > LCD_WIDTH ||
      c.y + c.height > LCD_HEIGHT
    )
      throw new Error(`${c.id}: invalid LCD rectangle`);
    const { pixels } = findGoldenImage(load(c.golden), c.image);
    const art = Array.from({ length: c.height }, (_, dy) =>
      Array.from({ length: c.width }, (_, dx) =>
        (pixels[(c.y + dy) * LCD_WIDTH + c.x + dx] === 1) !== c.inverted ? "#" : ".",
      ).join(""),
    );
    if (!art.some((row) => row.includes("#"))) throw new Error(`${c.id}: crop has no ink`);
    if (sprites[c.id] !== undefined && sprites[c.id]!.join("/") !== art.join("/"))
      throw new Error(`${c.id}: golden specimens disagree (${c.golden} ${c.image})`);
    sprites[c.id] = art;
  }
  return sprites;
}

export interface SpaceImpactTerrainSpecimen {
  readonly level: number;
  readonly image: string;
  readonly scroll: number;
  readonly x: number;
  readonly row: number;
  readonly tile: string;
  readonly width?: number;
  readonly restart?: true;
  readonly leading?: true;
}

// Clean LCD rectangles establish whole tiles, or disjoint fragments when a sprite obscures them.
export const SPACE_IMPACT_TERRAIN_SPECIMENS: readonly SpaceImpactTerrainSpecimen[] = [
  { level: 1, image: "c", scroll: 0, x: 0, row: 0, tile: "terrain/0" },
  { level: 1, image: "c", scroll: 0, x: 32, row: 0, tile: "blank" },
  { level: 1, image: "n", scroll: 13, x: 51, row: 0, tile: "blank" },
  { level: 1, image: "br", scroll: 57, x: 39, row: 0, tile: "blank" },
  { level: 1, image: "cp", scroll: 76, x: 52, row: 0, tile: "blank" },
  { level: 1, image: "hs", scroll: 175, x: 17, row: 0, tile: "blank" },
  { level: 1, image: "if", scroll: 185, x: 39, row: 0, tile: "blank" },
  { level: 1, image: "jd", scroll: 204, x: 52, row: 0, tile: "blank" },
  { level: 1, image: "kt", scroll: 236, x: 52, row: 0, tile: "blank" },
  { level: 1, image: "mj", scroll: 268, x: 52, row: 0, tile: "blank" },
  { level: 1, image: "nz", scroll: 300, x: 52, row: 0, tile: "blank" },
  { level: 1, image: "pp", scroll: 332, x: 52, row: 0, tile: "blank" },
  { level: 1, image: "re", scroll: 364, x: 52, row: 0, tile: "terrain/0" },
  { level: 1, image: "su", scroll: 396, x: 52, row: 0, tile: "blank" },
  { level: 1, image: "c", scroll: 0, x: 0, row: 1, tile: "terrain/3" },
  { level: 1, image: "c", scroll: 0, x: 32, row: 1, tile: "terrain/1" },
  { level: 1, image: "n", scroll: 13, x: 51, row: 1, tile: "terrain/2" },
  { level: 1, image: "ba", scroll: 44, x: 52, row: 1, tile: "terrain/1" },
  { level: 1, image: "cp", scroll: 76, x: 52, row: 1, tile: "terrain/1" },
  { level: 1, image: "fp", scroll: 134, x: 26, row: 1, tile: "terrain/2" },
  { level: 1, image: "gj", scroll: 149, x: 43, row: 1, tile: "terrain/2" },
  { level: 1, image: "ho", scroll: 172, x: 52, row: 1, tile: "terrain/1" },
  { level: 1, image: "jd", scroll: 204, x: 52, row: 1, tile: "terrain/2" },
  { level: 1, image: "kt", scroll: 236, x: 52, row: 1, tile: "terrain/1" },
  { level: 1, image: "mj", scroll: 268, x: 52, row: 1, tile: "terrain/1" },
  { level: 1, image: "nz", scroll: 300, x: 52, row: 1, tile: "terrain/1" },
  { level: 1, image: "pp", scroll: 332, x: 52, row: 1, tile: "terrain/2" },
  { level: 1, image: "re", scroll: 364, x: 52, row: 1, tile: "terrain/3" },
  { level: 1, image: "su", scroll: 396, x: 52, row: 1, tile: "terrain/1" },
  { level: 2, image: "b", scroll: 0, x: 0, row: 0, tile: "blank" },
  { level: 2, image: "b", scroll: 0, x: 32, row: 0, tile: "blank" },
  { level: 2, image: "r", scroll: 12, x: 52, row: 0, tile: "terrain/4" },
  { level: 2, image: "bh", scroll: 44, x: 52, row: 0, tile: "terrain/4" },
  { level: 2, image: "cx", scroll: 76, x: 52, row: 0, tile: "blank" },
  { level: 2, image: "en", scroll: 108, x: 52, row: 0, tile: "blank" },
  { level: 2, image: "gc", scroll: 140, x: 52, row: 0, tile: "terrain/4" },
  { level: 2, image: "ht", scroll: 172, x: 52, row: 0, tile: "blank" },
  { level: 2, image: "jj", scroll: 204, x: 52, row: 0, tile: "blank" },
  { level: 2, image: "la", scroll: 236, x: 52, row: 0, tile: "terrain/4" },
  { level: 2, image: "mr", scroll: 268, x: 52, row: 0, tile: "blank" },
  { level: 2, image: "oh", scroll: 300, x: 52, row: 0, tile: "blank" },
  { level: 2, image: "pw", scroll: 332, x: 52, row: 0, tile: "terrain/4" },
  { level: 2, image: "rn", scroll: 364, x: 52, row: 0, tile: "blank" },
  { level: 2, image: "tk", scroll: 401, x: 47, row: 0, tile: "terrain/4" },
  { level: 2, image: "uu", scroll: 428, x: 52, row: 0, tile: "blank" },
  { level: 2, image: "b", scroll: 0, x: 0, row: 1, tile: "terrain/5" },
  { level: 2, image: "b", scroll: 0, x: 32, row: 1, tile: "terrain/6" },
  { level: 2, image: "r", scroll: 12, x: 52, row: 1, tile: "terrain/7" },
  { level: 2, image: "bh", scroll: 44, x: 52, row: 1, tile: "terrain/7" },
  { level: 2, image: "cx", scroll: 76, x: 52, row: 1, tile: "terrain/6" },
  { level: 2, image: "en", scroll: 108, x: 52, row: 1, tile: "terrain/5" },
  { level: 2, image: "gc", scroll: 140, x: 52, row: 1, tile: "terrain/7" },
  { level: 2, image: "ht", scroll: 172, x: 52, row: 1, tile: "terrain/5" },
  { level: 2, image: "jj", scroll: 204, x: 52, row: 1, tile: "terrain/6" },
  { level: 2, image: "la", scroll: 236, x: 52, row: 1, tile: "terrain/7" },
  { level: 2, image: "mr", scroll: 268, x: 52, row: 1, tile: "terrain/6" },
  { level: 2, image: "oh", scroll: 300, x: 52, row: 1, tile: "terrain/5" },
  { level: 2, image: "pw", scroll: 332, x: 52, row: 1, tile: "terrain/7" },
  { level: 2, image: "rn", scroll: 364, x: 52, row: 1, tile: "terrain/5" },
  { level: 2, image: "te", scroll: 396, x: 52, row: 1, tile: "terrain/7" },
  { level: 2, image: "uu", scroll: 428, x: 52, row: 1, tile: "terrain/6" },
  { level: 3, image: "c", scroll: 0, x: 0, row: 0, tile: "blank" },
  { level: 3, image: "c", scroll: 0, x: 32, row: 0, tile: "blank" },
  { level: 3, image: "s", scroll: 12, x: 52, row: 0, tile: "terrain/8" },
  { level: 3, image: "bh", scroll: 44, x: 52, row: 0, tile: "terrain/8" },
  { level: 3, image: "cy", scroll: 76, x: 52, row: 0, tile: "blank" },
  { level: 3, image: "ep", scroll: 108, x: 52, row: 0, tile: "blank" },
  { level: 3, image: "gf", scroll: 140, x: 52, row: 0, tile: "terrain/8" },
  { level: 3, image: "hw", scroll: 172, x: 52, row: 0, tile: "blank" },
  { level: 3, image: "jn", scroll: 204, x: 52, row: 0, tile: "blank" },
  { level: 3, image: "le", scroll: 236, x: 52, row: 0, tile: "terrain/8" },
  { level: 3, image: "mu", scroll: 268, x: 52, row: 0, tile: "blank" },
  { level: 3, image: "ol", scroll: 300, x: 52, row: 0, tile: "blank" },
  { level: 3, image: "qb", scroll: 332, x: 52, row: 0, tile: "terrain/8" },
  { level: 3, image: "rs", scroll: 364, x: 52, row: 0, tile: "blank" },
  { level: 3, image: "tk", scroll: 396, x: 52, row: 0, tile: "terrain/8" },
  { level: 3, image: "vb", scroll: 428, x: 52, row: 0, tile: "blank" },
  { level: 3, image: "c", scroll: 0, x: 0, row: 1, tile: "terrain/9" },
  { level: 3, image: "c", scroll: 0, x: 32, row: 1, tile: "terrain/10" },
  { level: 3, image: "s", scroll: 12, x: 52, row: 1, tile: "terrain/11" },
  { level: 3, image: "bh", scroll: 44, x: 52, row: 1, tile: "terrain/11" },
  { level: 3, image: "cy", scroll: 76, x: 52, row: 1, tile: "terrain/10" },
  { level: 3, image: "ep", scroll: 108, x: 52, row: 1, tile: "terrain/9" },
  { level: 3, image: "gf", scroll: 140, x: 52, row: 1, tile: "terrain/11" },
  { level: 3, image: "hw", scroll: 172, x: 52, row: 1, tile: "terrain/9" },
  { level: 3, image: "jn", scroll: 204, x: 52, row: 1, tile: "terrain/10" },
  { level: 3, image: "le", scroll: 236, x: 52, row: 1, tile: "terrain/11" },
  { level: 3, image: "mu", scroll: 268, x: 52, row: 1, tile: "terrain/10" },
  { level: 3, image: "ol", scroll: 300, x: 52, row: 1, tile: "terrain/9" },
  { level: 3, image: "qb", scroll: 332, x: 52, row: 1, tile: "terrain/11" },
  { level: 3, image: "rs", scroll: 364, x: 52, row: 1, tile: "terrain/9" },
  { level: 3, image: "tk", scroll: 396, x: 52, row: 1, tile: "terrain/11" },
  { level: 3, image: "vb", scroll: 428, x: 52, row: 1, tile: "terrain/10" },
  { level: 4, image: "b", scroll: 0, x: 0, row: 0, tile: "terrain/12" },
  { level: 4, image: "b", scroll: 0, x: 32, row: 0, tile: "terrain/13" },
  { level: 4, image: "t", scroll: 12, x: 52, row: 0, tile: "terrain/14" },
  { level: 4, image: "bf", scroll: 44, x: 52, row: 0, tile: "terrain/14" },
  { level: 4, image: "cr", scroll: 76, x: 52, row: 0, tile: "terrain/12" },
  { level: 4, image: "eg", scroll: 108, x: 52, row: 0, tile: "terrain/14" },
  { level: 4, image: "fv", scroll: 140, x: 52, row: 0, tile: "terrain/13" },
  { level: 4, image: "hl", scroll: 172, x: 52, row: 0, tile: "terrain/13" },
  { level: 4, image: "ix", scroll: 204, x: 52, row: 0, tile: "terrain/12" },
  { level: 4, image: "kj", scroll: 236, x: 52, row: 0, tile: "terrain/13" },
  { level: 4, image: "lu", scroll: 268, x: 52, row: 0, tile: "terrain/12" },
  { level: 4, image: "nh", scroll: 300, x: 52, row: 0, tile: "terrain/12" },
  { level: 4, image: "ox", scroll: 332, x: 52, row: 0, tile: "terrain/13" },
  { level: 4, image: "qn", scroll: 364, x: 52, row: 0, tile: "terrain/13" },
  { level: 4, image: "sb", scroll: 396, x: 52, row: 0, tile: "terrain/14" },
  { level: 4, image: "tp", scroll: 428, x: 52, row: 0, tile: "terrain/13" },
  { level: 4, image: "b", scroll: 0, x: 0, row: 1, tile: "terrain/15" },
  { level: 4, image: "b", scroll: 0, x: 32, row: 1, tile: "blank" },
  { level: 4, image: "t", scroll: 12, x: 52, row: 1, tile: "blank" },
  { level: 4, image: "bf", scroll: 44, x: 52, row: 1, tile: "blank" },
  { level: 4, image: "cr", scroll: 76, x: 52, row: 1, tile: "terrain/15" },
  { level: 4, image: "eg", scroll: 108, x: 52, row: 1, tile: "blank" },
  { level: 4, image: "fv", scroll: 140, x: 52, row: 1, tile: "blank" },
  { level: 4, image: "hl", scroll: 172, x: 52, row: 1, tile: "blank" },
  { level: 4, image: "ix", scroll: 204, x: 52, row: 1, tile: "terrain/15" },
  { level: 4, image: "kj", scroll: 236, x: 52, row: 1, tile: "blank" },
  { level: 4, image: "lu", scroll: 268, x: 52, row: 1, tile: "terrain/15" },
  { level: 4, image: "nh", scroll: 300, x: 52, row: 1, tile: "terrain/15" },
  { level: 4, image: "ox", scroll: 332, x: 52, row: 1, tile: "blank" },
  { level: 4, image: "qn", scroll: 364, x: 52, row: 1, tile: "blank" },
  { level: 4, image: "sb", scroll: 396, x: 52, row: 1, tile: "blank" },
  { level: 4, image: "tp", scroll: 428, x: 52, row: 1, tile: "blank" },
  { level: 5, image: "b", scroll: 0, x: 0, row: 0, tile: "terrain/14" },
  { level: 5, image: "b", scroll: 0, x: 32, row: 0, tile: "terrain/14" },
  { level: 5, image: "t", scroll: 12, x: 52, row: 0, tile: "terrain/13" },
  { level: 5, image: "bf", scroll: 44, x: 52, row: 0, tile: "terrain/13" },
  { level: 5, image: "cu", scroll: 76, x: 52, row: 0, tile: "terrain/12" },
  { level: 5, image: "ei", scroll: 108, x: 52, row: 0, tile: "terrain/12" },
  { level: 5, image: "fy", scroll: 140, x: 52, row: 0, tile: "terrain/13" },
  { level: 5, image: "hj", scroll: 172, x: 52, row: 0, tile: "terrain/13" },
  { level: 5, image: "iz", scroll: 204, x: 52, row: 0, tile: "terrain/12" },
  { level: 5, image: "ko", scroll: 236, x: 52, row: 0, tile: "terrain/12" },
  { level: 5, image: "md", scroll: 268, x: 52, row: 0, tile: "terrain/12" },
  { level: 5, image: "ns", scroll: 300, x: 52, row: 0, tile: "terrain/12" },
  { level: 5, image: "pg", scroll: 332, x: 52, row: 0, tile: "terrain/13" },
  { level: 5, image: "qw", scroll: 364, x: 52, row: 0, tile: "terrain/13" },
  { level: 5, image: "sm", scroll: 396, x: 52, row: 0, tile: "terrain/14" },
  { level: 5, image: "uc", scroll: 428, x: 52, row: 0, tile: "terrain/13" },
  { level: 5, image: "b", scroll: 0, x: 0, row: 1, tile: "blank" },
  { level: 5, image: "b", scroll: 0, x: 32, row: 1, tile: "blank" },
  { level: 5, image: "t", scroll: 12, x: 52, row: 1, tile: "blank" },
  { level: 5, image: "da", scroll: 81, x: 15, row: 1, tile: "blank" },
  { level: 5, image: "cu", scroll: 76, x: 52, row: 1, tile: "terrain/15" },
  { level: 5, image: "ei", scroll: 108, x: 52, row: 1, tile: "terrain/15" },
  { level: 5, image: "fy", scroll: 140, x: 52, row: 1, tile: "blank" },
  { level: 5, image: "hj", scroll: 172, x: 52, row: 1, tile: "blank" },
  { level: 5, image: "iz", scroll: 204, x: 52, row: 1, tile: "terrain/15" },
  { level: 5, image: "ko", scroll: 236, x: 52, row: 1, tile: "terrain/15" },
  { level: 5, image: "md", scroll: 268, x: 52, row: 1, tile: "terrain/15" },
  { level: 5, image: "ns", scroll: 300, x: 52, row: 1, tile: "terrain/15" },
  { level: 5, image: "pg", scroll: 332, x: 52, row: 1, tile: "blank" },
  { level: 5, image: "qw", scroll: 364, x: 52, row: 1, tile: "blank" },
  { level: 5, image: "sm", scroll: 396, x: 52, row: 1, tile: "blank" },
  { level: 5, image: "uc", scroll: 428, x: 52, row: 1, tile: "blank" },
  { level: 6, image: "c", scroll: 0, x: 0, row: 0, tile: "blank" },
  { level: 6, image: "c", scroll: 0, x: 32, row: 0, tile: "blank" },
  { level: 6, image: "r", scroll: 12, x: 52, row: 0, tile: "blank" },
  { level: 6, image: "bh", scroll: 44, x: 52, row: 0, tile: "blank" },
  { level: 6, image: "cx", scroll: 76, x: 52, row: 0, tile: "blank" },
  { level: 6, image: "em", scroll: 108, x: 52, row: 0, tile: "blank" },
  { level: 6, image: "gz", scroll: 157, x: 35, row: 0, tile: "terrain/16" },
  { level: 6, image: "ht", scroll: 172, x: 52, row: 0, tile: "terrain/16" },
  { level: 6, image: "jj", scroll: 204, x: 52, row: 0, tile: "blank" },
  { level: 6, image: "kz", scroll: 236, x: 52, row: 0, tile: "blank" },
  { level: 6, image: "mq", scroll: 268, x: 52, row: 0, tile: "blank" },
  { level: 6, image: "oh", scroll: 300, x: 52, row: 0, tile: "blank" },
  { level: 6, image: "px", scroll: 332, x: 52, row: 0, tile: "blank" },
  { level: 6, image: "rw", scroll: 370, x: 46, row: 0, tile: "terrain/16" },
  { level: 6, image: "te", scroll: 396, x: 52, row: 0, tile: "terrain/16" },
  { level: 6, image: "uv", scroll: 428, x: 52, row: 0, tile: "blank" },
  { level: 6, image: "wm", scroll: 460, x: 52, row: 1, tile: "terrain/17" },
  { level: 6, image: "c", scroll: 0, x: 32, row: 1, tile: "terrain/18" },
  { level: 6, image: "r", scroll: 12, x: 52, row: 1, tile: "terrain/19" },
  { level: 6, image: "bh", scroll: 44, x: 52, row: 1, tile: "terrain/19" },
  { level: 6, image: "cx", scroll: 76, x: 52, row: 1, tile: "terrain/20" },
  { level: 6, image: "em", scroll: 108, x: 52, row: 1, tile: "terrain/21" },
  { level: 6, image: "gc", scroll: 140, x: 52, row: 1, tile: "terrain/22" },
  { level: 6, image: "ht", scroll: 172, x: 52, row: 1, tile: "terrain/22" },
  { level: 6, image: "jj", scroll: 204, x: 52, row: 1, tile: "terrain/21" },
  { level: 6, image: "kz", scroll: 236, x: 52, row: 1, tile: "terrain/23" },
  { level: 6, image: "mq", scroll: 268, x: 52, row: 1, tile: "terrain/18" },
  { level: 6, image: "oh", scroll: 300, x: 52, row: 1, tile: "terrain/19" },
  { level: 6, image: "px", scroll: 332, x: 52, row: 1, tile: "terrain/20" },
  { level: 6, image: "ro", scroll: 364, x: 52, row: 1, tile: "terrain/22" },
  { level: 6, image: "te", scroll: 396, x: 52, row: 1, tile: "terrain/22" },
  { level: 6, image: "uv", scroll: 428, x: 52, row: 1, tile: "terrain/21" },
  { level: 7, image: "c", scroll: 0, x: 0, row: 0, tile: "blank" },
  { level: 7, image: "c", scroll: 0, x: 32, row: 0, tile: "blank" },
  { level: 7, image: "q", scroll: 12, x: 52, row: 0, tile: "terrain/24" },
  { level: 7, image: "bg", scroll: 44, x: 52, row: 0, tile: "terrain/24" },
  { level: 7, image: "cx", scroll: 76, x: 52, row: 0, tile: "blank" },
  { level: 7, image: "en", scroll: 108, x: 52, row: 0, tile: "blank" },
  { level: 7, image: "c", scroll: 0, x: 32, row: 1, tile: "terrain/25" },
  { level: 7, image: "q", scroll: 12, x: 52, row: 1, tile: "terrain/26" },
  { level: 7, image: "bg", scroll: 44, x: 52, row: 1, tile: "terrain/26" },
  { level: 7, image: "cx", scroll: 76, x: 52, row: 1, tile: "terrain/25" },
  { level: 7, image: "en", scroll: 108, x: 52, row: 1, tile: "terrain/21" },
  { level: 0, image: "b", scroll: 0, x: 0, row: 0, tile: "blank" },
  { level: 0, image: "b", scroll: 0, x: 32, row: 0, tile: "blank" },
  { level: 0, image: "b", scroll: 0, x: 0, row: 1, tile: "blank" },
  { level: 0, image: "b", scroll: 0, x: 32, row: 1, tile: "blank" },
  { level: 7, image: "c", scroll: 0, x: 0, row: 1, tile: "terrain/21" },
  { level: 6, image: "c", scroll: 0, x: 0, row: 1, tile: "terrain/18", leading: true },
  { level: 6, image: "fm", scroll: 128, x: 0, row: 1, tile: "terrain/21", leading: true },
  { level: 6, image: "nr", scroll: 288, x: 0, row: 1, tile: "terrain/19", leading: true },
  { level: 6, image: "so", scroll: 384, x: 0, row: 1, tile: "terrain/21", leading: true },
  { level: 1, image: "gx", scroll: 159, x: 1, row: 0, tile: "blank", width: 16 },
  { level: 1, image: "gy", scroll: 160, x: 0, row: 0, tile: "blank", width: 16 },
  { level: 1, image: "he", scroll: 164, x: 12, row: 0, tile: "blank", width: 16 },
  { level: 1, image: "hf", scroll: 165, x: 11, row: 0, tile: "blank", width: 16 },
  {
    level: 7,
    image: "ez",
    scroll: 116,
    x: 76,
    row: 0,
    tile: "terrain/24",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "fb",
    scroll: 117,
    x: 75,
    row: 0,
    tile: "terrain/24",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "fk",
    scroll: 124,
    x: 76,
    row: 0,
    tile: "terrain/24",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "fl",
    scroll: 125,
    x: 75,
    row: 0,
    tile: "terrain/24",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "fu",
    scroll: 132,
    x: 76,
    row: 0,
    tile: "terrain/24",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "fv",
    scroll: 132,
    x: 76,
    row: 0,
    tile: "terrain/24",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "bvc",
    scroll: 166,
    x: 50,
    row: 0,
    tile: "terrain/24",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "bvd",
    scroll: 166,
    x: 50,
    row: 0,
    tile: "terrain/24",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "ez",
    scroll: 116,
    x: 76,
    row: 1,
    tile: "terrain/26",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "fb",
    scroll: 117,
    x: 75,
    row: 1,
    tile: "terrain/26",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "fk",
    scroll: 124,
    x: 76,
    row: 1,
    tile: "terrain/26",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "fl",
    scroll: 125,
    x: 75,
    row: 1,
    tile: "terrain/26",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "fu",
    scroll: 132,
    x: 76,
    row: 1,
    tile: "terrain/26",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "fv",
    scroll: 132,
    x: 76,
    row: 1,
    tile: "terrain/26",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "bvc",
    scroll: 166,
    x: 50,
    row: 1,
    tile: "terrain/26",
    width: 8,
    restart: true,
  },
  {
    level: 7,
    image: "bvd",
    scroll: 166,
    x: 50,
    row: 1,
    tile: "terrain/26",
    width: 8,
    restart: true,
  },
];

export const SPACE_IMPACT_TERRAIN_FRAMES: readonly {
  readonly level: number;
  readonly image: string;
  readonly scroll: number;
}[] = [
  { level: 0, image: "b", scroll: 0 },
  { level: 0, image: "c", scroll: 0 },
  { level: 1, image: "c", scroll: 0 },
  { level: 1, image: "o", scroll: 14 },
  { level: 1, image: "q", scroll: 16 },
  { level: 1, image: "ck", scroll: 72 },
  { level: 1, image: "io", scroll: 192 },
  { level: 1, image: "jf", scroll: 206 },
  { level: 1, image: "ji", scroll: 208 },
  { level: 1, image: "nn", scroll: 290 },
  { level: 1, image: "oe", scroll: 304 },
  { level: 1, image: "pu", scroll: 336 },
  { level: 1, image: "rh", scroll: 366 },
  { level: 1, image: "rj", scroll: 368 },
  { level: 2, image: "b", scroll: 0 },
  { level: 2, image: "u", scroll: 14 },
  { level: 2, image: "z", scroll: 18 },
  { level: 2, image: "bk", scroll: 46 },
  { level: 2, image: "bo", scroll: 50 },
  { level: 2, image: "da", scroll: 78 },
  { level: 2, image: "df", scroll: 82 },
  { level: 2, image: "ep", scroll: 110 },
  { level: 2, image: "ev", scroll: 114 },
  { level: 2, image: "gf", scroll: 142 },
  { level: 2, image: "gk", scroll: 146 },
  { level: 2, image: "hw", scroll: 174 },
  { level: 2, image: "jr", scroll: 209 },
  { level: 2, image: "js", scroll: 210 },
  { level: 2, image: "ld", scroll: 238 },
  { level: 2, image: "lj", scroll: 242 },
  { level: 2, image: "oy", scroll: 313 },
  { level: 2, image: "pz", scroll: 334 },
  { level: 2, image: "qe", scroll: 338 },
  { level: 2, image: "rq", scroll: 366 },
  { level: 2, image: "rv", scroll: 370 },
  { level: 2, image: "tr", scroll: 406 },
  { level: 3, image: "c", scroll: 0 },
  { level: 3, image: "x", scroll: 16 },
  { level: 3, image: "ag", scroll: 23 },
  { level: 3, image: "bn", scroll: 48 },
  { level: 3, image: "bw", scroll: 55 },
  { level: 3, image: "db", scroll: 78 },
  { level: 3, image: "ee", scroll: 100 },
  { level: 3, image: "eu", scroll: 112 },
  { level: 3, image: "fd", scroll: 119 },
  { level: 3, image: "gi", scroll: 142 },
  { level: 3, image: "gu", scroll: 151 },
  { level: 3, image: "ic", scroll: 176 },
  { level: 3, image: "il", scroll: 183 },
  { level: 3, image: "js", scroll: 208 },
  { level: 3, image: "kb", scroll: 215 },
  { level: 3, image: "lj", scroll: 240 },
  { level: 3, image: "ls", scroll: 247 },
  { level: 3, image: "mx", scroll: 270 },
  { level: 3, image: "nj", scroll: 279 },
  { level: 3, image: "oq", scroll: 304 },
  { level: 3, image: "pa", scroll: 311 },
  { level: 3, image: "qe", scroll: 334 },
  { level: 3, image: "qq", scroll: 343 },
  { level: 3, image: "rx", scroll: 368 },
  { level: 3, image: "sh", scroll: 375 },
  { level: 3, image: "tp", scroll: 400 },
  { level: 3, image: "tz", scroll: 407 },
  { level: 4, image: "b", scroll: 0 },
  { level: 4, image: "v", scroll: 14 },
  { level: 4, image: "y", scroll: 16 },
  { level: 4, image: "eo", scroll: 115 },
  { level: 4, image: "fx", scroll: 142 },
  { level: 4, image: "fy", scroll: 143 },
  { level: 4, image: "kr", scroll: 244 },
  { level: 4, image: "lw", scroll: 270 },
  { level: 4, image: "ly", scroll: 271 },
  { level: 4, image: "nj", scroll: 302 },
  { level: 4, image: "nk", scroll: 303 },
  { level: 4, image: "pa", scroll: 334 },
  { level: 4, image: "pb", scroll: 335 },
  { level: 4, image: "qp", scroll: 366 },
  { level: 4, image: "qr", scroll: 367 },
  { level: 4, image: "se", scroll: 398 },
  { level: 4, image: "sf", scroll: 399 },
  { level: 5, image: "b", scroll: 0 },
  { level: 5, image: "er", scroll: 115 },
  { level: 5, image: "ga", scroll: 142 },
  { level: 5, image: "gc", scroll: 143 },
  { level: 5, image: "hn", scroll: 174 },
  { level: 5, image: "ho", scroll: 175 },
  { level: 5, image: "le", scroll: 249 },
  { level: 5, image: "mf", scroll: 270 },
  { level: 5, image: "mi", scroll: 272 },
  { level: 5, image: "nu", scroll: 302 },
  { level: 5, image: "nv", scroll: 303 },
  { level: 5, image: "pj", scroll: 334 },
  { level: 5, image: "pk", scroll: 335 },
  { level: 5, image: "qy", scroll: 366 },
  { level: 5, image: "ra", scroll: 367 },
  { level: 5, image: "sq", scroll: 398 },
  { level: 5, image: "sr", scroll: 399 },
  { level: 7, image: "d", scroll: 1 },
  { level: 7, image: "y", scroll: 18 },
  { level: 7, image: "cd", scroll: 61 },
  { level: 6, image: "c", scroll: 0 },
  { level: 6, image: "d", scroll: 1 },
  { level: 6, image: "r", scroll: 12 },
  { level: 6, image: "s", scroll: 12 },
  { level: 6, image: "x", scroll: 16 },
  { level: 6, image: "dw", scroll: 96 },
  { level: 6, image: "dx", scroll: 97 },
  { level: 6, image: "em", scroll: 108 },
  { level: 6, image: "er", scroll: 112 },
  { level: 6, image: "fl", scroll: 127 },
  { level: 6, image: "fm", scroll: 128 },
  { level: 6, image: "fo", scroll: 129 },
  { level: 6, image: "ht", scroll: 172 },
  { level: 6, image: "hy", scroll: 176 },
  { level: 6, image: "is", scroll: 191 },
  { level: 6, image: "it", scroll: 192 },
  { level: 6, image: "iu", scroll: 192 },
  { level: 6, image: "iv", scroll: 193 },
  { level: 6, image: "jj", scroll: 204 },
  { level: 6, image: "jk", scroll: 204 },
  { level: 6, image: "jp", scroll: 208 },
  { level: 6, image: "ki", scroll: 223 },
  { level: 6, image: "kj", scroll: 224 },
  { level: 6, image: "kl", scroll: 225 },
  { level: 6, image: "kz", scroll: 236 },
  { level: 6, image: "le", scroll: 240 },
  { level: 6, image: "lf", scroll: 240 },
  { level: 6, image: "ly", scroll: 255 },
  { level: 6, image: "lz", scroll: 255 },
  { level: 6, image: "ma", scroll: 256 },
  { level: 6, image: "mb", scroll: 257 },
  { level: 6, image: "mq", scroll: 268 },
  { level: 6, image: "mv", scroll: 272 },
  { level: 6, image: "np", scroll: 287 },
  { level: 6, image: "nr", scroll: 288 },
  { level: 6, image: "ns", scroll: 289 },
  { level: 6, image: "oh", scroll: 300 },
  { level: 6, image: "om", scroll: 304 },
  { level: 6, image: "qd", scroll: 336 },
  { level: 6, image: "qx", scroll: 351 },
  { level: 6, image: "qy", scroll: 352 },
  { level: 6, image: "qz", scroll: 353 },
  { level: 6, image: "sn", scroll: 383 },
  { level: 6, image: "so", scroll: 384 },
  { level: 6, image: "sp", scroll: 384 },
  { level: 6, image: "sq", scroll: 385 },
  { level: 6, image: "te", scroll: 396 },
  { level: 6, image: "tf", scroll: 396 },
  { level: 6, image: "tk", scroll: 400 },
  { level: 6, image: "ue", scroll: 415 },
  { level: 6, image: "uf", scroll: 416 },
  { level: 6, image: "ug", scroll: 417 },
  { level: 6, image: "uv", scroll: 428 },
  { level: 6, image: "va", scroll: 432 },
  { level: 6, image: "vb", scroll: 432 },
  { level: 6, image: "vu", scroll: 447 },
  { level: 6, image: "vv", scroll: 447 },
  { level: 6, image: "vw", scroll: 448 },
  { level: 6, image: "vx", scroll: 449 },
  { level: 6, image: "wm", scroll: 460 },
  { level: 6, image: "yc", scroll: 492 },
  { level: 6, image: "yd", scroll: 492 },
  { level: 6, image: "zc", scroll: 511 },
  { level: 6, image: "zd", scroll: 512 },
  { level: 6, image: "zf", scroll: 513 },
  { level: 6, image: "zg", scroll: 514 },
  { level: 6, image: "zp", scroll: 521 },
  { level: 6, image: "zq", scroll: 522 },
  { level: 6, image: "zr", scroll: 522 },
  { level: 6, image: "zs", scroll: 523 },
  { level: 6, image: "zt", scroll: 524 },
  { level: 6, image: "zv", scroll: 525 },
  { level: 6, image: "zw", scroll: 526 },
  { level: 6, image: "zx", scroll: 527 },
  { level: 6, image: "zz", scroll: 528 },
  { level: 6, image: "aaa", scroll: 529 },
  { level: 6, image: "aab", scroll: 530 },
  { level: 6, image: "aad", scroll: 531 },
  { level: 6, image: "aae", scroll: 532 },
  { level: 6, image: "aaf", scroll: 533 },
  { level: 6, image: "aal", scroll: 535 },
  { level: 6, image: "aaq", scroll: 535 },
  { level: 6, image: "aax", scroll: 535 },
  { level: 6, image: "abc", scroll: 535 },
  { level: 6, image: "abh", scroll: 535 },
  { level: 6, image: "abi", scroll: 535 },
  { level: 6, image: "abo", scroll: 535 },
  { level: 6, image: "abw", scroll: 535 },
  { level: 6, image: "abx", scroll: 535 },
  { level: 6, image: "aby", scroll: 535 },
  { level: 6, image: "abz", scroll: 535 },
  { level: 6, image: "acd", scroll: 535 },
  { level: 6, image: "aci", scroll: 535 },
  { level: 6, image: "acy", scroll: 535 },
  { level: 6, image: "acz", scroll: 535 },
  { level: 6, image: "adc", scroll: 535 },
  { level: 6, image: "add", scroll: 535 },
  { level: 6, image: "aea", scroll: 535 },
  { level: 6, image: "aec", scroll: 535 },
  { level: 6, image: "aeh", scroll: 535 },
  { level: 6, image: "ael", scroll: 535 },
  { level: 6, image: "aeo", scroll: 535 },
  { level: 6, image: "aer", scroll: 535 },
  { level: 6, image: "aes", scroll: 535 },
  { level: 6, image: "aew", scroll: 535 },
  { level: 6, image: "aez", scroll: 535 },
  { level: 6, image: "afb", scroll: 535 },
  { level: 6, image: "afj", scroll: 535 },
  { level: 6, image: "afk", scroll: 535 },
  { level: 6, image: "agc", scroll: 535 },
  { level: 6, image: "agy", scroll: 535 },
  { level: 6, image: "ahd", scroll: 535 },
  { level: 6, image: "ahe", scroll: 535 },
  { level: 6, image: "ahf", scroll: 535 },
  { level: 6, image: "ahg", scroll: 535 },
];

export interface SpaceImpactTerrain {
  readonly top: number;
  readonly inverted: boolean;
  readonly rows: readonly (readonly (string | null)[])[];
  readonly leadingTiles: Readonly<Record<string, string>>;
  readonly unverifiedColumns: readonly number[];
}

function terrainArt(sprites: Readonly<Record<string, readonly string[]>>, id: string) {
  const art = id === "blank" ? Array.from({ length: 8 }, () => ".".repeat(32)) : sprites[id];
  if (!art || art.length !== 8 || art.some((row) => row.length !== 32))
    throw new Error(`terrain: invalid tile ${id}`);
  return art;
}

function extractSpaceImpactTerrain(
  load: (id: string) => Golden,
  sprites: Readonly<Record<string, readonly string[]>>,
): readonly SpaceImpactTerrain[] {
  const levels: {
    top: number;
    inverted: boolean;
    rows: (string | null)[][];
    leadingTiles: Record<string, string>;
    unverifiedColumns: number[];
  }[] = Array.from({ length: 8 }, (_, level) => ({
    top: level === 4 || level === 5 ? 0 : 32,
    inverted: level === 0 || level === 4 || level === 5,
    rows: Array.from({ length: 2 }, () =>
      Array<string | null>(16).fill(level === 0 ? "blank" : null),
    ),
    leadingTiles: {},
    unverifiedColumns: [],
  }));
  const goldens = new Map<string, Golden>();
  const coverage = new Map<string, Set<number>>();
  for (const specimen of SPACE_IMPACT_TERRAIN_SPECIMENS) {
    const { level, image, scroll, x, row, tile, leading, width = 32, restart } = specimen;
    const target = levels[level]!;
    const id = `${ROOT}level-${level}${restart ? ".restart" : ""}`;
    let golden = goldens.get(id);
    if (!golden) {
      golden = load(id);
      goldens.set(id, golden);
    }
    const { pixels } = findGoldenImage(golden, image);
    const art = terrainArt(sprites, tile);
    if (
      !Number.isInteger(scroll) ||
      scroll < 0 ||
      x < 0 ||
      x + width > 84 ||
      ((scroll + x) % 32) + width > 32 ||
      width <= 0 ||
      !Number.isInteger(width) ||
      (row !== 0 && row !== 1) ||
      (leading && (x !== 0 || row !== 1))
    )
      throw new Error(`terrain: invalid specimen alignment ${level}:${image}`);
    for (let dy = 0; dy < 8; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const ink = (pixels[(target.top + row * 8 + dy) * 84 + x + dx] === 1) !== target.inverted;
        if (ink !== (art[dy]![((scroll + x) % 32) + dx] === "#"))
          throw new Error(
            `terrain: specimen ${level}:${image} differs at ${x + dx},${target.top + row * 8 + dy}`,
          );
      }
    }
    const column = Math.floor((scroll + x) / 32) % 16;
    if (leading) target.leadingTiles[column] = tile;
    else {
      const previous = target.rows[row]![column];
      if (previous !== null && previous !== tile)
        throw new Error(`terrain: conflicting specimen ${level}:${image} column ${column}`);
      target.rows[row]![column] = tile;
      const key = `${level}:${row}:${column}`;
      const observed = coverage.get(key) ?? new Set<number>();
      for (let dx = 0; dx < width; dx++) observed.add(((scroll + x) % 32) + dx);
      coverage.set(key, observed);
    }
  }
  for (const [level, target] of levels.entries()) {
    if (level !== 0) {
      for (const [row, cells] of target.rows.entries()) {
        for (let column = 0; column < cells.length; column++) {
          if (coverage.get(`${level}:${row}:${column}`)?.size !== 32) cells[column] = null;
        }
      }
    }
    target.unverifiedColumns = Array.from({ length: 16 }, (_, column) => column).filter((column) =>
      target.rows.some((row) => row[column] === null),
    );
  }
  const resources = { sprites, terrain: levels };
  for (const { level, image, scroll } of SPACE_IMPACT_TERRAIN_FRAMES) {
    const golden = goldens.get(`${ROOT}level-${level}`)!;
    const { pixels } = findGoldenImage(golden, image);
    const target = levels[level]!;
    const art = renderSpaceImpactTerrain(resources, level, scroll);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 84; x++) {
        const ink = (pixels[(target.top + y) * 84 + x] === 1) !== target.inverted;
        if (ink !== (art[y]![x] === "#"))
          throw new Error(
            `terrain: clean frame ${level}:${image} differs at ${x},${target.top + y}`,
          );
      }
    }
  }
  return levels;
}

export function renderSpaceImpactTerrain(
  resources: {
    readonly sprites: Readonly<Record<string, readonly string[]>>;
    readonly terrain: readonly SpaceImpactTerrain[];
  },
  level: number,
  scroll: number,
  x = 0,
  y = 0,
  width = 84,
  height = 16,
): readonly string[] {
  const terrain = resources.terrain[level];
  if (!terrain) throw new Error(`terrain: no level ${level}`);
  const tiles = new Map<string, readonly string[]>();
  const art = (id: string) => {
    let tile = tiles.get(id);
    if (!tile) {
      tile = terrainArt(resources.sprites, id);
      tiles.set(id, tile);
    }
    return tile;
  };
  return Array.from({ length: height }, (_, dy) =>
    Array.from({ length: width }, (_, dx) => {
      const screenX = x + dx;
      const worldX = (scroll + screenX) % 512;
      const column = Math.floor(worldX / 32);
      const row = Math.floor((y + dy) / 8);
      let id = terrain.rows[row]?.[column];
      if (id === null || id === undefined)
        throw new Error(`terrain: UNVERIFIED level ${level} column ${column}, row ${row}`);
      if (screenX === 0 && scroll % 32 === 0 && row === 1) id = terrain.leadingTiles[column] ?? id;
      return art(id)[(y + dy) % 8]![worldX % 32]!;
    }).join(""),
  );
}

function median(values: readonly number[], where: string): number {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value) || value <= 0))
    throw new Error(`${where}: no complete positive timing observations`);
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
}

function frames(golden: Golden) {
  if (!golden.timeline) throw new Error(`${golden.id}: missing timeline`);
  const images = new Map(golden.images.map((image) => [image.name, image.pixels]));
  return golden.timeline.map((row) => {
    const pixels = images.get(row.image);
    if (!pixels) throw new Error(`${golden.id}: missing image ${row.image}`);
    return { ...row, pixels, dir: golden.id };
  });
}

function countdown(
  pixels: Uint8Array,
  sprites: Readonly<Record<string, readonly string[]>>,
): number | undefined {
  pixels = normalized(pixels);
  const matches = (id: string, x: number, y: number) =>
    sprites[id]!.every((row, dy) =>
      Array.from(row).every(
        (pixel, dx) => (pixels[(y + dy) * LCD_WIDTH + x + dx] === 1) === (pixel === "#"),
      ),
    );
  if (!matches("continue/icon", 0, 0) || !matches("digit/0", 37, 20)) return undefined;
  for (let n = 0; n <= 5; n++) if (matches(`digit/${n}`, 41, 20)) return n;
  return undefined;
}

type ShipPhase = "shielded" | "bare" | "absent";

function shipPhase(
  pixels: Uint8Array,
  sprites: Readonly<Record<string, readonly string[]>>,
  position = { x: 5, y: 20 },
): ShipPhase {
  pixels = normalized(pixels);
  const matches = (art: readonly string[], outer: boolean): boolean =>
    art.every((row, dy) =>
      Array.from(row).every((pixel, dx) => {
        if (outer && dx >= 2 && dx < 12 && dy >= 2 && dy < 9) return true;
        if (dy === (outer ? 5 : 3)) return true;
        const x = position.x + (outer ? -2 : 0) + dx;
        const y = position.y + (outer ? -2 : 0) + dy;
        return (pixels[y * LCD_WIDTH + x] === 1) === (pixel === "#");
      }),
    );
  const hasShip = sprites.ship!.every((row, dy) =>
    Array.from(row).every(
      (pixel, dx) =>
        dy === 3 || pixel === "." || pixels[(position.y + dy) * LCD_WIDTH + position.x + dx] === 1,
    ),
  );
  if (!hasShip) return "absent";
  if (
    Object.entries(sprites).some(
      ([id, art]) => id.startsWith("ship/shielded/") && matches(art, true),
    )
  )
    return "shielded";
  if (!matches(sprites.ship!, false)) return "absent";
  return matches(
    Array.from({ length: 11 }, () => ".".repeat(14)),
    true,
  )
    ? "bare"
    : "absent";
}

// S3/S8: visible shield edges and both respawns in each complete no-key recording.
const SHIELD_TIMING_SPECIMENS = {
  nokeys: { newGameBare: "o", firstRespawnBare: "df" },
  "ansi-nokeys-game1": { newGameBare: "o", firstRespawnBare: "df" },
  "ansi-nokeys-game2": { newGameBare: "p", firstRespawnBare: "dg" },
};

export function extractSpaceImpactResources(read: (id: string) => Golden) {
  const cache = new Map<string, Golden>();
  const load = (id: string) => {
    let golden = cache.get(id);
    if (!golden) {
      golden = read(id);
      cache.set(id, golden);
    }
    return golden;
  };
  const sprites = extractSpaceImpactSprites(load);
  const periods: number[] = [],
    first: number[] = [],
    holds: number[] = [],
    steps: number[] = [],
    zeros: number[] = [],
    newGameShields: number[] = [],
    respawnShields: number[] = [],
    respawns: number[] = [];
  for (const [name, edges] of Object.entries(SHIELD_TIMING_SPECIMENS)) {
    const golden = load(ROOT + name);
    const played = frames(golden);
    const game = played.filter((frame) => isSpaceImpactFrame(frame.pixels));
    const trigger = played.find((frame) => frame.frame === golden.triggerFrame);
    if (!trigger || game[0] !== trigger || game[1] === undefined)
      throw new Error(`${golden.id}: missing New game timing`);
    periods.push(framePeriod(played, isSpaceImpactFrame));
    first.push(game[1].startMs - trigger.startMs);
    const edge = (image: string, phase: ShipPhase) => {
      const row = played.find((row) => row.image === image);
      if (!row || shipPhase(row.pixels, sprites) !== phase)
        throw new Error(`${golden.id}: ${image} is not the ${phase} shield/respawn edge`);
      return row.startMs;
    };
    const elapsed = (from: number, to: number) => {
      if (to <= from) throw new Error(`${golden.id}: invalid shield/respawn timing`);
      return to - from;
    };
    newGameShields.push(elapsed(edge("b", "shielded"), edge(edges.newGameBare, "bare")));
    for (const [death, ship, bare] of [
      ["bw", "ca", edges.firstRespawnBare],
      ["ep", "et", "fy"],
    ] as const) {
      const spawnedAt = edge(ship, "shielded");
      respawns.push(elapsed(edge(death, "absent"), spawnedAt));
      respawnShields.push(elapsed(spawnedAt, edge(bare, "bare")));
    }
    const counts = played.map((frame) => ({ frame, count: countdown(frame.pixels, sprites) }));
    const start = counts.findIndex((entry) => entry.count === 5);
    let cursor = start;
    if (start < 0) throw new Error(`${golden.id}: incomplete countdown`);
    for (let count = 5; count >= 0; count--) {
      const current = counts[cursor];
      if (!current || current.count !== count)
        throw new Error(`${golden.id}: incomplete countdown at ${count}`);
      let next = cursor + 1;
      while (counts[next]?.count === count) next++;
      const end = counts[next];
      if (
        !end ||
        current.frame.lowerBound ||
        (count > 0 && end.count !== count - 1) ||
        (count === 0 && end.count !== undefined)
      )
        throw new Error(`${golden.id}: incomplete countdown after ${count}`);
      const duration = end.frame.startMs - current.frame.startMs;
      (count === 5 ? holds : count === 0 ? zeros : steps).push(duration);
      cursor = next;
    }
  }
  const resumeShields: number[] = [];
  for (const [name, bareImage] of [
    ["pause-continue-1", "s"],
    ["pause-continue-8", "k"],
  ] as const) {
    const golden = load(ROOT + name);
    const played = frames(golden);
    const resumed = played.find((row) => row.image === "c");
    const bare = played.find((row) => row.image === bareImage);
    const position = resumed && shipAt(normalized(resumed.pixels));
    if (
      !resumed ||
      !bare ||
      !position ||
      shipPhase(resumed.pixels, sprites, position) !== "shielded" ||
      shipPhase(bare.pixels, sprites, position) !== "bare" ||
      bare.startMs <= resumed.startMs
    ) {
      throw new Error(`${golden.id}: missing resume shield edge`);
    }
    resumeShields.push(bare.startMs - resumed.startMs);
  }
  const repeats: number[] = [];
  for (const [key, direction] of [
    ["0", 1],
    ["8", -1],
  ] as const) {
    const golden = load(`${ROOT}keys-hold-${key}.timeline`);
    const played = frames(golden);
    let previous: { startMs: number; x: number; y: number } | undefined;
    let repeated = 0;
    for (const row of played) {
      if (row.durationMs < 34) continue;
      const position = shipAt(normalized(row.pixels));
      if (!position) {
        previous = undefined;
        continue;
      }
      if (previous && position.x === previous.x && position.y - previous.y === 2 * direction) {
        repeats.push(row.startMs - previous.startMs);
        repeated++;
      }
      previous = { startMs: row.startMs, ...position };
    }
    if (repeated < 2) throw new Error(`${golden.id}: incomplete held-repeat evidence`);
  }
  const exitSteps: number[] = [];
  for (let level = 0; level < 8; level++) {
    const golden = load(`${ROOT}level-${level}.exit`);
    const played = frames(golden);
    let previous: { startMs: number; x: number; y: number } | undefined;
    const initial = shipAt(normalized(played[0]!.pixels));
    const targetY = level === 4 || level === 5 ? 16 : 6;
    let align = 0,
      fly = 0;
    for (const row of played) {
      if (row.durationMs < 34) continue;
      const position = shipAt(normalized(row.pixels));
      if (!position) continue;
      if (previous && (position.x !== previous.x || position.y !== previous.y)) {
        exitSteps.push(row.startMs - previous.startMs);
        if (position.x === previous.x && Math.abs(position.y - previous.y) === 1) align++;
        if (position.x > previous.x && position.y === previous.y) fly++;
      }
      previous = { startMs: row.startMs, ...position };
    }
    if (fly === 0 || (initial?.y !== targetY && align === 0))
      throw new Error(`${golden.id}: incomplete level exit`);
  }
  return {
    sprites,
    terrain: extractSpaceImpactTerrain(load, sprites),
    timings: {
      tickMs: median(periods, "tick"),
      firstTickMs: median(first, "first tick"),
      continueHoldMs: median(holds, "continue hold"),
      continueStepMs: median(steps, "continue step"),
      continueZeroMs: median(zeros, "continue zero"),
      newGameShieldMs: median(newGameShields, "new game shield"),
      respawnShieldMs: median(respawnShields, "respawn shield"),
      respawnMs: median(respawns, "respawn"),
      resumeShieldMs: median(resumeShields, "resume shield"),
      levelExitStepMs: median(exitSteps, "level exit step"),
      repeatMs: median(repeats, "held repeat"),
    },
  };
}

export const spaceImpactResourceModule: GeneratedResourceModule = {
  file: "space-impact.ts",
  extract: ({ golden }) =>
    resourceModule(
      "SPACE_IMPACT_DATA",
      "{ readonly sprites: Readonly<Record<string, readonly string[]>>; readonly terrain: readonly { readonly top: number; readonly inverted: boolean; readonly rows: readonly (readonly (string | null)[])[]; readonly leadingTiles: Readonly<Record<string, string>>; readonly unverifiedColumns: readonly number[] }[]; readonly timings: { readonly tickMs: number; readonly firstTickMs: number; readonly continueHoldMs: number; readonly continueStepMs: number; readonly continueZeroMs: number; readonly newGameShieldMs: number; readonly respawnShieldMs: number; readonly respawnMs: number; readonly resumeShieldMs: number; readonly levelExitStepMs: number; readonly repeatMs: number } }",
      extractSpaceImpactResources(golden),
    ),
};
export const spaceImpactResources: ResourceDeclarations = {
  generatedModules: [spaceImpactResourceModule],
};
