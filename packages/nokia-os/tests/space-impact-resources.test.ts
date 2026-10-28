import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import type { Golden } from "../scripts/golden-format.ts";
import {
  extractSpaceImpactResources,
  extractSpaceImpactSprites,
  spaceImpactResourceModule,
  SPACE_IMPACT_CROPS,
} from "../scripts/space-impact-resources.ts";
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

const fresh = () => extractSpaceImpactResources(loadGolden);

describe("Space impact HUD and ship resources", () => {
  it("extracts independently read ship, heart, weapon and continue pictures", () => {
    const { sprites } = fresh();
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
    expect(Object.keys(fresh().sprites)).toHaveLength(14);
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
    expect(fresh().timings).toEqual({
      tickMs: 93,
      firstTickMs: 173,
      continueHoldMs: 1548,
      continueStepMs: 775,
      continueZeroMs: 856,
    });
  });
  it("cross-checks the independently measured 12-unit game tick and 100-unit countdown", () => {
    const { timings: t } = fresh();
    expect(t.tickMs).toBeCloseTo((t.continueStepMs * 12) / 100, 0);
    expect(Math.abs(t.continueHoldMs - 2 * t.continueStepMs)).toBeLessThan(4);
  });
  it("rejects incomplete countdown evidence rather than inventing a duration", () => {
    expect(() =>
      extractSpaceImpactResources((id) => {
        const golden = loadGolden(id);
        return id.endsWith("nokeys")
          ? { ...golden, timeline: golden.timeline?.slice(0, 20) }
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
