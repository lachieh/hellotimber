import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { recoverSpaceImpactLevelZero } from "../scripts/space-impact-seed-recovery";
import { loadGolden } from "./support/goldens";

const level = loadGolden("game/space-impact/level-0");
const exit = loadGolden("game/space-impact/level-0.exit");
const derivation: unknown = JSON.parse(
  readFileSync(new URL("./fixtures/space-impact-seed-recovery.json", import.meta.url), "utf8"),
);
if (
  typeof derivation !== "object" ||
  derivation === null ||
  !("countedOrder" in derivation) ||
  !("extraSilentRoll" in derivation)
)
  throw new Error("Missing conditional seed derivation");

describe("Space impact joint LCD seed recovery", () => {
  it("fits both pickups, every boss roll and the boss destruction from committed LCDs", () => {
    const report = recoverSpaceImpactLevelZero(level, exit);
    expect(report.effectiveSeeds).toEqual([44530]);
    expect(report.models).toEqual([{ seed: 44530, fireDenominator: 40 }]);
    expect(report.pickups.map((event) => event.image)).toEqual(["ik", "afp"]);
    expect(report.boss.shots.map((event) => [event.step, event.y])).toEqual([
      [746, 29],
      [788, 33],
    ]);
    expect(report.boss.rolls).toBe(69);
    expect(report.checkpoints).toHaveLength(94);
    expect(report.burst.map((event) => event.image)).toEqual(["a", "b", "c", "d", "e"]);
    expect(report.u32Aliases).toBe(65551);
    expect(report).toEqual(derivation.countedOrder);
  });

  it.each([
    { silentFireRolls: 0 },
    { silentFireRolls: 17 },
    { pickupBeforeSilentRolls: true },
    { bossStartOffset: -1 },
    { bossStartOffset: 1 },
  ])("tests an alternative consumer-order hypothesis: %j", (hypothesis) => {
    expect(recoverSpaceImpactLevelZero(level, exit, hypothesis).effectiveSeeds).toEqual([]);
  });

  it("preserves the extra-hidden-roll counterexample instead of claiming LCD-only order recovery", () => {
    const alternative = recoverSpaceImpactLevelZero(level, exit, { silentFireRolls: 19 });
    expect(alternative.models).toEqual([{ seed: 59408, fireDenominator: 40 }]);
    expect(alternative).toEqual(derivation.extraSilentRoll);
  });

  it("rejects a changed destruction pixel without changing the comparison", () => {
    const images = exit.images.map((image) => {
      if (image.name !== "b") return image;
      const pixels = image.pixels.slice();
      pixels[25 * 84 + 63] ^= 1;
      return { ...image, pixels };
    });
    expect(recoverSpaceImpactLevelZero(level, { ...exit, images }).effectiveSeeds).toEqual([]);
  });
});
