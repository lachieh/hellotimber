import type { Nokia3310Key } from "./types";

/**
 * v3: the model is a sourced GLB (see docs/plans/10-phone-model-v3-sourced.md)
 * with every control as a named node — all positional truth lives in the mesh.
 * This module is only the name contract between the GLB and the runtime.
 */

/** Physical key → GLB node name (bijective; enforced by tests). */
export const KEY_NODES: Record<Nokia3310Key, string> = {
  power: "key_power",
  navi: "key_navi",
  c: "key_c",
  up: "key_up",
  down: "key_down",
  "0": "key_0",
  "1": "key_1",
  "2": "key_2",
  "3": "key_3",
  "4": "key_4",
  "5": "key_5",
  "6": "key_6",
  "7": "key_7",
  "8": "key_8",
  "9": "key_9",
  "*": "key_star",
  "#": "key_hash",
};

/** Non-interactive assembly nodes the loader dresses with materials. */
export const STATIC_NODES = [
  "body",
  "island",
  "screen",
  "screen_glass",
  "badge",
  "badge_logo",
  "side_cap",
] as const;

/** Key depress travel as a fraction of the model's bounding height (the GLB
 *  is ~2.37× life size and gets normalized at load — absolute units would
 *  drift with the asset). 0.004 ≈ 0.45 mm at true scale × the visual x2 the
 *  depress needs to read on screen. */
export const KEY_TRAVEL_FRAC = 0.004;

/** The GLB's display plane extends under the island's frame; only an interior
 *  sub-rect is visible. Fractions of the plane's local bbox hidden on each
 *  side — measured ONCE against this asset (standby screen: status bars +
 *  softkey row must be fully visible). Asset-intrinsic, not runtime tuning. */
export const SCREEN_APERTURE = { left: 0.02, right: 0.02, top: 0.07, bottom: 0.015 } as const;

/** Visible LCD scale relative to the model's (oversized) display plane —
 *  sizing experiment: the mesh window reads larger than the real 3310's
 *  display; shrinking reveals a dark surround like the real bezel. */
export const SCREEN_SCALE = 0.8;
