/** How `<PhoneStage>` frames the phone. Free of three.js so the server-rendered sketch can share it. */

/** World height the model is normalised to (Nokia3310.tsx). */
export const STAGE_HEIGHT = 10;

/** The stage camera's distance and vertical field of view without `fit`. */
export const CAMERA_Z = 15;
export const CAMERA_FOV = 42;

/** The world height the default camera sees at the phone's front plane (z = 0 when flat). */
export const VIEW_HEIGHT_AT_ORIGIN = 2 * CAMERA_Z * Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180);

/** How long the phone takes to form out of its flat outline (PhoneStage `form`). */
export const FORM_MS = 1600;

/** How long its depth takes to pop out (the rest of FORM_MS is the leap settling). */
export const DEPTH_MS = 800;

/**
 * The phone's depth `ms` into forming, from flat (0) to full (1). It overshoots well past full, as
 * if it popped up out of the surface it lay flat in, and settles.
 */
export function formDepth(ms: number, durationMs = DEPTH_MS): number {
  if (ms <= 0) return 0;
  if (ms >= durationMs) return 1;
  const t = ms / durationMs - 1;
  const overshoot = 2.6;
  return 1 + (overshoot + 1) * t ** 3 + overshoot * t ** 2;
}

/** The phone's pose while forming, beyond its depth (all neutral at the start and the end). */
export interface FormPose {
  /** Depth scale: flat 0 to full 1. */
  depth: number;
  /** Lift towards the camera, as a fraction of the camera's distance (the phone looks this much
   *  bigger: 1 / (1 - lift)). */
  lift: number;
  /** Scale across the face: squashed flat, bulging as it leaps. */
  spread: number;
  /** Wobble, radians about the screen's x and y axes. */
  tiltX: number;
  tiltY: number;
  /** How far forming has got, 0 to 1: idle motion blends in with it. */
  settled: number;
  /**
   * The height of a line across the drawing (Nokia3310Sketch, same `fit`) the phone tilts and
   * spreads about instead of its centre: a reveal's edge.
   */
  pivot?: number;
  /**
   * How firmly the phone is pinned to the drawing, 0 to 1 (default 1): pinned, its front lies
   * over the drawing on screen whatever its depth, and it turns about its front at `pivot`'s
   * height. 0 turns it about its middle, where it would be anyway.
   */
  pin?: number;
  /**
   * The height of a line across the drawing below which the phone isn't drawn, as the camera
   * sees it: a reveal's edge, so none of the phone shows past the drawing still covering it.
   */
  cut?: number;
  /** An offset across (`x`) and up (`y`) the page, in world units (the phone is 10 tall). */
  x?: number;
  y?: number;
}

/** How far the phone leaps towards the camera (peaks ≈ 16 % bigger). */
const LEAP = 0.16;

/** The share of forming spent squashed before the leap. */
const SQUASH = 1 / 6;

/**
 * The phone `ms` into forming: it squashes, then leaps up off the surface as its depth pops out,
 * bulging and wobbling, and drops back to rest. Starts exactly flat (the sketch's outline).
 */
export function formPose(ms: number): FormPose {
  const t = Math.min(1, Math.max(0, ms / FORM_MS));
  const decay = (1 - t) ** 2;
  return {
    depth: formDepth(ms),
    // Up fast, down slower, peaking around a third of the way.
    lift: LEAP * Math.sin(Math.PI * t) * Math.exp(-2.2 * t) * 2.1,
    // A quick squash as it starts, then a bulge that rings down.
    spread:
      t < SQUASH
        ? 1 - 0.07 * Math.sin((Math.PI * t) / SQUASH)
        : 1 + 0.06 * Math.sin(3.2 * Math.PI * (t - SQUASH)) * decay,
    tiltX: 0.32 * Math.sin(3 * Math.PI * t) * decay,
    tiltY: -0.22 * Math.sin(2 * Math.PI * t) * decay,
    settled: t,
  };
}
