import { describe, expect, it } from "vite-plus/test";
import { SPACE_IMPACT_DATA } from "@hellotimber/nokia-kit/ui/resources/generated/space-impact";
import {
  decodeSpaceImpact,
  decodeSpaceImpactCandidates,
  type DecodedSpaceImpact,
} from "./support/space-impact-decode.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";
import {
  extractSpaceImpactLevelObservations,
  fitSpaceImpactLinearPath,
  trackSpaceImpactLinearSegment,
} from "../scripts/space-impact-levels.ts";

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

function repaint(candidate: DecodedSpaceImpact, level: number, scroll = 0) {
  const pixels = frame({ level, ...candidate.hud, scroll, objects: [] });
  for (const object of [...(candidate.ship ? [candidate.ship] : []), ...candidate.objects]) {
    const art = sprites[object.picture]!;
    for (const [dy, row] of art.entries())
      for (const [dx, char] of row.split("").entries()) {
        const x = object.x + dx,
          y = object.y + dy;
        if (char !== "#" || x < 0 || x >= 84 || y < 0 || y >= 48) continue;
        if ([0, 4, 5].includes(level)) pixels[y * 84 + x] ^= 1;
        else pixels[y * 84 + x] = 1;
      }
  }
  return pixels;
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
    const pixels = frame({ objects: [{ picture, x: 20, y: 6 }] });
    const candidates = decodeSpaceImpactCandidates(pixels, { level: 0 });
    const object = { picture, x: 20, y: 6, width: art[0]!.length, height: art.length };
    expect(
      candidates.some((candidate) =>
        picture === "ship" || picture.startsWith("ship/")
          ? JSON.stringify(candidate.ship) === JSON.stringify(object) &&
            candidate.objects.length === 0
          : candidate.ship === null &&
            JSON.stringify(candidate.objects) === JSON.stringify([object]),
      ),
    ).toBe(true);
    for (const candidate of candidates) expect(repaint(candidate, 0)).toEqual(pixels);
    if (candidates.length > 1)
      expect(() => decodeSpaceImpact(pixels, { level: 0 })).toThrow(/ambiguous/);
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

  it("preserves both exact white-background shot positions for temporal resolution", () => {
    const pixels = goldenImage("game/space-impact/level-1", "c").image.pixels;
    const candidates = decodeSpaceImpactCandidates(pixels, { level: 1, scroll: 0 });
    expect(candidates).toHaveLength(2);
    expect(candidates.map((candidate) => candidate.objects)).toEqual([
      [{ picture: "shot", x: 11, y: 23, width: 2, height: 1 }],
      [{ picture: "shot", x: 12, y: 23, width: 2, height: 1 }],
    ]);
    expect(() => decodeSpaceImpact(pixels, { level: 1, scroll: 0 })).toThrow(/ambiguous/);
  });

  it.each([4, 5])("reads the captured off-gun-row shot in level %i e", (level) => {
    const pixels = goldenImage(`game/space-impact/level-${level}`, "e").image.pixels;
    const decoded = decodeSpaceImpact(pixels, { level, scroll: 1 });
    expect(decoded.ship).toMatchObject({ picture: "ship/shielded/2", x: 3, y: 16 });
    expect(decoded.objects).toEqual([{ picture: "shot", x: 13, y: 22, width: 2, height: 1 }]);
  });

  it("retains every exact interpretation of the level-0 ac frame", () => {
    const pixels = goldenImage("game/space-impact/level-0", "ac").image.pixels;
    const candidates = decodeSpaceImpactCandidates(pixels, { level: 0 });
    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates.every((candidate) => candidate.ship?.picture === "ship/shielded/0")).toBe(
      true,
    );
    expect(() => decodeSpaceImpact(pixels, { level: 0 })).toThrow(/ambiguous/);
  });

  it("does not manufacture duplicate cancelling shots across a consumed ship rectangle", () => {
    const pixels = goldenImage("game/space-impact/keys-tap-5", "t0040").image.pixels;
    const candidates = decodeSpaceImpactCandidates(pixels, { level: 0 });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.objects.every((object) => object.picture !== "shot")).toBe(true);
  });

  it.each([1, 2, 3, 6, 7])(
    "proves white-background shot union from independent level %i LCDs",
    (level) => {
      const image = level === 2 ? "e" : "c";
      const pixels = goldenImage(`game/space-impact/level-${level}`, image).image.pixels;
      const candidates = decodeSpaceImpactCandidates(pixels, { level });
      expect(candidates).toHaveLength(2);
      expect(candidates.map((candidate) => candidate.ship?.picture)).toEqual([
        "ship/shielded/1",
        "ship/shielded/1",
      ]);
      expect(candidates.map((candidate) => candidate.objects)).toEqual([
        [{ picture: "shot", x: 11, y: 23, width: 2, height: 1 }],
        [{ picture: "shot", x: 12, y: 23, width: 2, height: 1 }],
      ]);
    },
  );

  it.each([0, 1, 2, 4, 5, 6, 7])(
    "reconstructs a synthetic shot away from level %i's moving gun row",
    (level) => {
      const objects = [
        { picture: "ship/shielded/2", x: 3, y: 16 },
        { picture: "shot", x: 13, y: 22 },
      ];
      const pixels = frame({ level, objects: [objects[0]!] });
      const inverted = [0, 4, 5].includes(level);
      for (const x of [13, 14]) pixels[22 * 84 + x] = inverted ? pixels[22 * 84 + x]! ^ 1 : 1;
      const candidates = decodeSpaceImpactCandidates(pixels, { level, scroll: 0 });
      expect(
        candidates.every(
          (candidate) =>
            candidate.ship?.picture === objects[0]!.picture &&
            candidate.ship.x === 3 &&
            candidate.ship.y === 16,
        ),
      ).toBe(true);
      const expected = inverted
        ? [[{ picture: "shot", x: 13, y: 22, width: 2, height: 1 }]]
        : [
            [
              { picture: "shot", x: 12, y: 22, width: 2, height: 1 },
              { picture: "shot", x: 14, y: 22, width: 2, height: 1 },
            ],
            [{ picture: "shot", x: 13, y: 22, width: 2, height: 1 }],
          ];
      expect(candidates.map((candidate) => candidate.objects)).toEqual(expected);
      if (!inverted)
        expect(() => decodeSpaceImpact(pixels, { level, scroll: 0 })).toThrow(/ambiguous/);
    },
  );

  it.each([
    [
      3,
      "f",
      2,
      "ship/shielded/1",
      3,
      18,
      [
        [11, 23],
        [15, 23],
      ],
    ],
    [
      4,
      "g",
      2,
      "ship/shielded/1",
      3,
      16,
      [
        [11, 21],
        [15, 22],
      ],
    ],
    [5, "f", 2, "ship/shielded/1", 3, 15, [[15, 22]]],
  ] as const)(
    "decodes multiple captured shots over the ship in level %i %s",
    (level, name, scroll, picture, x, y, shots) => {
      const pixels = goldenImage(`game/space-impact/level-${level}`, name).image.pixels;
      const candidates = decodeSpaceImpactCandidates(pixels, { level, scroll });
      expect(
        candidates.some(
          (candidate) =>
            candidate.ship?.picture === picture &&
            candidate.ship.x === x &&
            candidate.ship.y === y &&
            shots.every(([sx, sy]) =>
              candidate.objects.some(
                (object) => object.picture === "shot" && object.x === sx && object.y === sy,
              ),
            ),
        ),
      ).toBe(true);
    },
  );

  it("decodes the captured shot crossing the final explosion picture", () => {
    const candidates = decodeSpaceImpactCandidates(
      goldenImage("game/space-impact/level-0", "bk").image.pixels,
      { level: 0 },
    );
    expect(
      candidates.some(
        (candidate) =>
          candidate.objects.some(
            (object) =>
              object.picture === "explosion/spark/0" && object.x === 34 && object.y === 10,
          ) &&
          candidate.objects.some(
            (object) => object.picture === "shot" && object.x === 33 && object.y === 10,
          ),
      ),
    ).toBe(true);
  });

  it.each([
    [0, "bk", 0],
    [1, "t", 19],
    [1, "bh", 50],
    [2, "bn", 49],
    [3, "f", 2],
    [4, "g", 2],
    [5, "f", 2],
    [6, "ab", 19],
    [7, "aa", 20],
  ] as const)("repaints every layer candidate exactly in level %i %s", (level, name, scroll) => {
    const pixels = goldenImage(`game/space-impact/level-${level}`, name).image.pixels;
    const candidates = decodeSpaceImpactCandidates(pixels, { level, scroll });
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) expect(repaint(candidate, level, scroll)).toEqual(pixels);
  });

  it.each([
    ["go", 72, 82, "enemy/round-wide/0", "bonus/orb/1"],
    ["gp", 70, 80, "enemy/round-wide/1", "bonus/orb/0"],
    ["gq", 68, 78, "enemy/round-wide/0", "bonus/orb/1"],
    ["gr", 66, 76, "enemy/round-wide/1", "bonus/orb/0"],
  ] as const)("reads the captured enemy/orb overlap in level-0 %s", (name, ex, bx, enemy, orb) => {
    const pixels = goldenImage("game/space-impact/level-0", name).image.pixels;
    const candidates = decodeSpaceImpactCandidates(pixels, { level: 0 });
    expect(
      candidates.some(
        (candidate) =>
          candidate.objects.some(
            (object) => object.picture === enemy && object.x === ex && object.y === 9,
          ) &&
          candidate.objects.some(
            (object) => object.picture === orb && object.x === bx && object.y === 9,
          ),
      ),
    ).toBe(true);
    for (const candidate of candidates) expect(repaint(candidate, 0)).toEqual(pixels);
  });

  it.each(["ih", "ii", "ij"])("reads the orb crossing the ship rectangle in level-0 %s", (name) => {
    const pixels = goldenImage("game/space-impact/level-0", name).image.pixels;
    const candidates = decodeSpaceImpactCandidates(pixels, { level: 0 });
    expect(
      candidates.some(
        (candidate) =>
          candidate.ship?.picture === "ship" &&
          candidate.objects.some((object) => object.picture.startsWith("bonus/orb/")),
      ),
    ).toBe(true);
    for (const candidate of candidates) expect(repaint(candidate, 0)).toEqual(pixels);
  });

  it.each(["aet", "aeu", "aev"])("reads the enemy crossing the HUD gap in level-0 %s", (name) => {
    const pixels = goldenImage("game/space-impact/level-0", name).image.pixels;
    const candidates = decodeSpaceImpactCandidates(pixels, { level: 0 });
    expect(
      candidates.some((candidate) =>
        candidate.objects.some(
          (object) => object.picture === "enemy/long-left/0" && object.y === 5,
        ),
      ),
    ).toBe(true);
    for (const candidate of candidates) expect(repaint(candidate, 0)).toEqual(pixels);
  });

  it.each(["ahx", "ahy"])("reads a captured shot crossing the level-0 boss in %s", (name) => {
    const pixels = goldenImage("game/space-impact/level-0", name).image.pixels;
    const candidates = decodeSpaceImpactCandidates(pixels, { level: 0 });
    expect(
      candidates.some(
        (candidate) =>
          candidate.objects.some(
            (object) => object.picture === "boss/0/0" && object.x === 58 && object.y === 12,
          ) &&
          candidate.objects.some(
            (object) => object.picture === "shot" && object.x === 61 && object.y === 16,
          ),
      ),
    ).toBe(true);
    for (const candidate of candidates) expect(repaint(candidate, 0)).toEqual(pixels);
  });

  it("reads the captured ship/orb ink crossing immediately before pickup", () => {
    const pixels = goldenImage("game/space-impact/level-0", "afo").image.pixels;
    const candidates = decodeSpaceImpactCandidates(pixels, { level: 0 });
    expect(
      candidates.some(
        (candidate) =>
          candidate.ship?.picture === "ship" &&
          candidate.ship.x === 5 &&
          candidate.ship.y === 24 &&
          candidate.objects.some(
            (object) => object.picture === "bonus/orb/0" && object.x === 14 && object.y === 24,
          ),
      ),
    ).toBe(true);
    for (const candidate of candidates) expect(repaint(candidate, 0)).toEqual(pixels);
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

describe("Space impact linear segment reconstruction", () => {
  const enemy = (x: number, picture = "enemy/round-wide/0", y = 8) => ({
    picture,
    x,
    y,
    width: 11,
    height: 5,
  });
  const motions = [{ family: "enemy/round-wide", dx: -2, dy: 0 }];

  it("links repeated enemies across animation changes and reordered observations", () => {
    const frames = [
      { tick: 0, candidates: [[enemy(42), enemy(60)]] },
      { tick: 1, candidates: [[enemy(58, "enemy/round-wide/1"), enemy(40, "enemy/round-wide/1")]] },
    ];
    const graph = trackSpaceImpactLinearSegment(frames, motions);
    expect(graph[1]![0]!.predecessors).toEqual([
      {
        candidate: 0,
        links: [
          { from: 0, to: 1 },
          { from: 1, to: 0 },
        ],
        entries: [],
        exits: [],
      },
    ]);
  });

  it("tracks the captured enemy/orb pair through its clipped entry without merging their identities", () => {
    const frames = ["gn", "go", "gp", "gq", "gr"].map((name, tick) => {
      const candidates = decodeSpaceImpactCandidates(
        goldenImage("game/space-impact/level-0", name).image.pixels,
        { level: 0 },
      ).map((candidate) =>
        candidate.objects.filter(
          (object) =>
            object.picture.startsWith("bonus/orb/") ||
            (object.picture.startsWith("enemy/round-wide/") && object.y === 9),
        ),
      );
      return {
        tick,
        candidates: [
          ...new Map(candidates.map((objects) => [JSON.stringify(objects), objects])).values(),
        ],
      };
    });
    const graph = trackSpaceImpactLinearSegment(frames, [
      { family: "enemy/round-wide", dx: -2, dy: 0 },
      { family: "bonus/orb", dx: -2, dy: 0 },
    ]);
    expect(graph.map((nodes) => nodes.length)).toEqual([1, 1, 1, 1, 1]);
    expect(graph[1]![0]!.predecessors).toEqual([
      { candidate: 0, links: [{ from: 0, to: 0 }], entries: [1], exits: [] },
    ]);
    for (const nodes of graph.slice(2))
      expect(nodes[0]!.predecessors).toEqual([
        {
          candidate: 0,
          links: [
            { from: 0, to: 0 },
            { from: 1, to: 1 },
          ],
          entries: [],
          exits: [],
        },
      ]);
    expect(
      fitSpaceImpactLinearPath(
        graph.slice(1).map(([node]) => ({
          tick: node!.tick,
          object: node!.objects[1]!,
        })),
      ),
    ).toEqual({ family: "bonus/orb", startTick: 1, endTick: 4, x: 82, y: 9, dx: -2, dy: 0 });
  });

  it("uses later motion to eliminate an ambiguous white-background shot position", () => {
    const pixels = goldenImage("game/space-impact/level-1", "c").image.pixels;
    const objects = decodeSpaceImpactCandidates(pixels, { level: 1, scroll: 0 }).map(
      (c) => c.objects,
    );
    const graph = trackSpaceImpactLinearSegment(
      [
        { tick: 0, candidates: objects },
        { tick: 2, candidates: [[{ picture: "shot", x: 15, y: 23, width: 2, height: 1 }]] },
      ],
      [{ family: "shot", dx: 2, dy: 0 }],
    );
    expect(graph[0]).toHaveLength(1);
    expect(graph[0]![0]!.objects[0]!.x).toBe(11);
  });

  it("keeps unresolved entry pictures explicit while linking their object", () => {
    const graph = trackSpaceImpactLinearSegment(
      [
        { tick: 0, candidates: [[]] },
        { tick: 1, candidates: [[enemy(82)], [enemy(82, "enemy/round-wide/1")]] },
        { tick: 2, candidates: [[enemy(80)]] },
      ],
      motions,
    );
    expect(graph[1]).toHaveLength(2);
    expect(graph[1]!.map((node) => node.predecessors[0]!.entries)).toEqual([[0], [0]]);
    expect(graph[2]![0]!.predecessors.map((edge) => edge.candidate)).toEqual([0, 1]);
  });

  it("recognizes a fully clipped exit and does not label it a kill", () => {
    const graph = trackSpaceImpactLinearSegment(
      [
        { tick: 0, candidates: [[enemy(-9)]] },
        { tick: 1, candidates: [[]] },
      ],
      motions,
    );
    expect(graph[1]![0]!.predecessors[0]!.exits).toEqual([0]);
  });

  it("refuses interior births and disappearances without collision evidence", () => {
    for (const candidates of [
      [[], [enemy(40)]],
      [[enemy(40)], []],
    ]) {
      expect(() =>
        trackSpaceImpactLinearSegment(
          candidates.map((objects, tick) => ({ tick, candidates: [objects] })),
          motions,
        ),
      ).toThrow(/no consistent.*tick 1/);
    }
  });

  it("refuses uncovered motion families and invalid tick order", () => {
    expect(() =>
      trackSpaceImpactLinearSegment([{ tick: 0, candidates: [[enemy(40)]] }], []),
    ).toThrow(/motion.*enemy\/round-wide/);
    expect(() =>
      trackSpaceImpactLinearSegment(
        [
          { tick: 1, candidates: [[enemy(40)]] },
          { tick: 1, candidates: [[enemy(38)]] },
        ],
        motions,
      ),
    ).toThrow(/increasing/);
  });

  it("rejects a one-pixel motion mismatch instead of selecting the nearest object", () => {
    expect(() =>
      trackSpaceImpactLinearSegment(
        [
          { tick: 0, candidates: [[enemy(40)]] },
          { tick: 1, candidates: [[enemy(39)]] },
        ],
        motions,
      ),
    ).toThrow(/no consistent/);
  });

  it("tracks three captured enemies tick by tick and fits their independent LCD positions", () => {
    const frames = [40, 41, 42].map((tick) => ({
      tick,
      candidates: decodeSpaceImpactCandidates(
        goldenImage("game/space-impact/keys-tap-5", `t00${tick}`).image.pixels,
        { level: 0 },
      ).map((candidate) => candidate.objects),
    }));
    const graph = trackSpaceImpactLinearSegment(frames, motions);
    expect(graph.map((nodes) => nodes.length)).toEqual([1, 1, 1]);
    for (const nodes of graph.slice(1))
      expect(nodes[0]!.predecessors).toEqual([
        {
          candidate: 0,
          links: [
            { from: 0, to: 0 },
            { from: 1, to: 1 },
            { from: 2, to: 2 },
          ],
          entries: [],
          exits: [],
        },
      ]);
    expect(
      [0, 1, 2].map((index) =>
        fitSpaceImpactLinearPath(
          graph.map((nodes) => ({ tick: nodes[0]!.tick, object: nodes[0]!.objects[index]! })),
        ),
      ),
    ).toEqual(
      [42, 60, 78].map((x) => ({
        family: "enemy/round-wide",
        startTick: 40,
        endTick: 42,
        x,
        y: 8,
        dx: -2,
        dy: 0,
      })),
    );
  });

  it("remaps predecessor indices after backwards candidate pruning", () => {
    const graph = trackSpaceImpactLinearSegment(
      [
        { tick: 0, candidates: [[enemy(61)], [enemy(60)]] },
        { tick: 1, candidates: [[enemy(59)], [enemy(58)]] },
        { tick: 2, candidates: [[enemy(56)]] },
      ],
      motions,
    );
    expect(graph.map((nodes) => nodes.map((node) => node.sourceCandidate))).toEqual([
      [1],
      [1],
      [0],
    ]);
    for (const nodes of graph.slice(1)) expect(nodes[0]!.predecessors[0]!.candidate).toBe(0);
  });

  it("validates motion evidence and input observations", () => {
    expect(() => trackSpaceImpactLinearSegment([], motions)).toThrow(/empty/);
    expect(() => trackSpaceImpactLinearSegment([{ tick: 0, candidates: [] }], motions)).toThrow(
      /candidates/,
    );
    expect(() => trackSpaceImpactLinearSegment([{ tick: -1, candidates: [[]] }], motions)).toThrow(
      /ticks/,
    );
    for (const invalid of [
      [...motions, ...motions],
      [{ family: "enemy/round-wide", dx: 0.5, dy: 0 }],
    ])
      expect(() => trackSpaceImpactLinearSegment([{ tick: 0, candidates: [[]] }], invalid)).toThrow(
        /motion/,
      );
    for (const objects of [[{ ...enemy(40), width: 0 }], [enemy(40), enemy(40)], [enemy(84)]])
      expect(() =>
        trackSpaceImpactLinearSegment([{ tick: 0, candidates: [objects] }], motions),
      ).toThrow(/object/);
  });

  it("fits a linear track with exact positions, including missing linear ticks", () => {
    expect(
      fitSpaceImpactLinearPath([
        { tick: 4, object: enemy(72) },
        { tick: 6, object: enemy(68) },
        { tick: 9, object: enemy(62) },
      ]),
    ).toEqual({ family: "enemy/round-wide", startTick: 4, endTick: 9, x: 72, y: 8, dx: -2, dy: 0 });
  });

  it("refuses curved, fractional, mixed-type and underdetermined linear fits", () => {
    for (const samples of [
      [{ tick: 0, object: enemy(72) }],
      [
        { tick: 0, object: enemy(72) },
        { tick: 2, object: enemy(71) },
      ],
      [
        { tick: 0, object: enemy(72) },
        { tick: 1, object: enemy(70) },
        { tick: 2, object: enemy(69) },
      ],
      [
        { tick: 0, object: enemy(72) },
        { tick: 1, object: enemy(70, "enemy/triangle/0") },
      ],
    ])
      expect(() => fitSpaceImpactLinearPath(samples)).toThrow(/linear|family/);
  });
});

describe("observed level-0 resource", () => {
  it("retains the independent LCD alternatives instead of selecting the first reading", () => {
    const golden = loadGolden("game/space-impact/level-0");
    const image = golden.images.find((image) => image.name === "ac")!;
    const row = golden.timeline!.find((row) => row.image === "ac")!;
    const observed = extractSpaceImpactLevelObservations({
      ...golden,
      images: [image],
      timeline: [{ ...row, durationMs: 93 }],
    });
    expect(observed.frames).toHaveLength(1);
    expect(observed.frames[0]).toMatchObject({ kind: "decoded", image: "ac" });
    const frame = observed.frames[0]!;
    if (frame.kind !== "decoded") throw new Error("expected decoded LCD evidence");
    const candidates = decodeSpaceImpactCandidates(image.pixels, { level: 0 });
    const unpacked = frame.candidates.map((candidate) => ({
      hud: frame.hud,
      terrain: { kind: "none" as const },
      ship: candidate.ship === null ? null : observed.objects[candidate.ship]!,
      objects: candidate.objects.map((index) => observed.objects[index]!),
    }));
    expect(unpacked).toEqual(candidates);
    expect(candidates.length).toBeGreaterThan(1);
    for (const candidate of unpacked) expect(repaint(candidate, 0)).toEqual(image.pixels);
  });

  it("rejects an unread settled image instead of inventing a runtime object", () => {
    const golden = loadGolden("game/space-impact/level-0");
    const row = golden.timeline!.find((row) => row.image === "b")!;
    expect(() =>
      extractSpaceImpactLevelObservations({
        ...golden,
        images: [{ name: "b", pixels: new Uint8Array(4032) }],
        timeline: [{ ...row, durationMs: 93 }],
      }),
    ).toThrow(/level-0 b: unread settled observation/);
  });
  it("does not relabel a corrupted ala image as the observed mixed redraw", () => {
    const golden = loadGolden("game/space-impact/level-0");
    const row = golden.timeline!.find((row) => row.image === "ala")!;
    expect(() =>
      extractSpaceImpactLevelObservations({
        ...golden,
        images: [
          ...golden.images.filter((image) => image.name !== "ala"),
          { name: "ala", pixels: new Uint8Array(4032) },
        ],
        timeline: [row],
      }),
    ).toThrow(/no longer the established mixed boss redraw/);
  });
});
