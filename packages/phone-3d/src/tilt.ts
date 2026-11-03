/**
 * Device tilt, read from the orientation sensor: the stage holds its light still in the world as
 * the handset it is shown on turns, so the light moves across the phone. Devices without a sensor
 * (desktops) never report angles, so their light stays put.
 */

/** A sensor reading in degrees: `beta` front-to-back, `gamma` left-to-right (DeviceOrientationEvent). */
export interface TiltReading {
  beta: number;
  gamma: number;
}

/** Tilt in the screen's own axes, degrees: `x` towards the right edge going down, `y` the top edge. */
export interface ScreenTilt {
  x: number;
  y: number;
}

/** Radians of rotation per degree of device tilt from rest, and the tilt that saturates. */
const RADIANS_PER_DEGREE = 0.012;
const MAX_DEGREES = 25;

/** Seconds for the rest pose to catch up with how the device is held, so a new grip re-centres. */
export const REST_SECONDS = 2.5;

/** Device angles turned into the screen's axes for its current orientation (0, 90, 180, 270). */
export function screenTilt({ beta, gamma }: TiltReading, screenAngle: number): ScreenTilt {
  switch (((screenAngle % 360) + 360) % 360) {
    case 90:
      return { x: beta, y: -gamma };
    case 180:
      return { x: -gamma, y: -beta };
    case 270:
      return { x: -beta, y: gamma };
    default:
      return { x: gamma, y: beta };
  }
}

/** The difference of two angles, wrapped into [-180, 180). */
function delta(a: number, b: number): number {
  return ((((a - b + 180) % 360) + 360) % 360) - 180;
}

/** `rest` moved towards `now` over `dt` seconds (exponential, time constant REST_SECONDS). */
export function settleRest(rest: ScreenTilt, now: ScreenTilt, dt: number): ScreenTilt {
  const k = 1 - Math.exp(-dt / REST_SECONDS);
  return { x: rest.x + delta(now.x, rest.x) * k, y: rest.y + delta(now.y, rest.y) * k };
}

/**
 * How the world turns relative to the screen when the device tilts from `rest` to `now`: against
 * the device, as something held still in the world while the handset moves around it would.
 * Clamped at MAX_DEGREES.
 */
export function tiltRotation(rest: ScreenTilt, now: ScreenTilt): { x: number; y: number } {
  const clamp = (v: number) => Math.max(-MAX_DEGREES, Math.min(MAX_DEGREES, v));
  return {
    x: -clamp(delta(now.y, rest.y)) * RADIANS_PER_DEGREE,
    y: -clamp(delta(now.x, rest.x)) * RADIANS_PER_DEGREE,
  };
}

interface OrientationPermission {
  requestPermission?: () => Promise<"granted" | "denied">;
}

/**
 * Follows the orientation sensor, calling `onReading` with each reading that has angles (none
 * arrive without a sensor). iOS asks permission first, which needs a user gesture: the first tap
 * anywhere on the page asks. Returns the unsubscribe.
 */
export function watchTilt(onReading: (tilt: ScreenTilt) => void): () => void {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return () => {};
  const listen = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) return;
    onReading(
      screenTilt({ beta: event.beta, gamma: event.gamma }, window.screen.orientation?.angle ?? 0),
    );
  };
  window.addEventListener("deviceorientation", listen);

  const permission = DeviceOrientationEvent as unknown as OrientationPermission;
  const ask = () => {
    void permission.requestPermission?.().catch(() => "denied");
  };
  if (typeof permission.requestPermission === "function")
    window.addEventListener("pointerup", ask, { once: true });

  return () => {
    window.removeEventListener("deviceorientation", listen);
    window.removeEventListener("pointerup", ask);
  };
}
