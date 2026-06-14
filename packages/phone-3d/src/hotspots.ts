import type { Nokia3310Key } from "./types";

/**
 * Key hit-targets as fractions of the model's front face bounding box.
 * cx/cy are the key center (0,0 = bottom-left of the face, 1,1 = top-right);
 * w/h are the hit area size as a fraction of face width/height.
 *
 * The shaderbytes 3310 keypad is one fused mesh, so we place transparent
 * raycast planes over each key. Values are calibrated against the rendered
 * model (see phone-3d demo). Power is on the top edge — given a hotspot near
 * the top so the keyboard/`pressKey('power')` path still has a visual target.
 */
export interface KeyHotspot {
  key: Nokia3310Key;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

// Face layout (fractions). The screen sits ~0.62–0.86 in Y; the soft keys and
// keypad fill ~0.10–0.55.
const COL_L = 0.29;
const COL_M = 0.5;
const COL_R = 0.71;

// Whole-keypad vertical nudge (fraction of face height). Negative = down. The
// hit areas read ~10% too high against the rendered keys, so shift everything
// (softkeys + digit grid) down as one tunable number; `power` stays on the rim.
const Y_NUDGE = -0.035;

// Digit rows (cy), top (1/2/3) to bottom (*/0/#).
const ROW_1 = 0.42 + Y_NUDGE;
const ROW_4 = 0.335 + Y_NUDGE;
const ROW_7 = 0.25 + Y_NUDGE;
const ROW_S = 0.165 + Y_NUDGE; // * 0 #

const KW = 0.16; // digit key hit width
const KH = 0.075; // digit key hit height

export const KEY_HOTSPOTS: readonly KeyHotspot[] = [
  // Power — top edge of the phone (the small nub at the very top).
  { key: "power", cx: 0.5, cy: 0.95, w: 0.16, h: 0.05 },

  // NaviKey (the big blue softkey) directly under the screen.
  { key: "navi", cx: 0.5, cy: 0.485 + Y_NUDGE, w: 0.3, h: 0.05 },

  // C key (left) and up/down rocker (right) flanking the NaviKey.
  { key: "c", cx: 0.26, cy: 0.475 + Y_NUDGE, w: 0.15, h: 0.055 },
  { key: "up", cx: 0.74, cy: 0.495 + Y_NUDGE, w: 0.15, h: 0.03 },
  { key: "down", cx: 0.74, cy: 0.46 + Y_NUDGE, w: 0.15, h: 0.03 },

  // Digit grid 1-2-3 / 4-5-6 / 7-8-9 / *-0-#.
  { key: "1", cx: COL_L, cy: ROW_1, w: KW, h: KH },
  { key: "2", cx: COL_M, cy: ROW_1, w: KW, h: KH },
  { key: "3", cx: COL_R, cy: ROW_1, w: KW, h: KH },
  { key: "4", cx: COL_L, cy: ROW_4, w: KW, h: KH },
  { key: "5", cx: COL_M, cy: ROW_4, w: KW, h: KH },
  { key: "6", cx: COL_R, cy: ROW_4, w: KW, h: KH },
  { key: "7", cx: COL_L, cy: ROW_7, w: KW, h: KH },
  { key: "8", cx: COL_M, cy: ROW_7, w: KW, h: KH },
  { key: "9", cx: COL_R, cy: ROW_7, w: KW, h: KH },
  { key: "*", cx: COL_L, cy: ROW_S, w: KW, h: KH },
  { key: "0", cx: COL_M, cy: ROW_S, w: KW, h: KH },
  { key: "#", cx: COL_R, cy: ROW_S, w: KW, h: KH },
];
