import { describe, expect, it } from "vite-plus/test";
import { SPACE_IMPACT_DATA } from "../src/resources/generated/space-impact.ts";
import { decodeSpaceImpact } from "./support/space-impact-decode.ts";
import { goldenImage } from "./support/goldens.ts";

const { sprites, terrain } = SPACE_IMPACT_DATA;

function paint(pixels: Uint8Array, id: string, x: number, y: number) {
  const art = sprites[id];
  if (!art) throw new Error(`missing test sprite ${id}`);
  for (const [dy, row] of art.entries())
    for (const [dx, char] of row.split("").entries())
      if (char === "#" && x + dx >= 0 && x + dx < 84) pixels[(y + dy) * 84 + x + dx] ^= 1;
}

function frame({
  level = 0,
  lives = 3,
  weapon = "missile",
  count = 3,
  score = 0,
  scroll = 0,
  objects = [{ picture: "ship", x: 5, y: 20 }],
}: {
  level?: number;
  lives?: number;
  weapon?: string;
  count?: number;
  score?: number;
  scroll?: number;
  objects?: readonly { picture: string; x: number; y: number }[];
} = {}) {
  const pixels = new Uint8Array(84 * 48);
  const ceiling = level === 4 || level === 5;
  const hudY = ceiling ? 43 : 0;
  for (let n = 0; n < lives; n++) paint(pixels, "heart", n * 6, hudY);
  paint(pixels, `special/${weapon}`, 36, hudY);
  for (const [value, x, digits] of [
    [count, 43, 2],
    [score, 57, 5],
  ] as const)
    String(value)
      .padStart(digits, "0")
      .split("")
      .forEach((digit, n) => paint(pixels, `digit/${digit}`, x + n * 4, hudY));
  if (level !== 0) {
    const map = terrain[level]!;
    for (let dy = 0; dy < 16; dy++)
      for (let x = 0; x < 84; x++) {
        const worldX = (scroll + x) % 512;
        const column = Math.floor(worldX / 32);
        let tile = map.rows[Math.floor(dy / 8)]![column];
        if (tile === null || tile === undefined) throw new Error("unobserved test terrain");
        if (x === 0 && scroll % 32 === 0 && dy >= 8) tile = map.leadingTiles[column] ?? tile;
        pixels[(map.top + dy) * 84 + x] =
          tile === "blank" ? 0 : Number(sprites[tile]![dy % 8]![worldX % 32] === "#");
      }
  }
  for (const object of objects) paint(pixels, object.picture, object.x, object.y);
  return level === 0 || ceiling ? pixels.map((value) => value ^ 1) : pixels;
}

const pictures = Object.keys(sprites).filter(
  (id) =>
    id === "ship" ||
    id.startsWith("ship/") ||
    id === "shot" ||
    id === "missile" ||
    id === "beam" ||
    /^(enemy|boss|bonus|projectile|explosion|wall)\//.test(id),
);

