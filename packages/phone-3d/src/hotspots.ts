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
  /** Per-key depth as a fraction of model depth out from center. Optional;
   *  falls back to the shared HOTSPOT_Z_FRAC (Nokia3310.tsx) when omitted. */
  z?: number;
  /** In-plane rotation in degrees (counter-clockwise), for keys that aren't
   *  level/square against the camera. Optional; defaults to 0. */
  rot?: number;
}

/**
 * Calibrated against the rendered shaderbytes model via the dev hotspot panel
 * (`?calibrate=1`). The keypad is one fused mesh, so each key is a transparent
 * raycast plane positioned here. Order: power, navi, C, up/down rocker, then the
 * 1-2-3 / 4-5-6 / 7-8-9 / *-0-# grid.
 */
export const KEY_HOTSPOTS: readonly KeyHotspot[] = [
  { key: "power", cx: 0.5, cy: 0.93, w: 0.16, h: 0.05 },

  { key: "navi", cx: 0.51, cy: 0.476, w: 0.3, h: 0.05 },
  { key: "c", cx: 0.26, cy: 0.436, w: 0.15, h: 0.055 },
  { key: "up", cx: 0.74, cy: 0.446, w: 0.128, h: 0.042 },
  { key: "down", cx: 0.656, cy: 0.406, w: 0.146, h: 0.042 },

  { key: "1", cx: 0.236, cy: 0.346, w: 0.16, h: 0.044 },
  { key: "2", cx: 0.5, cy: 0.326, w: 0.184, h: 0.042 },
  { key: "3", cx: 0.766, cy: 0.346, w: 0.16, h: 0.046 },
  { key: "4", cx: 0.24, cy: 0.276, w: 0.16, h: 0.046 },
  { key: "5", cx: 0.5, cy: 0.26, w: 0.188, h: 0.046 },
  { key: "6", cx: 0.756, cy: 0.276, w: 0.16, h: 0.046 },
  { key: "7", cx: 0.25, cy: 0.21, w: 0.16, h: 0.046 },
  { key: "8", cx: 0.5, cy: 0.19, w: 0.182, h: 0.046 },
  { key: "9", cx: 0.756, cy: 0.2, w: 0.16, h: 0.046, z: 0.36 },
  { key: "*", cx: 0.26, cy: 0.14, w: 0.16, h: 0.046 },
  { key: "0", cx: 0.5, cy: 0.12, w: 0.19, h: 0.046 },
  { key: "#", cx: 0.746, cy: 0.14, w: 0.16, h: 0.046 },
];
