import { createGameRandom, GAME_RANDOM_MODULUS } from "../src/kit/apps/games/random.ts";

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
  const { candidates } = filterSpaceImpactSeedEvents(
    ordered.map((observation) => ({ ...observation, kind: "mask" as const })),
  );
  if (candidates.length === 0)
    throw new Error("No effective seed fits: check the draw order/model against the LCD evidence.");
  if (candidates.length === 1) return { kind: "unique", effectiveSeed: candidates[0]!, candidates };
  return {
    kind: "noninformative",
    reason: ordered.length === 0 ? "no draws" : "ambiguous",
    candidates,
  };
}

type EventSource = { readonly draw: number; readonly source: string };
export type SpaceImpactSeedEvent = EventSource &
  (
    | { readonly kind: "mask"; readonly mask: number; readonly value: number }
    | {
        readonly kind: "remainder";
        readonly modulus: number;
        readonly value: number;
        readonly equal: boolean;
      }
  );

// After the first draw, every state is in this table; no u32 sweep is needed per hypothesis.
const transitions = Uint16Array.from({ length: GAME_RANDOM_MODULUS }, (_, seed) =>
  createGameRandom(seed).next(),
);

/** Tests an explicit consumer-order hypothesis without discarding the rejecting event's evidence. */
export function filterSpaceImpactSeedEvents(events: readonly SpaceImpactSeedEvent[]) {
  let previous = 0;
  for (const event of events) {
    if (!Number.isSafeInteger(event.draw) || event.draw < 1 || !event.source.trim())
      throw new Error("Invalid Space impact seed event");
    if (event.draw < previous)
      throw new Error("Space impact seed events must be in consumer order");
    previous = event.draw;
    if (event.kind === "mask") {
      if (
        !Number.isInteger(event.mask) ||
        event.mask < 0 ||
        event.mask > 0xffff ||
        !Number.isInteger(event.value) ||
        event.value < 0 ||
        (event.value & event.mask) !== event.value
      )
        throw new Error("Invalid Space impact masked event");
    } else if (
      !Number.isInteger(event.modulus) ||
      event.modulus < 1 ||
      event.modulus > GAME_RANDOM_MODULUS ||
      !Number.isInteger(event.value) ||
      event.value < 0 ||
      event.value >= event.modulus
    ) {
      throw new Error("Invalid Space impact remainder event");
    }
  }
  let candidates = Array.from({ length: GAME_RANDOM_MODULUS }, (_, seed) => seed);
  const states = Uint16Array.from(candidates);
  const checkpoints: {
    readonly draw: number;
    readonly source: string;
    readonly remaining: number;
  }[] = [];
  let position = 0;
  for (const event of events) {
    candidates = candidates.filter((seed) => {
      let value = states[seed]!;
      for (let draw = position; draw < event.draw; draw++) value = transitions[value]!;
      states[seed] = value;
      return event.kind === "mask"
        ? (value & event.mask) === event.value
        : (value % event.modulus === event.value) === event.equal;
    });
    position = event.draw;
    checkpoints.push({ draw: event.draw, source: event.source, remaining: candidates.length });
    if (candidates.length === 0) return { kind: "rejected" as const, candidates, checkpoints };
  }
  return {
    kind: candidates.length === 1 ? ("unique" as const) : ("ambiguous" as const),
    candidates,
    checkpoints,
  };
}

/** Every original u32 with the same first draw; later gameplay cannot distinguish these aliases. */
export function spaceImpactU32SeedAliases(effectiveSeed: number): readonly number[] {
  if (!Number.isInteger(effectiveSeed) || effectiveSeed < 0 || effectiveSeed >= GAME_RANDOM_MODULUS)
    throw new Error("Invalid Space impact effective seed");
  const first = transitions[effectiveSeed]!;
  // Multiplicative inverse of 0x625f modulo 2^32 (the multiplier is odd).
  const inverse = 490502559;
  const aliases: number[] = [];
  for (let word = first; word < 2 ** 32; word += GAME_RANDOM_MODULUS)
    aliases.push(Math.imul(word - 0x3623, inverse) >>> 0);
  return aliases.sort((a, b) => a - b);
}