describe("strict Space impact LCD decoder", () => {
  it.each(pictures)("reads the complete %s picture and its box", (picture) => {
    const art = sprites[picture]!;
    const decoded = decodeSpaceImpact(frame({ objects: [{ picture, x: 20, y: 6 }] }), { level: 0 });
    const object = { picture, x: 20, y: 6, width: art[0]!.length, height: art.length };
    if (picture === "ship" || picture.startsWith("ship/")) {
      expect(decoded.ship).toEqual(object);
      expect(decoded.objects).toEqual([]);
    } else {
      expect(decoded.ship).toBeNull();
      expect(decoded.objects).toEqual([object]);
    }
  });

  it.each([0, 1, 2, 3, 4, 5])("reads %i hearts without inferring a hidden life", (lives) => {
    expect(decodeSpaceImpact(frame({ lives }), { level: 0 }).hud.lives).toBe(lives);
  });

  it.each(["missile", "wall", "beam"])("reads the %s HUD icon and every digit", (weapon) => {
    for (const score of [0, 12345, 67890, 99999]) {
      expect(decodeSpaceImpact(frame({ weapon, score, count: 98 }), { level: 0 }).hud).toEqual({
        lives: 3,
        weapon,
        count: 98,
        score,
      });
    }
  });

  it("keeps identical enemies as separate observations and reads shots beside the ship", () => {
    const objects = [
      { picture: "ship", x: 5, y: 20 },
      { picture: "shot", x: 15, y: 23 },
      { picture: "enemy/round-wide/1", x: 60, y: 8 },
      { picture: "enemy/round-wide/1", x: 45, y: 30 },
    ];
    const decoded = decodeSpaceImpact(frame({ objects }), { level: 0 });
    expect(decoded.ship).toMatchObject(objects[0]!);
    expect(decoded.objects).toEqual([
      { ...objects[2], width: 11, height: 5 },
      { ...objects[1], width: 2, height: 1 },
      { ...objects[3], width: 11, height: 5 },
    ]);
  });

  it.each([1, 2, 3, 4, 5, 6, 7])("reads the polarity, HUD row and terrain of level %i", (level) => {
    const decoded = decodeSpaceImpact(frame({ level, score: 12345 }), { level });
    expect(decoded.hud).toEqual({ lives: 3, weapon: "missile", count: 3, score: 12345 });
    expect(decoded.terrain.kind).toBe("terrain");
    if (decoded.terrain.kind === "terrain") expect(decoded.terrain.scrolls).toContain(0);
    expect(decoded.ship).toMatchObject({ picture: "ship", x: 5, y: 20 });
  });

  it.each([1, 13, 32, 511, 512, 513])(
    "reads known terrain at scroll %i, including wrapping",
    (scroll) => {
      const decoded = decodeSpaceImpact(frame({ level: 2, scroll }), { level: 2, scroll });
      expect(decoded.terrain).toEqual({
        kind: "terrain",
        scrolls: [scroll % 512],
        unverifiedScrolls: [],
      });
    },
  );

  it("reports unobservable scroll and unknown map cells without choosing a value", () => {
    expect(decodeSpaceImpact(frame(), { level: 0 }).terrain).toEqual({ kind: "none" });
    const decoded = decodeSpaceImpact(frame({ level: 7 }), { level: 7 });
    expect(decoded.terrain.kind).toBe("terrain");
    if (decoded.terrain.kind === "terrain") {
      expect(decoded.terrain.scrolls).toContain(0);
      expect(decoded.terrain.unverifiedScrolls).toContain(7 * 32);
    }
  });

  it("refuses terrain cells without complete clean evidence", () => {
    expect(() => decodeSpaceImpact(frame({ level: 7 }), { level: 7, scroll: 224 })).toThrow(
      /UNVERIFIED/,
    );
  });

  it.each([
    ["nokeys", "b", 0, { x: 3, y: 18, picture: "ship/shielded/0" }],
    ["level-1", "b", 1, { x: 3, y: 18, picture: "ship/shielded/1" }],
    ["level-2", "b", 2, { x: 3, y: 18, picture: "ship/shielded/1" }],
  ] as const)("reads the independent committed %s %s frame", (id, name, level, ship) => {
    const decoded = decodeSpaceImpact(goldenImage(`game/space-impact/${id}`, name).image.pixels, {
      level,
    });
    expect(decoded.ship).toMatchObject(ship);
    expect(decoded.objects).toEqual([]);
    expect(decoded.hud.lives).toBe(3);
  });

  it.each([-3, 78])("reads an identifiable horizontally clipped enemy at x=%i", (x) => {
    const decoded = decodeSpaceImpact(
      frame({ objects: [{ picture: "enemy/round-wide/1", x, y: 8 }] }),
      { level: 0 },
    );
    expect(decoded.objects).toEqual([
      { picture: "enemy/round-wide/1", x, y: 8, width: 11, height: 5 },
    ]);
  });

  it("reads the ship and three enemies, including the clipped right enemy, in keys-tap-5", () => {
    const pixels = goldenImage("game/space-impact/keys-tap-5", "t0040").image.pixels;
    const decoded = decodeSpaceImpact(pixels, { level: 0 });
    expect(decoded.ship).toEqual({ picture: "ship", x: 5, y: 20, width: 10, height: 7 });
    expect(decoded.objects).toEqual(
      [42, 60, 78].map((x) => ({
        picture: "enemy/round-wide/1",
        x,
        y: 8,
        width: 11,
        height: 5,
      })),
    );
  });

  it.each(["ship", "ship/shielded/0", "ship/shielded/1", "ship/shielded/2"])(
    "reads a shot crossing the %s gun row by exact XOR",
    (picture) => {
      const shielded = picture !== "ship";
      const x = shielded ? 3 : 5,
        y = shielded ? 18 : 20;
      const objects = [
        { picture, x, y },
        { picture: "shot", x: 11, y: 23 },
      ];
      const decoded = decodeSpaceImpact(frame({ objects }), { level: 0 });
      expect(decoded.ship).toMatchObject({ picture, x, y });
      expect(decoded.objects).toEqual([{ picture: "shot", x: 11, y: 23, width: 2, height: 1 }]);
    },
  );

  it.each([
    ["d", "ship/shielded/1", [11]],
    ["h", "ship/shielded/0", [11, 17]],
  ] as const)("reads the captured gun-row XOR in level-0 %s", (name, picture, shots) => {
    const pixels = goldenImage("game/space-impact/level-0", name).image.pixels;
    const decoded = decodeSpaceImpact(pixels, { level: 0 });
    expect(decoded.ship).toMatchObject({ picture, x: 3, y: 18 });
    expect(decoded.objects).toEqual(
      shots.map((x) => ({ picture: "shot", x, y: 23, width: 2, height: 1 })),
    );
  });

  it("preserves its source pixels on success and failure", () => {
    const pixels = frame({ level: 2 });
    const original = pixels.slice();
    decodeSpaceImpact(pixels, { level: 2 });
    expect(pixels).toEqual(original);
    pixels[30 * 84 + 70] ^= 1;
    const damaged = pixels.slice();
    expect(() => decodeSpaceImpact(pixels, { level: 2 })).toThrow();
    expect(pixels).toEqual(damaged);
  });

  it("rejects an unread pixel rather than discarding it", () => {
    const pixels = frame();
    pixels[30 * 84 + 70] ^= 1;
    expect(() => decodeSpaceImpact(pixels, { level: 0 })).toThrow(/unread/);
  });

  it("rejects a one-pixel sprite corruption", () => {
    const pixels = frame();
    pixels[20 * 84 + 5] ^= 1;
    expect(() => decodeSpaceImpact(pixels, { level: 0 })).toThrow(/unread/);
  });

  it("rejects malformed HUD pixels and the HUD gap", () => {
    for (const index of [0, 40, 57, 5 * 84]) {
      const pixels = frame();
      pixels[index] ^= 1;
      expect(() => decodeSpaceImpact(pixels, { level: 0 })).toThrow(/HUD/);
    }
  });

  it("rejects two different exact object decompositions", () => {
    const objects = [
      { picture: "beam", x: 20, y: 6 },
      { picture: "beam", x: 21, y: 6 },
    ];
    expect(() => decodeSpaceImpact(frame({ objects }), { level: 0 })).toThrow(/ambiguous/);
  });

  it("rejects a second ship rather than silently selecting one", () => {
    const objects = [
      { picture: "ship", x: 5, y: 20 },
      { picture: "ship", x: 30, y: 20 },
    ];
    expect(() => decodeSpaceImpact(frame({ objects }), { level: 0 })).toThrow(/ship/);
  });

  it("validates frame shape, monochrome pixels, level and scroll", () => {
    expect(() => decodeSpaceImpact(new Uint8Array(10), { level: 0 })).toThrow(/84.*48/);
    const pixels = frame();
    pixels[10] = 2;
    expect(() => decodeSpaceImpact(pixels, { level: 0 })).toThrow(/monochrome/);
    for (const level of [-1, 8, 1.5])
      expect(() => decodeSpaceImpact(frame(), { level })).toThrow(/level/);
    for (const scroll of [-1, 1.5, NaN])
      expect(() => decodeSpaceImpact(frame(), { level: 0, scroll })).toThrow(/scroll/);
  });
});
