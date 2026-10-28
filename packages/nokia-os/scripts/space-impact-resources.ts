// Plan 24 Task 4: committed LCD specimens and measured no-key timing.
// The remaining sprite families, terrain and shield/exit timings are not reconstructed yet.
import { findGoldenImage, LCD_WIDTH, LCD_HEIGHT, type Golden } from "./golden-format.ts";
import { framePeriod } from "./game-capture.ts";
import { isSpaceImpactFrame, normalized } from "./space-impact-capture-set.ts";
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
    zeros: number[] = [];
  for (const name of ["nokeys", "ansi-nokeys-game1", "ansi-nokeys-game2"]) {
    const golden = load(ROOT + name);
    const played = frames(golden);
    const game = played.filter((frame) => isSpaceImpactFrame(frame.pixels));
    const trigger = played.find((frame) => frame.frame === golden.triggerFrame);
    if (!trigger || game[0] !== trigger || game[1] === undefined)
      throw new Error(`${golden.id}: missing New game timing`);
    periods.push(framePeriod(played, isSpaceImpactFrame));
    first.push(game[1].startMs - trigger.startMs);
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
  return {
    sprites,
    timings: {
      tickMs: median(periods, "tick"),
      firstTickMs: median(first, "first tick"),
      continueHoldMs: median(holds, "continue hold"),
      continueStepMs: median(steps, "continue step"),
      continueZeroMs: median(zeros, "continue zero"),
    },
  };
}

export const spaceImpactResourceModule: GeneratedResourceModule = {
  file: "space-impact.ts",
  extract: ({ golden }) =>
    resourceModule(
      "SPACE_IMPACT_DATA",
      "{ readonly sprites: Readonly<Record<string, readonly string[]>>; readonly timings: { readonly tickMs: number; readonly firstTickMs: number; readonly continueHoldMs: number; readonly continueStepMs: number; readonly continueZeroMs: number } }",
      extractSpaceImpactResources(golden),
    ),
};
export const spaceImpactResources: ResourceDeclarations = {
  generatedModules: [spaceImpactResourceModule],
};
