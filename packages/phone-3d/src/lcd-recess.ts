/**
 * The bezel's shadow on the LCD. The display sits a little below the bezel's lip, so the key light
 * leaves a band of shadow inside the opening, along the edges facing it. It follows the light as
 * the device's tilt turns it and the phone as it turns, and it grows and shrinks with the phone's
 * depth: squashed flat there is no recess, so no shadow.
 */
import * as THREE from "three";

/** How the bezel's shadow on the LCD looks. */
export interface LcdShadow {
  /** How dark it is with the key light straight on to the LCD: the share of its light the lip
   *  takes away (the LCD isn't lit by the scene's lights, it's lit by its lightmap). */
  opacity: number;
  /** Its soft edge, either side of the line the lip casts, as a fraction of the recess. */
  softness: number;
  /** How much softer it gets the further it falls, as a share of how far it reaches. */
  spread: number;
  /** The longest it gets, as a multiple of the recess (when the light grazes the LCD). */
  reach: number;
  /** The recess, times the depth measured off the model (LCD_RECESS). */
  depth: number;
  /** Draw it in red at full strength, to see where it falls. */
  highlight: boolean;
}

export const LCD_SHADOW: LcdShadow = {
  opacity: 0.42,
  softness: 0.6,
  spread: 0.3,
  reach: 12,
  depth: 1,
  highlight: false,
};

export interface RecessShadow {
  /** Where a point on the LCD looks, along its ray to the light, at the lip's height: the point
   *  is in shadow where that is outside the opening. */
  offset: [number, number];
  /** How dark the shadow is, 0 to 1: the share of the key light that would have lit the LCD,
   *  which fades as the light grazes it, and is none from behind. */
  strength: number;
}

/**
 * The lip's shadow on the LCD. `towardLight` is the direction to the key light in the LCD's own
 * (unscaled) space, so a phone squashed flat (its z scaled down) sees the light from nearly
 * straight on; `recess` is the lip's height above the LCD in the same space, and `maxReach` the
 * longest the shadow gets, in recesses.
 */
export function recessShadow(
  towardLight: readonly [number, number, number],
  recess: number,
  maxReach = LCD_SHADOW.reach,
): RecessShadow {
  const [x, y, z] = towardLight;
  const length = Math.hypot(x, y, z);
  const across = Math.hypot(x, y);
  if (length === 0 || z <= 0) return { offset: [0, 0], strength: 0 };
  const strength = z / length;
  if (across === 0) return { offset: [0, 0], strength };
  const reach = Math.min(maxReach, across / z) * recess;
  return { offset: [(x / across) * reach, (y / across) * reach], strength };
}

const inverse = new THREE.Matrix4();

/** The direction to a light, `world` (from the lit point towards it), in `object`'s own space. */
export function towardLightIn(
  object: THREE.Object3D,
  world: THREE.Vector3,
): [number, number, number] {
  // A direction, not a normal: the inverse (not its transpose) undoes the object's squash.
  const local = world.clone().transformDirection(inverse.copy(object.matrixWorld).invert());
  return [local.x, local.y, local.z];
}
