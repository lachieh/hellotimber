// From the three-free entry: the homepage and the posts time the reveal before three.js loads.
import {
  FORM_MS,
  formPose,
  OUTLINE_BOTTOM,
  wipeLine,
  type FormPose,
} from "@hellotimber/phone-3d/sketch";

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
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (t: number) => Math.min(1, Math.max(0, t));

/** After the wipe, how long the phone takes to let go of the page and leap free. */
const RELEASE_MS = 250;

/** How far the phone pitches up about the edge per unit of the leap it holds back (radians). */
const PEEL = 2;

/**
 * The reveal `ms` after the 3D model is ready under the drawing. A fine rule sweeps down the
 * drawing, turning it into the real phone. While it sweeps, the phone is hinged to it: what is
 * revealed peels up off the page about the edge, and nothing shows below it (FormPose `pivot`
 * and `cut`). Once the drawing has gone the phone lets go and the rest of its leap plays out
 * (phone-3d's `formPose`), settling at rest.
 */
export function revealAt(ms: number): RevealFrame {
  const wipe = easeInOut(clamp(ms / WIPE_MS));
  const base = formPose(Math.max(0, ms - LEAP_MS));
  // 1 while the phone is hinged to the edge; moving it towards the camera or turning or
  // spreading it any other way would pull it off the line, so the leap becomes the peel.
  const held = 1 - smooth(clamp((ms - WIPE_MS) / RELEASE_MS));
  const free = 1 - held;
  const line = wipeLine(wipe);
  const pose: FormPose = {
    ...base,
    depth: Math.max(WIPE_DEPTH, base.depth),
    lift: base.lift * free,
    spread: 1 + (base.spread - 1) * free,
    tiltX: base.tiltX + PEEL * base.lift * held,
    tiltY: base.tiltY * free,
    // Past the phone's bottom the edge can't hold it: it rocks on its bottom edge, and as it
    // lets go it turns about its centre again (where a host's own drift turns it at rest).
    pivot: Math.max(line, OUTLINE_BOTTOM) * held,
  };
  if (wipe < 1) pose.cut = line;
  return { wipe, pose };
}

/** The drawing, before anything moves (what the server renders). */
export const DRAWN = revealAt(0);

/** The phone at rest once revealed. */
export const REVEALED = revealAt(REVEAL_MS);
