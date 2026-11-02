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

/** When the drawing starts its leap: the 3D phone takes over from here. */
const LEAP_AT = 0.52;

/**
 * The phone coming to life, in seconds from the moment the 3D model is ready under the drawing.
 * The ink boils and loses its print dots, the drawing squashes down like a cartoon about to
 * jump, action lines burst out and the 3D phone leaps out of the ink, wobbling back down to
 * hover over the desk. One clip per thing that moves; DialKit's timeline dock edits it in dev
 * (RevealTuner), and the same config plays in production (`sampleReveal`).
 */
export const REVEAL = {
  boil: {
    at: 0,
    from: { amount: 0 },
    transition: OUT,
    steps: [
      { duration: 0.25, to: { amount: 1 } },
      { duration: 0.35, to: { amount: 1 } },
      { duration: 0.3, to: { amount: 0 } },
    ],
  },
  halftone: { at: 0.1, duration: 0.45, from: { dots: 1 }, to: { dots: 0 }, transition: IN_OUT },
  squash: {
    at: 0.3,
    from: { x: 1, y: 1 },
    transition: IN_OUT,
    steps: [
      { duration: 0.22, to: { x: 1.06, y: 0.9 } },
      { duration: 0.12, to: { x: 0.97, y: 1.05 }, transition: OUT },
      { duration: 0.25, to: { x: 1, y: 1 } },
    ],
  },
  ink: { at: 0.6, duration: 0.25, from: { opacity: 1 }, to: { opacity: 0 }, transition: LINEAR },
  burst: {
    at: LEAP_AT,
    from: { spread: 0.85, opacity: 0 },
    transition: OUT,
    steps: [
      { duration: 0.06, to: { spread: 0.95, opacity: 1 } },
      { duration: 0.45, to: { spread: 1.5, opacity: 0 } },
    ],
  },
  depth: {
    at: LEAP_AT,
    from: { v: 0 },
    transition: OUT,
    steps: [
      { duration: 0.3, to: { v: 1.3 } },
      { duration: 0.25, to: { v: 0.92 }, transition: IN_OUT },
      { duration: 0.25, to: { v: 1 }, transition: IN_OUT },
    ],
  },
  lift: {
    at: LEAP_AT,
    from: { v: 0 },
    transition: OUT,
    steps: [
      { duration: 0.35, to: { v: 0.16 } },
      { duration: 0.8, to: { v: 0 }, transition: IN_OUT },
    ],
  },
  spread: {
    at: LEAP_AT,
    from: { v: 1 },
    transition: IN_OUT,
    steps: [
      { duration: 0.2, to: { v: 1.06 } },
      { duration: 0.3, to: { v: 0.98 } },
      { duration: 0.3, to: { v: 1 } },
    ],
  },
  wobble: {
    at: LEAP_AT,
    from: { x: 0, y: 0 },
    transition: IN_OUT,
    steps: [
      { duration: 0.25, to: { x: 0.28, y: -0.18 } },
      { duration: 0.3, to: { x: -0.12, y: 0.1 } },
      { duration: 0.35, to: { x: 0.04, y: -0.03 } },
      { duration: 0.3, to: { x: 0, y: 0 } },
    ],
  },
  settle: { at: LEAP_AT, duration: 1.2, from: { v: 0 }, to: { v: 1 }, transition: LINEAR },
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

const num = (values: Record<string, unknown>, key: string, fallback: number): number => {
  const value = values[key];
  return typeof value === "number" ? value : fallback;
};

export function revealFrame(sample: RevealSample): RevealFrame {
  return {
    boil: num(sample.boil, "amount", 0),
    halftone: num(sample.halftone, "dots", 1),
    ink: num(sample.ink, "opacity", 1),
    squashX: num(sample.squash, "x", 1),
    squashY: num(sample.squash, "y", 1),
    burstSpread: num(sample.burst, "spread", 1),
    burstOpacity: num(sample.burst, "opacity", 0),
    pose: {
      depth: num(sample.depth, "v", 1),
      lift: num(sample.lift, "v", 0),
      spread: num(sample.spread, "v", 1),
      tiltX: num(sample.wobble, "x", 0),
      tiltY: num(sample.wobble, "y", 0),
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
