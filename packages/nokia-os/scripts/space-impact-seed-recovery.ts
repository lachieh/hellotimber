import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseGolden, findGoldenImage, type Golden } from "./golden-format.ts";
import { extractSpaceImpactLevelObservations } from "./space-impact-levels.ts";
import { observedSpaceImpactInput } from "./space-impact-delivery.ts";
import { createGameRandom, GAME_RANDOM_MODULUS } from "@hellotimber/nokia-kit/apps/games/random";
import { SPACE_IMPACT_DATA } from "@hellotimber/nokia-kit/ui/resources/generated/space-impact";
import { spaceImpactU32SeedAliases } from "./space-impact-seeds.ts";

export interface SpaceImpactConsumerHypothesis {
  readonly silentFireRolls?: number;
  readonly pickupBeforeSilentRolls?: boolean;
  readonly bossStartOffset?: number;
}

/** LCD recovery, conditional on the stated consumer hypothesis; never reads REF or a seed peek. */
export function recoverSpaceImpactLevelZero(
  level: Golden,
  exit: Golden,
  {
    silentFireRolls = 18,
    pickupBeforeSilentRolls = false,
    bossStartOffset = 0,
  }: SpaceImpactConsumerHypothesis = {},
) {
  if (
    !Number.isInteger(silentFireRolls) ||
    silentFireRolls < 0 ||
    !Number.isInteger(bossStartOffset)
  )
    throw new Error("Invalid Space impact consumer hypothesis");
  if (exit.id !== "game/space-impact/level-0.exit" || !exit.timeline)
    throw new Error("Expected the level-0 exit LCD trace");
  const data = extractSpaceImpactLevelObservations(level);
  const steps = observedSpaceImpactInput(level.note).filter((event) => event.kind === "step");
  const frames = data.frames.flatMap((frame) => {
    if (frame.kind !== "decoded") return [];
    const common = frame.candidates[0]!.objects.filter((index) =>
      frame.candidates.every((candidate) => candidate.objects.includes(index)),
    ).map((index) => data.objects[index]!);
    return [
      { ...frame, step: steps.filter((event) => event.atMs <= frame.startMs).length, common },
    ];
  });
  const pickups = frames
    .filter((frame, index) => {
      const previous = frames[index - 1];
      return (
        previous &&
        (frame.hud.weapon !== previous.hud.weapon ||
          frame.hud.count !== previous.hud.count ||
          frame.hud.lives !== previous.hud.lives)
      );
    })
    .map((frame) => ({
      image: frame.image,
      atMs: frame.startMs,
      // H9's provisional mapping is tested jointly, rather than supplied a recorded award at runtime.
      value: frame.hud.weapon === "missile" ? 1 : frame.hud.weapon === "wall" ? 2 : 3,
    }));
  if (pickups.length !== 2) throw new Error("Expected two level-0 random pickups");
  const inPlace = frames.find((frame) =>
    frame.common.some((object) => object.picture.startsWith("boss/0/") && object.x === 56),
  );
  if (!inPlace) throw new Error("Missing LCD boss approach");
  const firstRollStep = inPlace.step + 1 + bossStartOffset;
  const bossRolls = steps.length - firstRollStep + 1;
  if (bossRolls < 1) throw new Error("Missing boss roll opportunities");
  const bossFrames = frames.filter((frame) => frame.step >= inPlace.step);
  const shotSamples = bossFrames.flatMap((frame) =>
    frame.common
      .filter((object) => object.picture === "shot")
      .map((object) => ({ ...object, image: frame.image, step: frame.step })),
  );
  const tracks = new Map<string, { step: number; y: number; images: Set<string> }>();
  for (const sample of shotSamples) {
    const next = shotSamples.filter(
      (other) => other.step === sample.step + 1 && other.x === sample.x - 3 && other.y === sample.y,
    );
    if (next.length === 0) continue;
    const step = sample.step - (51 - sample.x) / 3;
    if (!Number.isInteger(step) || step < firstRollStep || step > steps.length) continue;
    const key = `${step}:${sample.y}`;
    const track = tracks.get(key) ?? { step, y: sample.y, images: new Set<string>() };
    track.images.add(sample.image);
    for (const other of next) track.images.add(other.image);
    tracks.set(key, track);
  }
  const shots = [...tracks.values()]
    .sort((a, b) => a.step - b.step)
    .map((track) => ({ ...track, images: [...track.images] }));
  const shotSteps = new Set(shots.map((shot) => shot.step));
  const bosses = bossFrames.flatMap((frame) =>
    frame.common
      .filter((object) => object.picture.startsWith("boss/0/"))
      .map((object) => ({ ...object, step: frame.step })),
  );
  const lastBoss = bosses.at(-1);
  const previousBoss = [...bosses]
    .reverse()
    .find((object) => object.step === (lastBoss?.step ?? 0) - 1);
  if (
    !lastBoss ||
    !previousBoss ||
    lastBoss.x !== 56 ||
    Math.abs(lastBoss.y - previousBoss.y) !== 1
  )
    throw new Error("Missing final boss motion for the destruction origin");
  const center = {
    x: lastBoss.x + Math.floor(lastBoss.width / 2),
    y: lastBoss.y + lastBoss.y - previousBoss.y + Math.floor(lastBoss.height / 2),
  };
  const rectangle = { x: center.x - 6, y: center.y - 6, width: 21, height: 23 };
  const burstFrames = exit.timeline
    .filter((row) => row.durationMs >= 34)
    .slice(0, 5)
    .map((row) => ({ image: row.image, pixels: findGoldenImage(exit, row.image).pixels }));
  if (burstFrames.length !== 5) throw new Error("Missing initial boss destruction frames");
  const burstDraw = 2 + silentFireRolls + bossRolls;
  const draws = Array.from({ length: GAME_RANDOM_MODULUS }, (_, seed) => {
    const random = createGameRandom(seed);
    return Uint16Array.from({ length: burstDraw + 16 }, () => random.next());
  });
  let seeds = Array.from({ length: GAME_RANDOM_MODULUS }, (_, seed) => seed);
  let models: { seed: number; fireDenominator: number }[] = [];
  const checkpoints: { source: string; draw: number; seeds: number; models: number }[] = [];
  const checkpoint = (source: string, draw: number) =>
    checkpoints.push({ source, draw, seeds: seeds.length, models: models.length });
  seeds = seeds.filter((seed) => (draws[seed]![0]! & 3) === pickups[0]!.value);
  checkpoint(`${level.id}/${pickups[0]!.image}`, 1);
  const secondDraw = pickupBeforeSilentRolls ? 2 : 2 + silentFireRolls;
  if (pickupBeforeSilentRolls) {
    seeds = seeds.filter((seed) => (draws[seed]![secondDraw - 1]! & 3) === pickups[1]!.value);
    checkpoint(`${level.id}/${pickups[1]!.image}`, secondDraw);
  }
  for (let index = 0; index < silentFireRolls; index++)
    checkpoint(
      "UNVERIFIED consumer attribution: off-screen/zero-shot fire roll",
      index + (pickupBeforeSilentRolls ? 3 : 2),
    );
  if (!pickupBeforeSilentRolls) {
    seeds = seeds.filter((seed) => (draws[seed]![secondDraw - 1]! & 3) === pickups[1]!.value);
    checkpoint(`${level.id}/${pickups[1]!.image}`, secondDraw);
  }
  // H5/H14: a byte denominator, excluding the documented 0/127 no-fire sentinels.
  models = seeds.flatMap((seed) =>
    Array.from({ length: 255 }, (_, n) => ({ seed, fireDenominator: n + 1 })).filter(
      (model) => model.fireDenominator !== 127,
    ),
  );
  for (let roll = 0; roll < bossRolls; roll++) {
    const draw = 3 + silentFireRolls + roll;
    const step = firstRollStep + roll;
    models = models.filter(
      (model) =>
        (draws[model.seed]![draw - 1]! % model.fireDenominator === 0) === shotSteps.has(step),
    );
    seeds = [...new Set(models.map((model) => model.seed))];
    checkpoint(
      `${level.id}: boss roll at delivered step ${step}${shotSteps.has(step) ? " (shot)" : " (no shot)"}`,
      draw,
    );
  }
  const burst = burstFrames.map(({ image, pixels }, frame) => {
    models = models.filter((model) => {
      const chain = draws[model.seed]!;
      const effects = [{ ...center, phase: chain[burstDraw]! % 5 }];
      for (let draw = burstDraw + 1; draw < burstDraw + 16; draw += 3) {
        const dx = (chain[draw]! & 3) + 1;
        effects.push(
          { x: center.x + dx, y: center.y + 6, phase: chain[draw + 1]! % 5 },
          { x: center.x - dx, y: center.y - 6, phase: chain[draw + 2]! % 5 },
        );
      }
      const actual = new Uint8Array(84 * 48).fill(1);
      for (const effect of effects) {
        let phase = effect.phase,
          removed = false;
        for (let tick = 0; tick < frame; tick++) {
          phase = (phase + 1) % 5;
          if (phase === 4) {
            removed = true;
            break;
          }
        }
        if (removed) continue;
        if (frame === 0) phase = 0;
        const picture =
          phase === 1
            ? "explosion/split/0"
            : phase === 3
              ? "explosion/spark/0"
              : "explosion/checker/0";
        const offset = phase === 1 ? 0 : phase === 3 ? 2 : 1;
        for (const [y, row] of SPACE_IMPACT_DATA.sprites[picture]!.entries())
          for (const [x, pixel] of row.split("").entries())
            if (pixel === "#") actual[(effect.y + offset + y) * 84 + effect.x + offset + x] ^= 1;
      }
      for (let y = rectangle.y; y < rectangle.y + rectangle.height; y++)
        for (let x = rectangle.x; x < rectangle.x + rectangle.width; x++)
          if (actual[y * 84 + x] !== pixels[y * 84 + x]) return false;
      return true;
    });
    seeds = [...new Set(models.map((model) => model.seed))];
    checkpoint(`${exit.id}/${image}`, burstDraw + 16);
    return { image, rectangle, seeds: seeds.length, models: models.length };
  });
  return {
    hypothesis: { silentFireRolls, pickupBeforeSilentRolls, bossStartOffset },
    pickups,
    boss: { firstRollStep, rolls: bossRolls, shots },
    ansi: {
      draws: 0,
      interpretation:
        "Separate chain; no random-row consumer in the level-0 hypothesis. Later-level LCD verification remains pending.",
    },
    checkpoints,
    burst,
    models,
    effectiveSeeds: seeds,
    u32Aliases: seeds.length === 1 ? spaceImpactU32SeedAliases(seeds[0]!).length : null,
    interpretation:
      "Conditional effective gameplay chain recovery, not the original u32 clock seed, unique consumer order or full-level engine acceptance. The 19-hidden-roll counterexample has a different pre-draw seed and the same later LCD outcomes. Hidden consumer attribution remains UNVERIFIED until spawn/fire engine replay.",
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const golden = (id: string) =>
    parseGolden(
      readFileSync(new URL(`../goldens/game/space-impact/${id}.lcd.txt`, import.meta.url), "utf8"),
      `${id}.lcd.txt`,
    );
  const report =
    JSON.stringify(
      {
        countedOrder: recoverSpaceImpactLevelZero(golden("level-0"), golden("level-0.exit")),
        extraSilentRoll: recoverSpaceImpactLevelZero(golden("level-0"), golden("level-0.exit"), {
          silentFireRolls: 19,
        }),
      },
      null,
      2,
    ) + "\n";
  if (process.argv.includes("--write"))
    writeFileSync(
      new URL("../tests/fixtures/space-impact-seed-recovery.json", import.meta.url),
      report,
    );
  else process.stdout.write(report);
}
