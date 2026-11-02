import type { FormPose } from "@hellotimber/phone-3d";
import { computeClipState, computeStaticTimeline, parseTimelineConfig } from "dialkit/timeline";
import type { EasingConfig } from "dialkit/store";
import type { TimelineConfig } from "dialkit/timeline";

/** A cubic-bezier easing. Its duration is the clip's or step's (the bar's length in the dock). */
const easing = (ease: EasingConfig["ease"]): EasingConfig => ({
  type: "easing",
  duration: 1,
  ease,
});

/** Ease out: quick off the mark, gentle into place. */
const OUT = easing([0.2, 0.7, 0.3, 1]);
/** Ease in and out, for the settling swings. */
const IN_OUT = easing([0.45, 0, 0.35, 1]);
const LINEAR = easing([0, 0, 1, 1]);

/**
 * A value with its slider in the dock: `[value, min, max, step]`. DialKit otherwise guesses the
 * range from the property's name and rounds to it (whole numbers for `x`, `y` and `spread`).
 */
const dial = (value: number, min: number, max: number, step = 0.005) =>
  [value, min, max, step] as [number, number, number, number];
const unit = (value: number) => dial(value, 0, 1, 0.01);
const scale = (value: number) => dial(value, 0.6, 1.6);
/** Degrees of pitch (top edge towards you) or yaw (right edge away). */
const degrees = (value: number) => dial(value, -45, 45, 0.5);

/** When the drawing starts its leap: the 3D phone takes over from here. */
const LEAP_AT = 0.52;

/**
 * The phone coming to life, in seconds from the moment the 3D model is ready under the drawing.
 * The ink boils and loses its print dots, the drawing squashes down like a cartoon about to
 * jump, action lines burst out and the 3D phone pitches up and leaps out of the ink, wobbling
 * back down to hover over the desk. One clip per thing that moves; DialKit's timeline dock edits
 * it in dev (RevealTuner), and the same config plays in production (`sampleReveal`).
 */
export const REVEAL = {
  boil: {
    at: 0,
    from: { amount: unit(0) },
    transition: OUT,
    steps: [
      { duration: 0.25, to: { amount: unit(1) } },
      { duration: 0.35, to: { amount: unit(1) } },
      { duration: 0.3, to: { amount: unit(0) } },
    ],
  },
  halftone: {
    at: 0.1,
    duration: 0.45,
    from: { dots: unit(1) },
    to: { dots: unit(0) },
    transition: IN_OUT,
  },
  squash: {
    at: 0.3,
    from: { across: scale(1), up: scale(1) },
    transition: IN_OUT,
    steps: [
      { duration: 0.22, to: { across: scale(1.06), up: scale(0.9) } },
      { duration: 0.12, to: { across: scale(0.97), up: scale(1.05) }, transition: OUT },
      { duration: 0.25, to: { across: scale(1), up: scale(1) } },
    ],
  },
  ink: {
    at: 0.6,
    duration: 0.25,
    from: { opacity: unit(1) },
    to: { opacity: unit(0) },
    transition: LINEAR,
  },
  burst: {
    at: LEAP_AT,
    from: { reach: dial(0.85, 0.5, 2.5, 0.01), opacity: unit(0) },
    transition: OUT,
    steps: [
      { duration: 0.06, to: { reach: dial(0.95, 0.5, 2.5, 0.01), opacity: unit(1) } },
      { duration: 0.45, to: { reach: dial(1.5, 0.5, 2.5, 0.01), opacity: unit(0) } },
    ],
  },
  depth: {
    at: LEAP_AT,
    from: { v: dial(0, 0, 2) },
    transition: OUT,
    steps: [
      { duration: 0.3, to: { v: dial(1.3, 0, 2) } },
      { duration: 0.25, to: { v: dial(0.92, 0, 2) }, transition: IN_OUT },
      { duration: 0.25, to: { v: dial(1, 0, 2) }, transition: IN_OUT },
    ],
  },
  lift: {
    at: LEAP_AT,
    from: { v: dial(0, 0, 0.5) },
    transition: OUT,
    steps: [
      { duration: 0.35, to: { v: dial(0.16, 0, 0.5) } },
      { duration: 0.8, to: { v: dial(0, 0, 0.5) }, transition: IN_OUT },
    ],
  },
  spread: {
    at: LEAP_AT,
    from: { v: scale(1) },
    transition: IN_OUT,
    steps: [
      { duration: 0.2, to: { v: scale(1.06) } },
      { duration: 0.3, to: { v: scale(0.98) } },
      { duration: 0.3, to: { v: scale(1) } },
    ],
  },
  // Pitches up out of the desk, top edge first, and rocks back down.
  wobble: {
    at: LEAP_AT,
    from: { pitch: degrees(0), yaw: degrees(0) },
    transition: IN_OUT,
    steps: [
      { duration: 0.22, to: { pitch: degrees(18), yaw: degrees(-10) }, transition: OUT },
      { duration: 0.3, to: { pitch: degrees(-7), yaw: degrees(6) } },
      { duration: 0.35, to: { pitch: degrees(2.5), yaw: degrees(-2) } },
      { duration: 0.3, to: { pitch: degrees(0), yaw: degrees(0) } },
    ],
  },
  settle: {
    at: LEAP_AT,
    duration: 1.2,
    from: { v: unit(0) },
    to: { v: unit(1) },
    transition: LINEAR,
  },
} satisfies TimelineConfig;

