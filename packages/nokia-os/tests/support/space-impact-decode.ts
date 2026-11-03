import { SPACE_IMPACT_DATA } from "@hellotimber/nokia-kit/ui/resources/generated/space-impact";
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
  const end = y === 0 ? 5 : HEIGHT;
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

function readTerrain(level: number, scroll?: number) {
  if (level === 0)
    return [{ terrain: { kind: "none" } as const, background: new Uint8Array(WIDTH * HEIGHT) }];
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
  return views.known
    .filter((view) => scroll === undefined || view.scroll === scroll % 512)
    .map((view) => {
      const background = new Uint8Array(WIDTH * HEIGHT);
      for (const [dy, row] of view.art.entries())
        for (const [x, char] of row.split("").entries())
          background[(map.top + dy) * WIDTH + x] = Number(char === "#");
      return {
        terrain: {
          kind: "terrain",
          scrolls: [view.scroll],
          unverifiedScrolls: scroll === undefined ? views.unverified : [],
        } as const,
        background,
      };
    });
}

const objectPictures = Object.entries(sprites)
  .filter(
    ([id]) =>
      id === "ship" ||
      id.startsWith("ship/") ||
      id === "shot" ||
      id === "missile" ||
      id === "beam" ||
      /^(enemy|boss|bonus|projectile|explosion|wall)\//.test(id),
  )
  .map(([id, art]) => ({ id, art, width: art[0]!.length, height: art.length }));

// Level-0 go–gr and afo establish these pairs using their original pictures.
function layeredPictures(inverted: boolean) {
  const singles = objectPictures.map((sprite) => ({
    ...sprite,
    parts: [{ picture: sprite.id, x: 0, y: 0, width: sprite.width, height: sprite.height }],
  }));
  const pairs = ["enemy/round-wide/0", "enemy/round-wide/1", "ship"].flatMap((id) =>
    [0, 1].map((orbFrame) => {
      const primary = objectPictures.find((sprite) => sprite.id === id)!;
      const orb = objectPictures.find((sprite) => sprite.id === `bonus/orb/${orbFrame}`)!;
      const offset = primary.width - 1;
      const width = offset + orb.width,
        height = Math.max(primary.height, orb.height);
      const art = Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => {
          const a = Number(primary.art[y]?.[x] === "#"),
            b = Number(orb.art[y]?.[x - offset] === "#");
          return (inverted ? a ^ b : a | b) ? "#" : ".";
        }).join(""),
      );
      return {
        id: `${primary.id}+${orb.id}`,
        art,
        width,
        height,
        parts: [
          { picture: primary.id, x: 0, y: 0, width: primary.width, height: primary.height },
          { picture: orb.id, x: offset, y: 0, width: orb.width, height: orb.height },
        ],
      };
    }),
  );
  return [...singles, ...pairs];
}

const RESERVED_OBJECT = 1,
  RESERVED_BONUS = 2;

const invertedPictures = layeredPictures(true);
const normalPictures = layeredPictures(false);

