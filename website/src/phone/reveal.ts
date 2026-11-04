// From the three-free entry: the homepage and the posts time the reveal before three.js loads.
import { OUTLINE_BOTTOM, wipeLine, type FormPose } from "@hellotimber/phone-3d/sketch";
import type { EasingConfig } from "dialkit/store";
import { computeClipState, computeStaticTimeline, parseTimelineConfig } from "dialkit/timeline";
import type { TimelineConfig } from "dialkit/timeline";

/** A cubic-bezier easing. Its duration is the clip's or step's (the bar's length in the dock). */
const easing = (ease: EasingConfig["ease"]): EasingConfig => ({
  type: "easing",
  duration: 1,
  ease,
});

/** Ease out: quick off the mark, gentle into place. */
const OUT = easing([0.2, 0.7, 0.3, 1]);
/** Ease in and out, for the edge's sweep and the settling swings. */
const IN_OUT = easing([0.45, 0, 0.55, 1]);
const SWEEP = easing([0.65, 0, 0.35, 1]);
const LINEAR = easing([0, 0, 1, 1]);

/**
 * A value with its slider in the dock: `[value, min, max, step]`. DialKit otherwise guesses the
 * range from the property's name and rounds to it.
 */
const dial = (value: number, min: number, max: number, step = 0.005) =>
  [value, min, max, step] as [number, number, number, number];
const unit = (value: number) => dial(value, 0, 1, 0.01);
const scale = (value: number) => dial(value, 0.8, 1.2);
/** Degrees of pitch (top edge towards you) or yaw (right edge away). */
const degrees = (value: number) => dial(value, -45, 45, 0.5);

/** When the phone starts to move: just after the edge sets off. */
const MOVE_AT = 0.1;
/** When the drawing has gone and the phone starts to let go of the edge. */
const LET_GO_AT = 0.65;

/**
 * The reveal, in seconds from the moment the 3D model is ready under the drawing. A fine rule
 * sweeps down the drawing (`wipe`), turning it into the real phone. While it sweeps, the phone is
 * hinged to it (`hold`): what is revealed peels up off the page about the edge (`peel`), and
 * nothing shows below it. Pinned to the edge it can't move towards the camera, spread or turn
 * sideways, so `lift`, `spread` and `yaw` only show as `hold` lets go; `depth` and `pitch` show
 * throughout. One clip per thing that moves; DialKit's timeline dock edits it in dev
 * (RevealTuner), and the same config plays in production (`revealAt`).
 */
