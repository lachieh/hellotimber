import { FORM_MS, formPose } from "@hellotimber/phone-3d";
import type { FormPose } from "@hellotimber/phone-3d";

/** How long the drawing takes to turn into the phone, top to bottom. */
export const WIPE_MS = 650;

/** When the phone starts leaping off the page: just after the edge sets off, so it pitches up
 *  and rises out of the drawing while the edge sweeps over it. */
export const LEAP_MS = 100;

/** How long the whole reveal runs, until the phone has settled. */
export const REVEAL_MS = LEAP_MS + FORM_MS;

/** Everything the reveal moves, at one instant. */
export interface RevealFrame {
  /** How far the drawing has turned into the phone, 0–1 (Nokia3310Sketch `wipe`). */
  wipe: number;
  /** The 3D phone (PhoneStage `pose`). */
  pose: FormPose;
}

/**
 * The phone's least depth: thin enough to line up with the drawing before it moves, thick enough
 * that its layers (keys, island, LCD) don't fight over the same depth.
 */
const WIPE_DEPTH = 0.06;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The reveal `ms` after the 3D model is ready under the drawing. A fine rule sweeps down the
 * drawing, turning it into the real phone, and as it goes the phone pops out of the page: it
 * pitches up and leaps off it (phone-3d's `formPose`), then settles.
 */
export function revealAt(ms: number): RevealFrame {
  const wipe = easeInOut(Math.min(1, Math.max(0, ms / WIPE_MS)));
  const pose = formPose(Math.max(0, ms - LEAP_MS));
  return { wipe, pose: { ...pose, depth: Math.max(WIPE_DEPTH, pose.depth) } };
}

/** The drawing, before anything moves (what the server renders). */
export const DRAWN = revealAt(0);

/** The phone at rest once revealed. */
export const REVEALED = revealAt(REVEAL_MS);
