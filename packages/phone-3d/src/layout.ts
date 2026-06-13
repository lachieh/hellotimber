import type { Nokia3310Key } from "./types";

export type KeyShape = "pill" | "rockerUp" | "rockerDown" | "wave" | "oval";

export interface KeyLayoutEntry {
  key: Nokia3310Key;
  /** Center of the key at rest, world units (1 unit = 1 cm). */
  position: [number, number, number];
  /** Bounding size [x, y, z]. */
  size: [number, number, number];
  shape: KeyShape;
}

/** Z travel of a depressed key. */
export const KEY_PRESS_DEPTH = 0.04;

/** Digit-grid geometry: columns left/center/right, four rows top→bottom. */
export const DIGIT_COLUMN_X = [-1.4, 0, 1.4] as const;
export const DIGIT_ROW_Y = [-0.35, -0.95, -1.55, -2.15] as const;
/** Per-column upward offset — center column raised = the 3310 keypad arc. */
export const ARC_OFFSET = [0.08, 0.16, 0.08] as const;
export const DIGIT_KEY_SIZE: [number, number, number] = [1.25, 0.48, 0.1];

const DIGIT_GRID: ReadonlyArray<ReadonlyArray<Nokia3310Key>> = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

/** Center of digit key at grid (row 0–3, col 0–2), including the arc offset. */
export function digitKeyPosition(row: number, col: number): [number, number, number] {
  return [DIGIT_COLUMN_X[col], DIGIT_ROW_Y[row] + ARC_OFFSET[col], 1.12];
}

export const KEY_LAYOUT: ReadonlyArray<KeyLayoutEntry> = [
  // Blue NaviKey pill, centered directly below the screen (spec §1.3).
  { key: "navi", position: [0, 0.85, 1.15], size: [1.8, 0.55, 0.12], shape: "pill" },
  // C key below-left of the NaviKey (spec §1.4).
  { key: "c", position: [-1.35, 0.45, 1.12], size: [0.85, 0.45, 0.1], shape: "oval" },
  // Up/down scroll rocker below-right, two press zones abutting at y=0.45 (spec §1.5).
  { key: "up", position: [1.35, 0.62, 1.12], size: [0.85, 0.34, 0.1], shape: "rockerUp" },
  { key: "down", position: [1.35, 0.28, 1.12], size: [0.85, 0.34, 0.1], shape: "rockerDown" },
  // Stiff black oval power button on the top edge (spec §1, "Top edge").
  { key: "power", position: [0, 5.7, 0.3], size: [0.7, 0.22, 0.35], shape: "oval" },
  // 4×3 wave-styled digit grid (spec §1.6).
  ...DIGIT_GRID.flatMap((rowKeys, row) =>
    rowKeys.map(
      (key, col): KeyLayoutEntry => ({
        key,
        position: digitKeyPosition(row, col),
        size: DIGIT_KEY_SIZE,
        shape: "wave",
      }),
    ),
  ),
];