function readObjects(
  pixels: Uint8Array,
  top: number,
  bottom: number,
  inverted: boolean,
  background = new Uint8Array(WIDTH * HEIGHT),
): readonly (readonly SpaceImpactObservation[])[] {
  const solutions: SpaceImpactObservation[][] = [];
  const signatures = new Set<string>();
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
      const signature = JSON.stringify(ordered);
      if (!signatures.has(signature)) {
        signatures.add(signature);
        solutions.push(ordered);
      }
      return;
    }
    const firstX = first % WIDTH,
      firstY = Math.floor(first / WIDTH);
    for (const sprite of inverted ? invertedPictures : normalPictures) {
      const compound = sprite.parts.some(
        (part) =>
          part.picture === "ship" ||
          part.picture.startsWith("ship/") ||
          part.picture.startsWith("explosion/") ||
          part.picture.startsWith("boss/0/"),
      );
      // The sprite or one of its crossing shots must cover the first unexplained pixel.
      for (
        let y = Math.max(top, firstY - sprite.height + 1);
        y <= Math.min(firstY, bottom - sprite.height);
        y++
      ) {
        if (top === 5 && y === 5 && !sprite.id.startsWith("enemy/")) continue;
        for (
          let x = Math.max(1 - sprite.width, firstX - sprite.width + (compound ? 0 : 1));
          x <= Math.min(WIDTH - 1, firstX + (compound ? 1 : 0));
          x++
        ) {
          if (
            sprite.parts.length > 1 &&
            sprite.parts.some(
              (part) =>
                !picture(part.picture).some((row, dy) =>
                  row
                    .split("")
                    .some(
                      (char, dx) =>
                        char === "#" &&
                        x + part.x + dx >= 0 &&
                        x + part.x + dx < WIDTH &&
                        remaining[(y + part.y + dy) * WIDTH + x + part.x + dx] === 1,
                    ),
                ),
            )
          )
            continue;
          const covered = (dx: number, dy: number) =>
            sprite.parts.some(
              (part) =>
                dx >= part.x &&
                dx < part.x + part.width &&
                dy >= part.y &&
                dy < part.y + part.height,
            );
          const left = Math.max(0, x),
            right = Math.min(WIDTH, x + sprite.width);
          const rows: { x: number; y: number }[][][] = [];
          let valid = true;
          for (let dy = 0; dy < sprite.height && valid; dy++) {
            const row = sprite.art[dy]!;
            const base = (dx: number) =>
              Number(row[dx] === "#") & (inverted ? 1 : background[(y + dy) * WIDTH + x + dx]! ^ 1);
            const observed = (dx: number) => remaining[(y + dy) * WIDTH + x + dx]!;
            const differences: number[] = [];
            for (let dx = left - x; dx < right - x; dx++) {
              if (!covered(dx, dy)) continue;
              if (base(dx) !== observed(dx)) {
                if (!compound || (!inverted && base(dx) === 1)) {
                  valid = false;
                  break;
                }
                differences.push(dx);
              }
            }
            if (!valid) break;
            if (firstY === y + dy && (firstX === x - 1 || firstX === x + sprite.width))
              differences.push(firstX - x);
            differences.sort((a, b) => a - b);
            if (differences.length === 0) {
              rows.push([[]]);
              continue;
            }
            const alternatives: { x: number; y: number }[][] = [];
            const cover = (
              pending: readonly number[],
              shots: readonly { x: number; y: number }[],
            ) => {
              const next = pending[0];
              if (next === undefined) {
                alternatives.push([...shots]);
                return;
              }
              for (const start of [next - 1, next]) {
                if (
                  start < -1 ||
                  start >= sprite.width ||
                  shots.some((shot) => Math.abs(shot.x - (x + start)) < 2)
                )
                  continue;
                let works = true;
                for (const dx of [start, start + 1]) {
                  if (x + dx < 0 || x + dx >= WIDTH) {
                    works = false;
                    break;
                  }
                  if (occupied[(y + dy) * WIDTH + x + dx]) {
                    works = false;
                    break;
                  }
                  const before = dx >= 0 && dx < sprite.width ? base(dx) : 0;
                  const after = inverted
                    ? before ^ 1
                    : background[(y + dy) * WIDTH + x + dx]
                      ? 0
                      : 1;
                  if (after !== observed(dx)) {
                    works = false;
                    break;
                  }
                }
                if (works)
                  cover(
                    pending.filter((dx) => dx !== start && dx !== start + 1),
                    [...shots, { x: x + start, y: y + dy }],
                  );
              }
            };
            cover(differences, []);
            if (!alternatives.length) valid = false;
            rows.push(alternatives);
          }
          if (!valid) continue;
          for (let dy = 0; dy < sprite.height && valid; dy++)
            for (let dx = left; dx < right; dx++)
              if (
                occupied[(y + dy) * WIDTH + dx] &&
                !(
                  (sprite.id === "ship" || sprite.id.startsWith("ship/")) &&
                  occupied[(y + dy) * WIDTH + dx] === RESERVED_BONUS &&
                  sprite.art[dy]![dx - x] === "."
                )
              ) {
                valid = false;
                break;
              }
          if (!valid) continue;
          const combinations = (dy: number, shots: readonly { x: number; y: number }[]) => {
            if (dy < rows.length) {
              for (const row of rows[dy]!) combinations(dy + 1, [...shots, ...row]);
              return;
            }
            const next = remaining.slice(),
              used = occupied.slice();
            for (let dy = 0; dy < sprite.height; dy++) {
              for (let dx = left; dx < right; dx++) {
                if (!covered(dx - x, dy)) continue;
                next[(y + dy) * WIDTH + dx] = 0;
                const parts = sprite.parts.filter(
                  (part) =>
                    dx - x >= part.x &&
                    dx - x < part.x + part.width &&
                    dy >= part.y &&
                    dy < part.y + part.height,
                );
                used[(y + dy) * WIDTH + dx] = parts.every((part) =>
                  part.picture.startsWith("bonus/"),
                )
                  ? RESERVED_BONUS
                  : RESERVED_OBJECT;
              }
            }
            for (const shot of shots) {
              erase(next, 2, 1, shot.x, shot.y);
              used.fill(RESERVED_OBJECT, shot.y * WIDTH + shot.x, shot.y * WIDTH + shot.x + 2);
            }
            search(next, used, [
              ...found,
              ...sprite.parts.map((part) => ({ ...part, x: x + part.x, y: y + part.y })),
              ...shots.map((shot) => ({ picture: "shot", ...shot, width: 2, height: 1 })),
            ]);
          };
          combinations(0, []);
        }
      }
    }
  };
  search(pixels, new Uint8Array(WIDTH * HEIGHT), []);
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
  const decoded: DecodedSpaceImpact[] = [];
  for (const { terrain, background } of readTerrain(level, scroll)) {
    if (!(level === 0 || ceiling) && background.some((value, index) => value > normal[index]!))
      continue;
    const residual = normal.map((value, index) => value ^ background[index]!);
    const solutions = readObjects(
      residual,
      ceiling ? 0 : 5,
      ceiling ? 42 : HEIGHT,
      level === 0 || ceiling,
      background,
    );
    for (const observations of solutions) {
      const ships = observations.filter(
        (object) => object.picture === "ship" || object.picture.startsWith("ship/"),
      );
      if (ships.length > 1) continue;
      const result = {
        hud,
        terrain,
        ship: ships[0] ?? null,
        objects: observations.filter((object) => object !== ships[0]),
      };
      const existing = decoded.find(
        (candidate) =>
          JSON.stringify(candidate.ship) === JSON.stringify(result.ship) &&
          JSON.stringify(candidate.objects) === JSON.stringify(result.objects),
      );
      if (existing?.terrain.kind === "terrain" && terrain.kind === "terrain") {
        decoded[decoded.indexOf(existing)] = {
          ...existing,
          terrain: {
            ...existing.terrain,
            scrolls: [...existing.terrain.scrolls, ...terrain.scrolls],
          },
        };
      } else decoded.push(result);
    }
  }
  if (decoded.length === 0)
    throw new Error(
      "decoder: unread object pixels, HUD gap or terrain (unknown, overlapping, damaged or multiple ship pictures)",
    );
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
