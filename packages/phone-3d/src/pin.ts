/** Holding the 3D phone to the drawing it reveals from (FormPose `pivot`, `pin`, `cut`). */

type Vec3 = readonly [number, number, number];

/**
 * Where a line at height `h` across the drawing falls, `atZ` deep, as seen from `camera`: the
 * drawing is the phone flat, seen from `paper` (the stage's camera for no depth). Both cameras
 * face the phone head on.
 */
export function onDrawingLine(camera: Vec3, paper: Vec3, h: number, atZ: number): Vec3 {
  const [x, y, z] = camera;
  const [px, py, pz] = paper;
  return [x - (px / pz) * (z - atZ), y + ((h - py) / pz) * (z - atZ), atZ];
}

export interface PinInput {
  camera: Vec3;
  paper: Vec3;
  /** The height on the drawing the phone turns about. */
  pivot: number;
  /** How firmly it is pinned, 0–1. */
  pin: number;
  /** How far forward the phone's front comes at rest (its depth scale 1). */
  front: number;
  depth: number;
  spread: number;
  /** Towards the camera, a share of its distance. */
  lift: number;
}

/** The phone's rig: it sits at `position`, scaled, and the phone hangs off it by `hang`. */
export interface PinnedRig {
  position: Vec3;
  scale: Vec3;
  hang: Vec3;
}

/**
 * Pinned, the rig sits on the phone's front at `pivot`'s height, over the drawing's line there,
 * and the phone is scaled so its front lies over the drawing at every height: where the pivot is
 * decides only what the phone turns about, never where it sits. Unpinned, it turns about its
 * middle at `pivot`'s height, where it would be anyway.
 */
export function pinRig({
  camera,
  paper,
  pivot,
  pin,
  front,
  depth,
  spread,
  lift,
}: PinInput): PinnedRig {
  const forward = front * pin;
  const [heldX, heldY, heldZ] = onDrawingLine(camera, paper, pivot, forward * depth);
  const drawn = 1 + ((camera[2] - heldZ) / paper[2] - 1) * pin;
  return {
    position: [heldX * pin, pivot + (heldY - pivot) * pin, heldZ + lift * camera[2]],
    scale: [spread * drawn, spread * drawn, depth],
    hang: [0, -pivot, -forward],
  };
}
