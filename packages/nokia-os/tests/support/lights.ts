// Plan 25's lights goldens in tests: loading them by id and the comparison tolerances (Task 0).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readPlanIndex } from "../../scripts/golden-index.ts";
import { parseLightsGolden, type LightsGolden } from "../../scripts/lights-format.ts";

const GOLDENS = join(import.meta.dirname, "../../goldens");

/**
 * How far an off edge may stray from the golden after power-on alignment: the captured edges lie
 * within 2.9 ms of the fitted light tick, and the two lines may switch one 1 ms grain apart.
 */
export const LIGHT_EDGE_TOLERANCE_MS = 5;

/** The firmware lights the LEDs 14-33 ms after a key-down; nokia-os lights at the key-down (D2). */
export const KEY_LIGHT_LATENCY_MAX_MS = 33;

export function loadLightsGolden(id: string): LightsGolden {
  const file = `${id}.lights.txt`;
  return parseLightsGolden(readFileSync(join(GOLDENS, file), "utf8"), file);
}

/** Plan 25's lights golden ids starting with `prefix`, sorted. */
export function lightsGoldenIds(prefix: string): string[] {
  return readPlanIndex(GOLDENS, "25")
    .filter((entry) => entry.kind === "lights" && entry.id.startsWith(prefix))
    .map((entry) => entry.id);
}
