import { describe, expect, it } from "vite-plus/test";
import { loadGolden } from "./support/goldens";
import { expectSpaceImpactLevel } from "./support/space-impact-replay";
import { samePixels, TWO_FRAMES_MS } from "./support/golden";

const original = loadGolden("game/space-impact/level-0");
const replay = loadGolden("game/space-impact/level-0.replay");

describe("Space impact complete level-0 output", () => {
  it("replays every settled output and its timing with the shared fidelity rule", () => {
    expectSpaceImpactLevel(replay);
  });

  it("retains every original image in the independent dense capture", () => {
    for (const image of original.images)
      expect(
        replay.images.some((next) => samePixels(image.pixels, next.pixels)),
        image.name,
      ).toBe(true);
  });

  it("measures the mixed boss redraw as a partial image rather than a settled frame", () => {
    const mixed = original.images.find((image) => image.name === "ala")!;
    const rows = replay.timeline!.filter((row) =>
      samePixels(replay.images.find((image) => image.name === row.image)!.pixels, mixed.pixels),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.durationMs).toBe(15);
    expect(rows[0]!.durationMs).toBeLessThan(TWO_FRAMES_MS);
  });

  it("rejects the original recorder's censored output sequence", () => {
    expect(() => expectSpaceImpactLevel(original)).toThrow(/Timeline mismatch/);
  });
});
