import { describe, expect, it } from "vite-plus/test";
import { extractSpaceImpactWaveInventory } from "../scripts/space-impact-waves";
import { extractSpaceImpactLevelObservations } from "../scripts/space-impact-levels";
import { loadGolden } from "./support/goldens";

describe("Space impact complete level-0 wave evidence", () => {
  it("accounts for the later movement families and preserves unresolved HP and edge identities", () => {
    const waves = extractSpaceImpactWaveInventory(loadGolden("game/space-impact/level-0"));
    expect(waves.tracks).toHaveLength(36);
    expect(new Set(waves.tracks.map((track) => track.family))).toEqual(
      new Set([
        "enemy/round-wide",
        "enemy/triangle",
        "enemy/round-small",
        "enemy/long-left",
        "bonus/orb",
        "boss/0",
      ]),
    );
    expect(waves.tracks.find((track) => track.entryStep === 90)).toMatchObject({
      dx: -1,
      x: 83,
      y: 17,
    });
    expect(
      waves.tracks
        .find((track) => track.entryStep === 219)
        ?.path.some((point) => point.ys.includes(7)),
    ).toBe(true);
    expect(waves.unresolved.map((event) => event.image)).toContain("qy");
    expect(waves.tracks.find((track) => track.family === "boss/0")?.hp).toEqual({
      kind: "unverified",
    });
    expect(waves.tracks.every((track) => track.specimens.length >= 2)).toBe(true);
  });
  it("accounts for every unambiguous complete ordinary-enemy observation across the level", () => {
    const golden = loadGolden("game/space-impact/level-0");
    const inventory = extractSpaceImpactWaveInventory(golden);
    const data = extractSpaceImpactLevelObservations(golden);
    const missing: string[] = [];
    for (const frame of data.frames) {
      if (frame.kind !== "decoded" || frame.candidates.length !== 1) continue;
      for (const index of frame.candidates[0]!.objects) {
        const object = data.objects[index]!;
        if (!object.picture.startsWith("enemy/") || object.x + object.width > 84) continue;
        if (
          !inventory.tracks.some((track) =>
            track.specimens.some(
              (sample) =>
                sample.image === frame.image &&
                sample.x === object.x &&
                sample.y === object.y &&
                sample.picture === object.picture,
            ),
          )
        )
          missing.push(`${frame.image}: ${object.picture} at ${object.x},${object.y}`);
      }
    }
    expect(missing).toEqual([]);
  });
  it("rejects a changed LCD pixel instead of fitting a path through corrupted evidence", () => {
    const golden = loadGolden("game/space-impact/level-0");
    const images = golden.images.map((image) => {
      if (image.name !== "gp") return image;
      const pixels = image.pixels.slice();
      pixels[0] ^= 1;
      return { ...image, pixels };
    });
    expect(() => extractSpaceImpactWaveInventory({ ...golden, images })).toThrow(
      /unread settled observation/,
    );
  });
});
