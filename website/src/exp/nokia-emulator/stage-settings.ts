import type { StageDrift, StageOrbit } from "@hellotimber/phone-3d";
import { REVEAL_MS } from "../../phone/reveal";

/** The phone's technical drawing in the studio: light lines on the dark stage. */
export const DRAWING = { ink: "#c9ced3", paper: "#16181b" } as const;

/** What the Stage tab sets about the studio. */
export interface StageSettings {
  /** The key light's bearing around the phone, degrees clockwise from the camera (0 = front). */
  lightAngle: number;
  /** The key light's strength, times its default. */
  lightIntensity: number;
  /** The camera's bearing and height about the phone, degrees. */
  yaw: number;
  pitch: number;
  /** The phone's size on the stage, % of its default framing. */
  scale: number;
  /** The sketch-to-3D reveal, ms into it (REVEAL_MS: revealed). */
  reveal: number;
  /** The phone's idle float. */
  float: boolean;
}

export const LIGHT_ANGLE = { min: -180, max: 180 } as const;
export const LIGHT_INTENSITY = { min: 0, max: 3 } as const;
export const YAW = { min: -75, max: 75 } as const;
export const PITCH = { min: -35, max: 35 } as const;
export const SCALE = { min: 50, max: 125 } as const;

export const DEFAULT_STAGE: StageSettings = {
  lightAngle: 40,
  lightIntensity: 1.6,
  yaw: 0,
  // A little above the phone, so its contact shadow reads on the floor.
  pitch: 8,
  scale: 100,
  reveal: REVEAL_MS,
  float: true,
};

/** How much of the stage's limiting side the phone spans at 100 %. */
export const BASE_FIT = 0.68;

export function fitForScale(scale: number): number {
  return (BASE_FIT * scale) / 100;
}

const RAD = Math.PI / 180;

/** The key light high up on a circle about the phone, at the bearing `angle`. */
export function keyLightPosition(angle: number, distance = 10): [number, number, number] {
  return [Math.sin(angle * RAD) * distance, distance * 0.7, Math.cos(angle * RAD) * distance];
}

/** The rim light: behind the phone, opposite the key light. */
export function rimLightPosition(angle: number, distance = 10): [number, number, number] {
  return [-Math.sin(angle * RAD) * distance, distance * 0.35, -distance * 0.9];
}

export function orbitOf(settings: Pick<StageSettings, "yaw" | "pitch">): StageOrbit {
  return { yaw: settings.yaw * RAD, pitch: settings.pitch * RAD };
}

/** The float's period: slow enough to read as hovering, not bobbing. */
const FLOAT_PERIOD_MS = 6400;

/** The idle float `ms` into it: a slow rise and fall with a little sway. */
export function floatAt(ms: number): StageDrift {
  const phase = (ms / FLOAT_PERIOD_MS) * 2 * Math.PI;
  return {
    y: 0.14 * Math.sin(phase),
    tiltX: 0.025 * Math.sin(phase - 0.6),
    tiltY: 0.04 * Math.sin(phase * 0.5),
  };
}

export const STILL: StageDrift = { y: 0, tiltX: 0, tiltY: 0 };
