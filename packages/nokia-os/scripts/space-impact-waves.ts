import type { Golden } from "./golden-format.ts";
import { observedSpaceImpactInput } from "./space-impact-delivery.ts";
import { extractSpaceImpactLevelObservations } from "./space-impact-levels.ts";
import { resourceModule, type GeneratedResourceModule } from "./resource-declarations.ts";

type WaveDefinition = readonly [
  family: string,
  entryStep: number,
  x: number,
  y: number | null,
  dx: number,
  motion: "flat" | "observed",
];

// Entry steps count delivered callbacks, not an assumed wall-clock or scroll phase.
const WAVES: readonly WaveDefinition[] = [
  ...[20, 29, 38].map((step): WaveDefinition => ["enemy/round-wide", step, 82, 8, -2, "flat"]),
  ...[55, 64].map((step): WaveDefinition => ["enemy/round-wide", step, 82, 17, -2, "flat"]),
  ...[90, 108].map((step): WaveDefinition => ["enemy/round-wide", step, 83, 17, -1, "flat"]),
  ...[125, 134, 143].map((step): WaveDefinition => ["enemy/round-wide", step, 82, 29, -2, "flat"]),
  ...[144, 158].map((step): WaveDefinition => ["enemy/round-wide", step, 82, 9, -2, "flat"]),
  ...[219, 237, 255, 273].map(
    (step): WaveDefinition => ["enemy/triangle", step, 83, 6, -1, "observed"],
  ),
  ...[265, 283].map((step): WaveDefinition => ["enemy/triangle", step, 83, null, -1, "observed"]),
  ["enemy/round-small", 399, 82, 12, -2, "flat"],
  ["enemy/round-small", 406, 83, 12, -2, "flat"],
  ...[444, 459, 489].map(
    (step): WaveDefinition => ["enemy/round-small", step, 83, null, -1, "observed"],
  ),
  ...[509, 528, 547, 566].map(
    (step): WaveDefinition => ["enemy/round-small", step, 83, 6, -1, "observed"],
  ),
  ["enemy/long-left", 659, 82, 5, -2, "flat"],
  ["enemy/long-left", 669, 83, 14, -1, "flat"],
  ["enemy/long-left", 676, 83, 8, -1, "flat"],
  ["enemy/long-left", 686, 82, 38, -2, "flat"],
  ["bonus/orb", 149, 82, 9, -2, "flat"],
  ["bonus/orb", 609, 83, 24, -1, "flat"],
  ["boss/0", 700, 83, 12, -1, "observed"],
];

export function extractSpaceImpactWaveInventory(golden: Golden) {
  const data = extractSpaceImpactLevelObservations(golden);
  const steps = observedSpaceImpactInput(golden.note).filter((event) => event.kind === "step");
  const frames = data.frames.flatMap((frame) => {
    if (frame.kind !== "decoded") return [];
    // A settled LCD write may precede completion of the next delivered callback.
    const step = steps.filter((event) => event.atMs <= frame.startMs).length;
    return [{ frame, steps: [step, step - 1] }];
  });
  const tracks = WAVES.map(([family, entryStep, x, y, dx, motion]) => {
    let previous: typeof data.objects = [];
    const specimens = frames.flatMap(({ frame, steps }) => {
      const objects = [...new Set(frame.candidates.flatMap((candidate) => candidate.objects))]
        .map((index) => data.objects[index]!)
        .filter(
          (object) =>
            object.picture.replace(/\/\d+$/, "") === family &&
            (motion !== "flat" || object.y === y) &&
            (steps.some(
              (step) =>
                step >= entryStep &&
                object.x ===
                  (family === "boss/0"
                    ? Math.max(56, x + dx * (step - entryStep))
                    : x + dx * (step - entryStep)),
            ) ||
              previous.some(
                (sample) =>
                  sample.x === object.x &&
                  sample.y === object.y &&
                  sample.picture === object.picture,
              )),
        );
      previous = objects;
      return objects.map((object) => ({
        image: frame.image,
        x: object.x,
        y: object.y,
        picture: object.picture,
      }));
    });
    const unique = [
      ...new Map(specimens.map((sample) => [JSON.stringify(sample), sample])).values(),
    ];
    if (new Set(unique.map((sample) => sample.image)).size < 2)
      throw new Error(
        `level-0 waves: insufficient independent specimens for ${family} at ${entryStep}`,
      );
    const columns = new Map<number, Set<number>>();
    for (const sample of unique) {
      const ys = columns.get(sample.x) ?? new Set<number>();
      ys.add(sample.y);
      columns.set(sample.x, ys);
    }
    const path = [...columns]
      .sort(([a], [b]) => b - a)
      .map(([x, ys]) => ({ x, ys: [...ys].sort((a, b) => a - b) }));
    return {
      family,
      entryStep,
      x,
      y,
      dx,
      motion,
      path,
      hp:
        family === "enemy/round-wide" && entryStep <= 143
          ? { kind: "exact" as const, value: 1 }
          : { kind: "unverified" as const },
      specimens: unique,
    };
  });
  const unresolved = ["qy", "td", "vi"].map((image) => {
    const frame = data.frames.find((frame) => frame.image === image);
    if (frame?.kind !== "decoded") throw new Error(`level-0 waves: missing edge event ${image}`);
    return {
      image,
      score: frame.hud.score,
      reason:
        "UNVERIFIED: clipped entry/kill attribution and HP require engine replay; retain LCD alternatives.",
    };
  });
  return {
    source: golden.id,
    interpretation:
      "UNVERIFIED until engine replay: later entry-step attribution, nonlinear path associations and HP. Spatial samples retain LCD alternatives; no seed or fire rule is inferred.",
    tracks,
    unresolved,
  };
}

export const spaceImpactWaveInventoryModule: GeneratedResourceModule = {
  file: "space-impact-waves.ts",
  extract: ({ golden }) =>
    resourceModule(
      "SPACE_IMPACT_WAVE_INVENTORY",
      "{ readonly source: string; readonly interpretation: string; readonly tracks: readonly { readonly family: string; readonly entryStep: number; readonly x: number; readonly y: number | null; readonly dx: number; readonly motion: 'flat' | 'observed'; readonly path: readonly { readonly x: number; readonly ys: readonly number[] }[]; readonly hp: { readonly kind: 'exact'; readonly value: number } | { readonly kind: 'unverified' }; readonly specimens: readonly { readonly image: string; readonly x: number; readonly y: number; readonly picture: string }[] }[]; readonly unresolved: readonly { readonly image: string; readonly score: number; readonly reason: string }[] }",
      extractSpaceImpactWaveInventory(golden("game/space-impact/level-0")),
    ),
};
