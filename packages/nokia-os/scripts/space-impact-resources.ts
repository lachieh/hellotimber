// Plan 24 Task 4: committed LCD sprite/tile specimens and measured timing.
// Further pictures, terrain maps and the full terrain reconstruction proof remain incomplete.
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
      "{ readonly sprites: Readonly<Record<string, readonly string[]>>; readonly timings: { readonly tickMs: number; readonly firstTickMs: number; readonly continueHoldMs: number; readonly continueStepMs: number; readonly continueZeroMs: number; readonly newGameShieldMs: number; readonly respawnShieldMs: number; readonly respawnMs: number; readonly resumeShieldMs: number; readonly levelExitStepMs: number; readonly repeatMs: number } }",
      extractSpaceImpactResources(golden),
    ),
};
export const spaceImpactResources: ResourceDeclarations = {
  generatedModules: [spaceImpactResourceModule],
};