export const REVEAL = {
  wipe: {
    at: 0,
    duration: 0.65,
    from: { v: unit(0) },
    to: { v: unit(1) },
    transition: SWEEP,
  },
  hold: {
    at: LET_GO_AT,
    duration: 0.25,
    from: { v: unit(1) },
    to: { v: unit(0) },
    transition: IN_OUT,
  },
  peel: {
    at: MOVE_AT,
    from: { pitch: degrees(0) },
    transition: IN_OUT,
    steps: [
      { duration: 0.45, to: { pitch: degrees(16) }, transition: OUT },
      { duration: 0.35, to: { pitch: degrees(0) } },
    ],
  },
  depth: {
    at: MOVE_AT,
    from: { v: dial(0, 0, 2) },
    transition: IN_OUT,
    steps: [
      { duration: 0.415, to: { v: dial(1.2, 0, 2) }, transition: OUT },
      { duration: 0.385, to: { v: dial(1, 0, 2) } },
    ],
  },
  lift: {
    at: MOVE_AT,
    from: { v: dial(0, 0, 0.5) },
    transition: IN_OUT,
    steps: [
      { duration: 0.49, to: { v: dial(0.14, 0, 0.5) }, transition: OUT },
      { duration: 1.11, to: { v: dial(0, 0, 0.5) } },
    ],
  },
  spread: {
    at: LET_GO_AT,
    from: { v: scale(1) },
    transition: IN_OUT,
    steps: [
      { duration: 0.2, to: { v: scale(1.03) }, transition: OUT },
      { duration: 0.3, to: { v: scale(0.99) } },
      { duration: 0.35, to: { v: scale(1) } },
    ],
  },
  // Rocks about the screen's x axis: up out of the page, back, and still.
  pitch: {
    at: MOVE_AT,
    from: { v: degrees(0) },
    transition: IN_OUT,
    steps: [
      { duration: 0.24, to: { v: degrees(10) }, transition: OUT },
      { duration: 0.56, to: { v: degrees(-4.5) } },
      { duration: 0.53, to: { v: degrees(0.5) } },
      { duration: 0.27, to: { v: degrees(0) } },
    ],
  },
  yaw: {
    at: MOVE_AT,
    from: { v: degrees(0) },
    transition: IN_OUT,
    steps: [
      { duration: 0.4, to: { v: degrees(-7) } },
      { duration: 0.8, to: { v: degrees(1) } },
      { duration: 0.4, to: { v: degrees(0) } },
    ],
  },
  settle: {
    at: MOVE_AT,
    duration: 1.6,
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
  /** How far the drawing has turned into the phone, 0–1 (Nokia3310Sketch `wipe`). */
  wipe: number;
  /** The 3D phone (PhoneStage `pose`). */
  pose: FormPose;
}

/**
 * The phone's least depth: thin enough to line up with the drawing before it moves, thick enough
 * that its layers (keys, island, LCD) don't fight over the same depth.
 */
const WIPE_DEPTH = 0.06;

const RADIANS = Math.PI / 180;

const num = (values: Record<string, unknown>, fallback: number, key = "v"): number => {
  const value = values[key];
  return typeof value === "number" ? value : fallback;
};

/** The frame for one sample of REVEAL's clips (from the dock, or `revealAt`). */
export function revealFrame(sample: RevealSample): RevealFrame {
  const wipe = num(sample.wipe, 1);
  // 1 while the phone is hinged to the edge: moving towards the camera, spreading or turning any
  // other way would pull it off the line.
  const held = num(sample.hold, 0);
  const free = 1 - held;
  const line = wipeLine(wipe);
  const pose: FormPose = {
    depth: Math.max(WIPE_DEPTH, num(sample.depth, 1)),
    lift: num(sample.lift, 0) * free,
    spread: 1 + (num(sample.spread, 1) - 1) * free,
    tiltX: (num(sample.pitch, 0) + num(sample.peel, 0, "pitch")) * RADIANS,
    tiltY: num(sample.yaw, 0) * free * RADIANS,
    settled: num(sample.settle, 1),
    // Past the phone's bottom the edge can't hold it: it rocks on its bottom edge, and as it
    // lets go it turns about its centre again (where a host's own drift turns it at rest).
    pivot: Math.max(line, OUTLINE_BOTTOM) * held,
    pin: held,
  };
  if (wipe < 1) pose.cut = line;
  return { wipe, pose };
}

const timeline = computeStaticTimeline(parseTimelineConfig(REVEAL), {});
const end = (clip: { at: number; duration: number }) => clip.at + clip.duration;

const REVEAL_SECONDS = Math.max(timeline.duration, ...timeline.clips.map(end));

/** How long the whole reveal runs, until the phone has settled. */
export const REVEAL_MS = Math.round(1000 * REVEAL_SECONDS);

/** How long the drawing takes to turn into the phone, top to bottom. */
export const WIPE_MS = Math.round(1000 * end(timeline.clips.find((clip) => clip.key === "wipe")!));

/** REVEAL `ms` in. */
export function revealAt(ms: number): RevealFrame {
  const seconds = ms >= REVEAL_MS ? REVEAL_SECONDS : Math.max(0, ms) / 1000;
  const sample = Object.fromEntries(
    timeline.clips.map((clip) => [clip.key, computeClipState(clip, seconds).current]),
  ) as RevealSample;
  return revealFrame(sample);
}

/** The drawing, before anything moves (what the server renders). */
export const DRAWN = revealAt(0);

/** The phone at rest once revealed. */
export const REVEALED = revealAt(REVEAL_MS);