export type RevealClip = keyof typeof REVEAL;

/** Each clip's values at one instant (DialKit's `clip.current`). */
export type RevealSample = Record<RevealClip, Record<string, unknown>>;

/** Everything the reveal moves, at one instant. */
export interface RevealFrame {
  /** The drawing's line boil and printed dots, 0–1 (Nokia3310Sketch `boil`, `halftone`). */
  boil: number;
  halftone: number;
  /** The drawing's opacity over the 3D phone. */
  ink: number;
  /** The cartoon squash of drawing and phone together, across and up. */
  squashX: number;
  squashY: number;
  /** The action lines (Nokia3310Burst). */
  burstSpread: number;
  burstOpacity: number;
  /** The 3D phone (PhoneStage `pose`). */
  pose: FormPose;
}

const RADIANS = Math.PI / 180;

const num = (values: Record<string, unknown>, key: string, fallback: number): number => {
  const value = values[key];
  return typeof value === "number" ? value : fallback;
};

export function revealFrame(sample: RevealSample): RevealFrame {
  return {
    boil: num(sample.boil, "amount", 0),
    halftone: num(sample.halftone, "dots", 1),
    ink: num(sample.ink, "opacity", 1),
    squashX: num(sample.squash, "across", 1),
    squashY: num(sample.squash, "up", 1),
    burstSpread: num(sample.burst, "reach", 1),
    burstOpacity: num(sample.burst, "opacity", 0),
    pose: {
      depth: num(sample.depth, "v", 1),
      lift: num(sample.lift, "v", 0),
      spread: num(sample.spread, "v", 1),
      tiltX: num(sample.wobble, "pitch", 0) * RADIANS,
      tiltY: num(sample.wobble, "yaw", 0) * RADIANS,
      settled: num(sample.settle, "v", 1),
    },
  };
}

const timeline = computeStaticTimeline(parseTimelineConfig(REVEAL), {});

/** How long the reveal runs, in seconds. */
export const REVEAL_SECONDS = Math.max(
  timeline.duration,
  ...timeline.clips.map((clip) => clip.at + clip.duration),
);

/** REVEAL sampled `seconds` in. */
export function sampleReveal(seconds: number): RevealFrame {
  const sample = Object.fromEntries(
    timeline.clips.map((clip) => [
      clip.key,
      computeClipState(clip, Math.min(REVEAL_SECONDS, Math.max(0, seconds))).current,
    ]),
  ) as RevealSample;
  return revealFrame(sample);
}

/** The drawing, before anything moves (what the server renders). */
export const DRAWN = sampleReveal(0);

/** The phone at rest once revealed: no ink, no lines, the 3D phone settled. */
export const REVEALED: RevealFrame = {
  boil: 0,
  halftone: 0,
  ink: 0,
  squashX: 1,
  squashY: 1,
  burstSpread: 1,
  burstOpacity: 0,
  pose: { depth: 1, lift: 0, spread: 1, tiltX: 0, tiltY: 0, settled: 1 },
};
