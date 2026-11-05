/**
 * Device tilt, read from the orientation sensor: the stage holds its light still in the world as
 * the handset it is shown on turns, so the light moves across the phone. Devices without a sensor
 * (desktops) never report angles, so their light stays put.
 *
 * The sensor's angles are Euler angles, which lock up as the handset stands upright (beta near
 * ±90°: gamma and alpha swing through 180° for a hair's movement). So readings become
 * quaternions, and the tilt is the rotation from the rest pose to now, steady in any grip.
 */
import * as THREE from "three";

/** A sensor reading in degrees (DeviceOrientationEvent): about the screen's normal, its x and its y. */
export interface OrientationReading {
  alpha: number;
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

const RAD = Math.PI / 180;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/**
 * The screen's orientation in the world for a reading (the spec's intrinsic Z-X'-Y''), turned by
 * the screen's own rotation (0, 90, 180, 270) so its axes follow the picture, not the hardware.
 */
export function screenQuaternion(
  { alpha, beta, gamma }: OrientationReading,
  screenAngle: number,
): THREE.Quaternion {
  const turn = (axis: THREE.Vector3, degrees: number) =>
    new THREE.Quaternion().setFromAxisAngle(axis, degrees * RAD);
  return turn(Z, alpha)
    .multiply(turn(X, beta))
    .multiply(turn(Y, gamma))
    .multiply(turn(Z, -screenAngle));
}

/** `rest` moved towards `now` over `dt` seconds (exponential, time constant REST_SECONDS). */
export function settleRest(
  rest: THREE.Quaternion,
  now: THREE.Quaternion,
  dt: number,
): THREE.Quaternion {
  return rest.clone().slerp(now, 1 - Math.exp(-dt / REST_SECONDS));
}

/** How far the screen has tilted from `rest` to `now`, degrees in the screen's axes. */
export function tiltBetween(rest: THREE.Quaternion, now: THREE.Quaternion): ScreenTilt {
  // The turn in the screen's own frame, as an axis times its angle.
  const q = rest.clone().invert().multiply(now);
  if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  const half = Math.acos(Math.min(1, q.w));
  const s = Math.sin(half);
  const k = s < 1e-9 ? 2 / RAD : (2 * half) / s / RAD;
  // About the screen's y (the right edge going down) and its x (the top edge).
  return { x: q.y * k, y: q.x * k };
}

/**
 * How the world turns relative to the screen for a tilt from rest: against the device, as
 * something held still in the world while the handset moves around it would. Clamped at
 * MAX_DEGREES.
 */
export function tiltRotation(tilt: ScreenTilt): { x: number; y: number } {
  const clamp = (v: number) => Math.max(-MAX_DEGREES, Math.min(MAX_DEGREES, v));
  return { x: -clamp(tilt.y) * RADIANS_PER_DEGREE, y: -clamp(tilt.x) * RADIANS_PER_DEGREE };
}

interface OrientationPermission {
  requestPermission?: () => Promise<"granted" | "denied">;
}

/**
 * Follows the orientation sensor, calling `onReading` with the screen's orientation for each
 * reading that has angles (none arrive without a sensor). iOS asks permission first, which needs
 * a user gesture: the first tap anywhere on the page asks. Returns the unsubscribe.
 */
export function watchTilt(onReading: (orientation: THREE.Quaternion) => void): () => void {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return () => {};
  const listen = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) return;
    onReading(
      screenQuaternion(
        { alpha: event.alpha ?? 0, beta: event.beta, gamma: event.gamma },
        window.screen.orientation?.angle ?? 0,
      ),
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
