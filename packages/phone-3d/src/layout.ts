import type { Nokia3310Key } from "./types";

/**
 * All positional truth for the v2 procedural model. 1 world unit = 1 cm,
 * phone centered at the origin, Y up, front face toward +Z (spec §1:
 * 4.8 × 11.3 × 2.2 cm).
 *
 * v2.1: every landmark below was measured off the reference renders in
 * `nokia-3310/` (front view `nokia-3310-1.png`, 1120×1624 px, ≈117 px/cm,
 * phone center at px y≈830) — replacing the v2 numbers that were seeded from
 * the glTF-era hotspots.
 */

export const BODY = { w: 4.8, h: 11.3, d: 2.2 } as const;

/** Front face plane (z of the shell's front surface). */
export const FACE_Z = BODY.d / 2;
/** How far a pressed key sinks (plan 03 convention). */
export const KEY_TRAVEL = 0.04;
/** Legend decal float above its key cap (must stay below KEY_TRAVEL). */
export const LEGEND_LIFT = 0.012;
/** Key cap height above its base plane (extrude depth incl. bevel). */
export const KEY_DEPTH = 0.14;

/** The chrome "island": one silver plate carrying the screen surround and the
 *  navi cluster — the 3310's defining front feature. Rounded rect, front view. */
export const ISLAND = { x: 0, y: 0.55, w: 4.42, h: 4.9, r: 1.5 } as const;
/** Island plate TOTAL thickness above the face, including its bevels
 *  (cluster keys sit on top of it; the mesh sinks 0.01 into the face). */
export const ISLAND_LIFT = 0.14;

/** Dark screen surround inset into the island (was "bezel" in v2 — the name
 *  is kept because the geometry tests reason about it as the screen keep-out). */
export const BEZEL = { x: 0, y: 1.12, w: 3.78, h: 3.52 } as const;
/** The visible LCD. Real 3310 active area is ≈31×23 mm for 84×48 px — the
 *  pixels are TALLER than wide (ratio ≈1.35, not 7:4). Authentic. */
export const LCD = { x: 0, y: 1.45, w: 3.24, h: 2.4 } as const;
export const LCD_Z = FACE_Z + ISLAND_LIFT + 0.03;

/** NOKIA badge (black plate, white wordmark) between earpiece and screen. */
export const BADGE = { x: 0, y: 3.35, w: 1.78, h: 0.46 } as const;

/**
 * Body silhouette — right-half width profile, top to bottom. Near-straight
 * sides with a gentle waist, broad shoulder dome, narrower rounded chin
 * (traced from nokia-3310-1/8.png).
 */
export const BODY_PROFILE: readonly { y: number; hw: number }[] = [
  { y: 5.65, hw: 1.5 },
  { y: 5.5, hw: 1.95 },
  { y: 5.05, hw: 2.22 },
  { y: 4.1, hw: 2.35 },
  { y: 2.2, hw: 2.4 },
  { y: 0.0, hw: 2.37 },
  { y: -2.0, hw: 2.31 },
  { y: -3.8, hw: 2.29 },
  { y: -4.9, hw: 2.18 },
  { y: -5.45, hw: 1.75 },
  { y: -5.65, hw: 0.95 },
];

export type KeyShape = "pill" | "crescent" | "wing-l" | "wing-r" | "dot";

export interface KeyLayoutEntry {
  key: Nokia3310Key;
  /** Center, cm from the phone origin. */
  x: number;
  y: number;
  /** Footprint of the cap outline before rotation. */
  w: number;
  h: number;
  /** In-plane rotation, degrees CCW (the keypad fan). */
  rot: number;
  shape: KeyShape;
  /** Extra z under the cap (cluster keys ride on the chrome island). */
  base?: number;
}

/** The digit fan, measured per row: middle key level & lower, outer keys
 *  higher, tilted ∓rot and mirrored. */
const DIGIT_ROWS: readonly {
  keys: [Nokia3310Key, Nokia3310Key, Nokia3310Key];
  midY: number;
  sideY: number;
  sideX: number;
  sideRot: number;
}[] = [
  { keys: ["1", "2", "3"], midY: -2.35, sideY: -2.18, sideX: 1.5, sideRot: 18 },
  { keys: ["4", "5", "6"], midY: -3.12, sideY: -2.91, sideX: 1.41, sideRot: 18 },
  { keys: ["7", "8", "9"], midY: -3.89, sideY: -3.66, sideX: 1.32, sideRot: 18 },
  { keys: ["*", "0", "#"], midY: -4.62, sideY: -4.4, sideX: 1.24, sideRot: 18 },
];

const SIDE_KEY = { w: 1.06, h: 0.56 };
const MID_KEY = { w: 1.04, h: 0.5 };

function digitEntries(): KeyLayoutEntry[] {
  return DIGIT_ROWS.flatMap((row): KeyLayoutEntry[] => [
    {
      key: row.keys[0],
      x: -row.sideX,
      y: row.sideY,
      ...SIDE_KEY,
      rot: -row.sideRot,
      shape: "pill",
    },
    { key: row.keys[1], x: 0, y: row.midY, ...MID_KEY, rot: 0, shape: "pill" },
    { key: row.keys[2], x: row.sideX, y: row.sideY, ...SIDE_KEY, rot: row.sideRot, shape: "pill" },
  ]);
}

export const KEY_LAYOUT: readonly KeyLayoutEntry[] = [
  // Power lives on the real phone's top EDGE; the front-face target doubles as
  // the earpiece dot column (body-colored cap, dark dot print).
  { key: "power", x: 0, y: 4.55, w: 0.62, h: 1.05, rot: 0, shape: "dot" },

  // The cluster rides ON the chrome island: white NaviKey notched into the
  // screen surround, C wing lower-left, ▲ upper-right, ▼ inner-right.
  { key: "navi", x: 0, y: -0.84, w: 1.9, h: 0.58, rot: 0, shape: "crescent", base: ISLAND_LIFT },
  { key: "c", x: -1.28, y: -1.36, w: 1.08, h: 0.58, rot: -36, shape: "wing-l", base: ISLAND_LIFT },
  { key: "up", x: 1.42, y: -1.1, w: 0.84, h: 0.44, rot: 42, shape: "wing-r", base: ISLAND_LIFT },
  { key: "down", x: 0.74, y: -1.74, w: 0.9, h: 0.5, rot: 24, shape: "wing-r", base: ISLAND_LIFT },

  ...digitEntries(),
];
