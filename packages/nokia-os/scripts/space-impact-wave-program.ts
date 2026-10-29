import { extractSpaceImpactWaveInventory } from "./space-impact-waves.ts";
import { extractSpaceImpactLevelObservations } from "./space-impact-levels.ts";
import { resourceModule, type GeneratedResourceModule } from "./resource-declarations.ts";
import type { Golden } from "./golden-format.ts";

export function extractSpaceImpactWaveProgram(golden: Golden) {
  const inventory = extractSpaceImpactWaveInventory(golden);
  const observations = extractSpaceImpactLevelObservations(golden);
  const source = (step: number) => {
    const track = inventory.tracks.find((track) => track.entryStep === step);
    if (!track) throw new Error(`Missing Space impact wave ${step}`);
    return track;
  };
  const groups = [
    { step: 219, count: 4, spacing: 18, motion: "descend", hp: 2 },
    { step: 229, count: 4, spacing: 18, motion: "wave", hp: 2 },
    { step: 399, count: 2, spacing: 15, motion: "straight", hp: 1 },
    { step: 444, count: 5, spacing: 15, motion: "wave", hp: 1 },
    { step: 509, count: 4, spacing: 19, motion: "slope", hp: 1 },
    { step: 659, count: 1, spacing: 0, motion: "straight", hp: 1 },
    { step: 669, count: 1, spacing: 0, motion: "straight", hp: 4 },
    { step: 676, count: 1, spacing: 0, motion: "straight", hp: 1 },
    { step: 686, count: 1, spacing: 0, motion: "straight", hp: 1 },
    { step: 700, count: 1, spacing: 0, motion: "boss", hp: 25 },
  ].map(({ step, count, spacing, motion, hp }) => {
    const track = source(step);
    const start = step === 444 ? 429 : step;
    return {
      tick: start - 1,
      family: track.family,
      x: track.x,
      y: track.y ?? 19,
      dx: track.dx,
      count,
      spacing,
      motion,
      hp,
      fireDenominator: step === 444 ? 2 : step === 700 ? 40 : 0,
      shots: step === 444 ? 1 : 0,
    };
  });
  for (const [image, x, y] of [
    ["qy", 82, 24],
    ["td", 83, 19],
    ["vi", 83, 19],
  ] as const) {
    const frame = observations.frames.find((frame) => frame.image === image);
    if (
      frame?.kind !== "decoded" ||
      !frame.candidates.some((candidate) =>
        candidate.objects.some((index) => {
          const object = observations.objects[index]!;
          return (
            object.picture.startsWith("enemy/round-small/") && object.x === x && object.y === y
          );
        }),
      )
    )
      throw new Error(`Changed clipped wave evidence ${image}`);
  }
  groups.push({
    tick: 368,
    family: "enemy/round-small",
    x: 82,
    y: 24,
    dx: -2,
    count: 1,
    spacing: 0,
    motion: "straight",
    hp: 1,
    fireDenominator: 0,
    shots: 0,
  });
  const path = source(265).path.map(({ x, ys }) => {
    if (ys.length !== 1) throw new Error(`Ambiguous wave row at ${x}`);
    return { x, y: ys[0]! };
  });
  const peaks = path.filter((point) => point.y === 27).map((point) => point.x);
  if (peaks.length !== 2) throw new Error("Missing two-column wave peak");
  return {
    source: golden.id,
    interpretation:
      "UNVERIFIED outside replay: clipped qy identity, unhit enemy HP (minimum one), hidden path continuation, one-shot capacities, and spatial fire extrema. No captured frame is runtime state.",
    groups: groups.sort((a, b) => a.tick - b.tick),
    path,
    fireColumns: peaks.flatMap((x) => [x, x - 20, x - 41, x - 61]).sort((a, b) => a - b),
  };
}

export const spaceImpactWaveProgramModule: GeneratedResourceModule = {
  file: "space-impact-wave-program.ts",
  extract: ({ golden }) =>
    resourceModule(
      "SPACE_IMPACT_WAVE_PROGRAM",
      "{ readonly source:string; readonly interpretation:string; readonly groups:readonly {readonly tick:number;readonly family:string;readonly x:number;readonly y:number;readonly dx:number;readonly count:number;readonly spacing:number;readonly motion:'straight'|'wave'|'descend'|'slope'|'boss';readonly hp:number;readonly fireDenominator:number;readonly shots:number}[]; readonly path:readonly {readonly x:number;readonly y:number}[];readonly fireColumns:readonly number[]}",
      extractSpaceImpactWaveProgram(golden("game/space-impact/level-0")),
    ),
};
