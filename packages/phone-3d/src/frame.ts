/** How `<PhoneStage>` frames the phone. Free of three.js so the server-rendered sketch can share it. */

/** World height the model is normalised to (Nokia3310.tsx). */
export const STAGE_HEIGHT = 10;

/** The stage camera's distance and vertical field of view without `fit`. */
export const CAMERA_Z = 15;
export const CAMERA_FOV = 42;

/** The world height the default camera sees at the phone's front plane (z = 0 when flat). */
export const VIEW_HEIGHT_AT_ORIGIN = 2 * CAMERA_Z * Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180);

/** How long the phone takes to form out of its flat outline (PhoneStage `form`). */
export const FORM_MS = 1100;

/**
 * The phone's depth `ms` into forming, from flat (0) to full (1). It overshoots a little, as if it
 * popped up out of the surface it lay flat in, and settles.
 */
export function formDepth(ms: number, durationMs = FORM_MS): number {
  if (ms <= 0) return 0;
  if (ms >= durationMs) return 1;
  const t = ms / durationMs - 1;
  const overshoot = 1.9;
  return 1 + (overshoot + 1) * t ** 3 + overshoot * t ** 2;
}
