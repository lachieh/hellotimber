import { SPACE_IMPACT_DATA } from "../../src/resources/generated/space-impact.ts";
import { renderSpaceImpactTerrain } from "../../scripts/space-impact-resources.ts";

export interface SpaceImpactObservation {
  readonly picture: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DecodedSpaceImpact {
  readonly hud: {
    readonly lives: number;
    readonly weapon: "missile" | "wall" | "beam";
    readonly count: number;
    readonly score: number;
  };
  readonly ship: SpaceImpactObservation | null;
  readonly objects: readonly SpaceImpactObservation[];
  readonly terrain:
    | { readonly kind: "none" }
    | {
        readonly kind: "terrain";
        readonly scrolls: readonly number[];
        readonly unverifiedScrolls: readonly number[];
      };
}

const { sprites } = SPACE_IMPACT_DATA;
const WIDTH = 84,
  HEIGHT = 48;

function matches(pixels: Uint8Array, art: readonly string[], x: number, y: number): boolean {
  return art.every((row, dy) =>
    row.split("").every((char, dx) => pixels[(y + dy) * WIDTH + x + dx] === Number(char === "#")),
  );
}

function erase(pixels: Uint8Array, width: number, height: number, x: number, y: number) {
  for (let dy = 0; dy < height; dy++)
    pixels.fill(0, (y + dy) * WIDTH + x, (y + dy) * WIDTH + x + width);
}

function picture(id: string): readonly string[] {
  const art = sprites[id];
  if (!art) throw new Error(`decoder: missing picture ${id}`);
  return art;
}

function readHud(pixels: Uint8Array, y: number): DecodedSpaceImpact["hud"] {
  const consume = (id: string, x: number): boolean => {
    const art = picture(id);
    if (!matches(pixels, art, x, y)) return false;
    erase(pixels, art[0]!.length, art.length, x, y);
    return true;
  };
  let lives = 0;
  while (lives < 6 && consume("heart", lives * 6)) lives++;
  const weapon = (["missile", "wall", "beam"] as const).find((id) => consume(`special/${id}`, 36));
  if (!weapon) throw new Error("decoder: unread HUD weapon");
  const digits = (x: number, length: number) => {
    let value = 0;
    for (let n = 0; n < length; n++) {
      const digit = Array.from({ length: 10 }, (_, d) => d).find((d) =>
        consume(`digit/${d}`, x + n * 4),
      );
      if (digit === undefined) throw new Error(`decoder: unread HUD digit at ${x + n * 4},${y}`);
      value = value * 10 + digit;
    }
    return value;
  };
  const count = digits(43, 2),
    score = digits(57, 5);
  const start = y === 0 ? 0 : y - 1;
  const end = y === 0 ? 6 : HEIGHT;
  if (pixels.slice(start * WIDTH, end * WIDTH).some((value) => value !== 0))
    throw new Error("decoder: unread HUD pixels or gap");
  return { lives, weapon, count, score };
}

const terrainViews = new Map<
  number,
  {
    known: readonly { scroll: number; art: readonly string[] }[];
    unverified: readonly number[];
  }
>();

function readTerrain(
  pixels: Uint8Array,
  level: number,
  scroll?: number,
): DecodedSpaceImpact["terrain"] {
  if (level === 0) return { kind: "none" };
  const map = SPACE_IMPACT_DATA.terrain[level]!;
  let views = terrainViews.get(level);
  if (!views) {
    const known: { scroll: number; art: readonly string[] }[] = [];
    const unverified: number[] = [];
    for (let offset = 0; offset < 512; offset++) {
      const columns = Array.from({ length: WIDTH }, (_, x) =>
        Math.floor(((offset + x) % 512) / 32),
      );
      if (map.rows.some((row) => columns.some((column) => row[column] === null))) {
        unverified.push(offset);
      } else {
        known.push({
          scroll: offset,
          art: renderSpaceImpactTerrain(SPACE_IMPACT_DATA, level, offset),
        });
      }
    }
    views = { known, unverified };
    terrainViews.set(level, views);
  }
  if (scroll !== undefined && views.unverified.includes(scroll % 512))
    throw new Error(`decoder: UNVERIFIED terrain at level ${level}, scroll ${scroll}`);
  const candidates = views.known.filter(
    (view) =>
      (scroll === undefined || view.scroll === scroll % 512) &&
      matches(pixels, view.art, 0, map.top),
  );
  if (candidates.length === 0)
    throw new Error(`decoder: unread terrain at level ${level}; requires a complete clean band`);
  erase(pixels, WIDTH, 16, 0, map.top);
  return {
    kind: "terrain",
    scrolls: candidates.map((view) => view.scroll),
    unverifiedScrolls: scroll === undefined ? views.unverified : [],
  };
}

function objectPictures(inverted: boolean) {
  return Object.entries(sprites)
    .filter(
      ([id]) =>
        id === "ship" ||
        id.startsWith("ship/") ||
        id === "shot" ||
        id === "missile" ||
        id === "beam" ||
        /^(enemy|boss|bonus|projectile|explosion|wall)\//.test(id),
    )
    .flatMap(([id, art]) => {
      const width = art[0]!.length,
        height = art.length;
      const object = { picture: id, x: 0, y: 0, width, height };
      const patterns = [{ art, objects: [object] }];
      // LCD specimens: XOR on black (level-0 d/h), ink union on white (level-1 c, level-2 e).
      if (id === "ship" || id.startsWith("ship/")) {
        for (let shotY = 0; shotY < height; shotY++) {
          for (let shotX = 0; shotX < width; shotX++) {
            const combined = art.map((row, y) =>
              row
                .padEnd(Math.max(width, shotX + 2), ".")
                .split("")
                .map((char, x) =>
                  y === shotY && (x === shotX || x === shotX + 1)
                    ? inverted && char === "#"
                      ? "."
                      : "#"
                    : char,
                )
                .join(""),
            );
            if (combined.join("/") === art.join("/")) continue;
            patterns.push({
              art: combined,
              objects: [object, { picture: "shot", x: shotX, y: shotY, width: 2, height: 1 }],
            });
          }
        }
      }
      return patterns.flatMap((pattern) => {
        const patternWidth = pattern.art[0]!.length;
        return Array.from({ length: WIDTH + patternWidth - 1 }, (_, index) => {
          const x = index - patternWidth + 1;
          const left = Math.max(0, x),
            right = Math.min(WIDTH, x + patternWidth);
          const visible = pattern.art.map((row) => row.slice(left - x, right - x));
          const firstY = visible.findIndex((row) => row.includes("#"));
          if (firstY === -1) return [];
          if (pattern.objects.some((part) => part.x + x >= WIDTH || part.x + x + part.width <= 0))
            return [];
          return [
            {
              visible,
              x,
              left,
              right,
              firstY,
              firstX: left + visible[firstY]!.indexOf("#"),
              height,
              objects: pattern.objects,
            },
          ];
        }).flat();
      });
    });
}

const blackPictures = objectPictures(true);
const whitePictures = objectPictures(false);

function readObjects(
  pixels: Uint8Array,
  top: number,
  bottom: number,
  inverted: boolean,
): readonly (readonly SpaceImpactObservation[])[] {
  const solutions: SpaceImpactObservation[][] = [];
  const search = (
    remaining: Uint8Array,
    occupied: Uint8Array,
    found: readonly SpaceImpactObservation[],
  ) => {
    const first = remaining.indexOf(1);
    if (first === -1) {
      const ordered = [...found].sort(
        (a, b) => a.y - b.y || a.x - b.x || a.picture.localeCompare(b.picture),
      );
      if (!solutions.some((solution) => JSON.stringify(solution) === JSON.stringify(ordered)))
        solutions.push(ordered);
      return;
    }
    for (const sprite of inverted ? blackPictures : whitePictures) {
      if (first % WIDTH !== sprite.firstX) continue;
      const x = sprite.x;
      const y = Math.floor(first / WIDTH) - sprite.firstY;
      if (
        y < top ||
        y + sprite.height > bottom ||
        !matches(remaining, sprite.visible, sprite.left, y) ||
        sprite.visible.some((row, dy) =>
          occupied
            .slice((y + dy) * WIDTH + sprite.left, (y + dy) * WIDTH + sprite.right)
            .some(Boolean),
        )
      )
        continue;
      const next = remaining.slice();
      erase(next, sprite.right - sprite.left, sprite.height, sprite.left, y);
      const used = occupied.slice();
      for (let dy = 0; dy < sprite.height; dy++)
        used.fill(1, (y + dy) * WIDTH + sprite.left, (y + dy) * WIDTH + sprite.right);
      search(next, used, [
        ...found,
        ...sprite.objects.map((object) => ({ ...object, x: x + object.x, y: y + object.y })),
      ]);
    }
  };
  search(pixels, new Uint8Array(WIDTH * HEIGHT), []);
  const result = solutions[0];
  if (!result)
    throw new Error("decoder: unread object pixels (unknown, overlapping or damaged picture)");
  return solutions;
}

/** Exact visible decompositions; invisible objects cannot be inferred from one LCD frame. */
export function decodeSpaceImpactCandidates(
  pixels: Uint8Array,
  { level, scroll }: { readonly level: number; readonly scroll?: number },
): readonly DecodedSpaceImpact[] {
  if (pixels.length !== WIDTH * HEIGHT) throw new Error("decoder: expected 84 x 48 pixels");
  if (pixels.some((value) => value !== 0 && value !== 1))
    throw new Error("decoder: expected monochrome pixels");
  if (!Number.isInteger(level) || level < 0 || level > 7) throw new Error("decoder: invalid level");
  if (scroll !== undefined && (!Number.isSafeInteger(scroll) || scroll < 0))
    throw new Error("decoder: invalid scroll");
  const ceiling = level === 4 || level === 5;
  const normal = pixels.map((value) => (level === 0 || ceiling ? value ^ 1 : value));
  const hud = readHud(normal, ceiling ? 43 : 0);
  const terrain = readTerrain(normal, level, scroll);
  const solutions = readObjects(
    normal,
    ceiling ? 0 : 6,
    ceiling ? 42 : HEIGHT,
    level === 0 || ceiling,
  );
  const decoded = solutions.flatMap((observations) => {
    const ships = observations.filter(
      (object) => object.picture === "ship" || object.picture.startsWith("ship/"),
    );
    if (ships.length > 1) return [];
    return [
      {
        hud,
        terrain,
        ship: ships[0] ?? null,
        objects: observations.filter((object) => object !== ships[0]),
      },
    ];
  });
  if (decoded.length === 0) throw new Error("decoder: multiple ship pictures");
  return decoded;
}

/** Refuse to choose an interpretation without temporal evidence. */
export function decodeSpaceImpact(
  pixels: Uint8Array,
  options: { readonly level: number; readonly scroll?: number },
): DecodedSpaceImpact {
  const candidates = decodeSpaceImpactCandidates(pixels, options);
  if (candidates.length > 1) throw new Error("decoder: ambiguous object pictures");
  return candidates[0]!;
}
