import { createGameRandom, GAME_RANDOM_MODULUS } from "../src/games/random.ts";

export interface SpaceImpactRandomObservation {
  /** One-based position in the game chain, including all earlier consumers. */
  readonly draw: number;
  readonly mask: number;
  readonly value: number;
  readonly source: string;
}

type SeedSearch =
  | {
      readonly kind: "unique";
      readonly effectiveSeed: number;
      readonly candidates: readonly number[];
    }
  | {
      readonly kind: "noninformative";
      readonly reason: "no draws" | "ambiguous";
      readonly candidates: readonly number[];
    };

/** Conditional on the supplied consumer positions; cannot recover the original u32 clock seed. */
export function searchSpaceImpactSeeds(
  observations: readonly SpaceImpactRandomObservation[],
): SeedSearch {
  for (const observation of observations) {
    if (
      !Number.isSafeInteger(observation.draw) ||
      observation.draw < 1 ||
      !Number.isInteger(observation.mask) ||
      observation.mask < 0 ||
      observation.mask > 0xffff ||
      !Number.isInteger(observation.value) ||
      (observation.value & observation.mask) !== observation.value ||
      !observation.source.trim()
    )
      throw new Error(`Invalid Space impact random observation: ${JSON.stringify(observation)}`);
  }
  const ordered = [...observations].sort((a, b) => a.draw - b.draw);
  const candidates: number[] = [];
  for (let seed = 0; seed < GAME_RANDOM_MODULUS; seed++) {
    const random = createGameRandom(seed);
    let position = 0;
    let value = 0;
    const fits = ordered.every((observation) => {
      while (position < observation.draw) {
        value = random.next();
        position++;
      }
      return (value & observation.mask) === observation.value;
    });
    if (fits) candidates.push(seed);
  }
  if (candidates.length === 0)
    throw new Error("No effective seed fits: check the draw order/model against the LCD evidence.");
  if (candidates.length === 1) return { kind: "unique", effectiveSeed: candidates[0]!, candidates };
  return {
    kind: "noninformative",
    reason: ordered.length === 0 ? "no draws" : "ambiguous",
    candidates,
  };
}
