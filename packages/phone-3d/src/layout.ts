import type { Nokia3310Key } from "./types";

/**
 * All positional truth for the v2 procedural model. 1 world unit = 1 cm,
 * phone centered at the origin, Y up, front face toward +Z (spec §1:
 * 4.8 × 11.3 × 2.2 cm).
 *
 * Key centers/rotations were seeded from the glTF-era calibrated hotspot
 * fractions (`x = (cx − 0.5) · 4.8`, `y = (cy − 0.5) · 11.3`), then the digit
 * grid was snapped to an exactly symmetric fan (mirrored x/rot, shared row y —
 * the hotspots carried up to ±0.09 cm of hand-calibration noise that a clean
 * rebuild shouldn't inherit).
 */

export const BODY = { w: 4.8, h: 11.3, d: 2.2 } as const;

/** Front face plane (z of the shell's front surface). */
export const FACE_Z = BODY.d / 2;
/** How far a pressed key sinks (plan 03 convention). */
export const KEY_TRAVEL = 0.04;
/** Legend decal float above its key cap (must stay below KEY_TRAVEL). */
export const LEGEND_LIFT = 0.012;
/** Key cap height above the face plane (extrude depth incl. bevel). */
export const KEY_DEPTH = 0.14;

/** Screen bezel (the raised surround) and the LCD opening, front view. */
export const BEZEL = { x: 0, y: 1.9, w: 3.4, h: 2.3 } as const;
/** LCD is exactly 84:48 = 7:4. Rendered plane carries the CanvasTexture. */
export const LCD = { x: 0, y: 1.9, w: 2.8, h: 1.6 } as const;
/** Bezel lip rises this far above the face; the LCD sits recessed below it. */
export const BEZEL_LIP = 0.06;
export const LCD_Z = FACE_Z + 0.03; // recessed under the lip (face 1.1 → lcd 1.13)

/**
 * Body silhouette — right-half width profile, top to bottom. The front Shape
 * mirrors these through x = 0 and splines through them: broad dome at the
 * earpiece, widest across the screen, a gentle waist, rounded chin.
 */
export const BODY_PROFILE: readonly { y: number; hw: number }[] = [
  { y: 5.65, hw: 1.1 },
  { y: 5.45, hw: 1.75 },
  { y: 5.0, hw: 2.1 },
  { y: 4.0, hw: 2.3 },
  { y: 2.5, hw: 2.4 },
  { y: 0.5, hw: 2.33 },
  { y: -1.5, hw: 2.28 },
  { y: -3.5, hw: 2.3 },
  { y: -4.8, hw: 2.25 },
  { y: -5.4, hw: 1.9 },
  { y: -5.65, hw: 1.0 },
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
}

/** The digit fan: per row [y of the middle key, y of the side keys, |x| and
 *  |rot| of the side keys]. Rows read 123 / 456 / 789 / *0#. */
const DIGIT_ROWS: readonly {
  keys: [Nokia3310Key, Nokia3310Key, Nokia3310Key];
  midY: number;
  sideY: number;
  sideX: number;
  sideRot: number;
}[] = [
  { keys: ["1", "2", "3"], midY: -1.966, sideY: -1.785, sideX: 1.306, sideRot: 25 },
  { keys: ["4", "5", "6"], midY: -2.712, sideY: -2.509, sideX: 1.277, sideRot: 25 },
  { keys: ["7", "8", "9"], midY: -3.503, sideY: -3.345, sideX: 1.233, sideRot: 25 },
  { keys: ["*", "0", "#"], midY: -4.294, sideY: -4.068, sideX: 1.176, sideRot: 25 },
];

const SIDE_KEY = { w: 0.84, h: 0.48 };
const MID_KEY = { w: 0.9, h: 0.52 };

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
  // Power lives on the real phone's top EDGE; here it doubles as the earpiece
  // grille (dark pill with slot print) so it has a clickable front-face target.
  { key: "power", x: 0, y: 4.55, w: 1.15, h: 0.55, rot: 0, shape: "dot" },

  // Top cluster: the wide blue NaviKey, C wing on the left, ▲▼ wings on the right.
  { key: "navi", x: 0, y: -0.271, w: 1.51, h: 0.62, rot: 0, shape: "crescent" },
  { key: "c", x: -1.152, y: -0.723, w: 0.88, h: 0.5, rot: -36, shape: "wing-l" },
  { key: "up", x: 1.277, y: -0.61, w: 0.59, h: 0.43, rot: 38.5, shape: "wing-r" },
  { key: "down", x: 0.624, y: -1.017, w: 0.7, h: 0.52, rot: 24, shape: "wing-r" },

  ...digitEntries(),
];
