import { LCD_SHADOW } from "@hellotimber/phone-3d";
import type { LcdShadow, ScreenTilt, StageDrift, StageOrbit } from "@hellotimber/phone-3d";
import { REVEAL_MS } from "../../phone/reveal";

/** The phone's technical drawing in the studio: light lines on the dark stage. */
export const DRAWING = { ink: "#c9ced3", paper: "#16181b" } as const;

/** What the Stage tab sets about the studio. */
export interface StageSettings {
  /** The key light's bearing around the phone, degrees clockwise from the camera (0 = front). */
  lightAngle: number;
  /** The key light's strength, times its default. */
  lightIntensity: number;
  /** The phone's turn on the stage, degrees: `yaw` shows its right side, `pitch` its top. The
   *  camera stays put, so the floor and the light's pool on it hold still. */
  yaw: number;
  pitch: number;
  /** The phone's size on the stage, % of its default framing. */
  scale: number;
  /** The sketch-to-3D reveal, ms into it (REVEAL_MS: revealed). */
  reveal: number;
  /** The phone's idle float. */
  float: boolean;
  /** The bezel's shadow on the LCD. */
  lcdShadow: LcdShadow;
  /** The tilt sensor, held: the device's tilt from rest, degrees in the screen's axes. */
  tilt: ScreenTilt;
}

export const LIGHT_ANGLE = { min: -180, max: 180 } as const;
export const LIGHT_INTENSITY = { min: 0, max: 3 } as const;
export const YAW = { min: -75, max: 75 } as const;
export const PITCH = { min: -35, max: 35 } as const;
export const SCALE = { min: 50, max: 125 } as const;
/** The tilt sensor's range (tilt.ts saturates past 25°). */
export const TILT = { min: -25, max: 25 } as const;

/** The LCD shadow's sliders. */
export const LCD_SHADOW_RANGE = {
  opacity: { min: 0, max: 1, step: 0.01 },
  softness: { min: 0, max: 3, step: 0.05 },
  spread: { min: 0, max: 1.5, step: 0.05 },
  reach: { min: 1, max: 30, step: 0.5 },
  depth: { min: 0, max: 4, step: 0.05 },
} as const satisfies Record<string, { min: number; max: number; step: number }>;

export const DEFAULT_STAGE: StageSettings = {
  lightAngle: 40,
  lightIntensity: 1.6,
  yaw: 0,
  pitch: 0,
  scale: 100,
  reveal: REVEAL_MS,
  float: true,
  lcdShadow: LCD_SHADOW,
  tilt: { x: 0, y: 0 },
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

/** The studio camera: a little above the phone, so its contact shadow reads on the floor. */
export const CAMERA: StageOrbit = { yaw: 0, pitch: 8 * RAD };

/** The phone turned by the Stage tab's knobs, over its idle `float`. */
export function turned(
  settings: Pick<StageSettings, "yaw" | "pitch">,
  float: StageDrift,
): StageDrift {
  return {
    y: float.y,
    tiltX: float.tiltX + settings.pitch * RAD,
    tiltY: float.tiltY - settings.yaw * RAD,
  };
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
