// From the three-free entry: the homepage and the posts time the reveal before three.js loads.
import { wipeLine, type FormPose } from "@hellotimber/phone-3d/sketch";
import type { EasingConfig } from "dialkit/store";
import { computeClipState, computeStaticTimeline, parseTimelineConfig } from "dialkit/timeline";
import type { TimelineConfig } from "dialkit/timeline";

/** A cubic-bezier easing. Its duration is the clip's or step's. */
const easing = (ease: EasingConfig["ease"]): EasingConfig => ({
  type: "easing",
  duration: 1,
  ease,
});

/** Ease in and out, for the settling swings. */
const IN_OUT = easing([0.45, 0, 0.55, 1]);
const LINEAR = easing([0, 0, 1, 1]);

/**
 * A value with its DialKit slider: `[value, min, max, step]`, so the config can go back into
 * DialKit's timeline dock to be retuned without rounding.
 */
const dial = (value: number, min: number, max: number, step = 0.005) =>
  [value, min, max, step] as [number, number, number, number];
const unit = (value: number) => dial(value, 0, 1, 0.01);
const scale = (value: number) => dial(value, 0.8, 1.2);
/** World units on the page (the phone is 10 tall, centred on 0). */
const units = (value: number, reach: number) => dial(value, -reach, reach, 0.05);
/** Degrees of pitch (top edge towards you) or yaw (right edge away). */
const degrees = (value: number) => dial(value, -45, 45, 0.5);

/**
 * The reveal, in seconds from the moment the 3D model is ready under the drawing. A fine rule
 * sweeps down the drawing (`wipe`), turning it into the real phone, and nothing of the phone shows
 * below it; the wipe moves only that line. While the phone is pinned to the drawing (`hold`) its
 * front lies over it, and it peels up off the page (`peel`) about a line across it (`hinge`, its
 * height on the page). Pinned, it can't move towards the camera, spread or turn sideways, so
 * `lift`, `spread` and `yaw` only show as `hold` lets go; `position` moves it across and up the
 * page throughout. One clip per thing that moves, tuned in DialKit's timeline dock and played
 * here on a clock (`revealAt`).
 */
export const REVEAL = {
  wipe: {
    at: 0,
    duration: 1,
    from: { v: unit(0) },
    to: { v: unit(1) },
    transition: easing([0.57, 0, 1, 1.02]),
  },
  // Lets go all at once as the edge clears the phone.
  hold: {
    at: 0.96,
    duration: 0.25,
    from: { v: unit(1) },
    to: { v: unit(0) },
    transition: { type: "spring", bounce: 0, visualDuration: 0.05 },
  },
  // Sweeps down just behind the edge, so what's revealed peels up about it.
  hinge: {
    at: 0.09,
    duration: 0.87,
    from: { y: units(4.9, 6) },
    to: { y: units(-5.3, 6) },
    transition: easing([0.5, 0, 1, 1]),
  },
  position: {
    at: 0.1,
    from: { x: units(0, 3), y: units(0, 3) },
    transition: IN_OUT,
    steps: [
      { duration: 0.4, to: { x: units(0, 3), y: units(0, 3) } },
      { duration: 0.4, to: { x: units(0, 3), y: units(0, 3) } },
      { duration: 0.8, to: { x: units(0, 3), y: units(0, 3) } },
    ],
  },
  // Held up off the page while the edge sweeps, then laid down as the phone lets go.
  peel: {
    at: 0.1,
    from: { pitch: degrees(30) },
    transition: IN_OUT,
    steps: [
      { duration: 0.86, to: { pitch: degrees(30) }, transition: easing([0.28, 0, 0.08, 0.93]) },
      { duration: 0.24, to: { pitch: degrees(0) } },
    ],
  },
  depth: {
    at: 0.9,
    from: { v: dial(0, 0, 2) },
    transition: IN_OUT,
    steps: [
      { duration: 0.2, to: { v: dial(1.245, 0, 2) }, transition: easing([0.5, 0, 0.5, 1]) },
      { duration: 0.16, to: { v: dial(1, 0, 2) } },
    ],
  },
  lift: {
    at: 0.68,
    from: { v: dial(0, 0, 0.5) },
    transition: IN_OUT,
    steps: [
      {
        duration: 0.31,
        to: { v: dial(0.24, 0, 0.5) },
        transition: easing([0.43, 0.05, 0.34, 1.25]),
      },
      { duration: 0.42, to: { v: dial(0, 0, 0.5) }, transition: easing([0.49, 0, 0.55, 1]) },
    ],
  },
  spread: {
    at: 0.99,
    from: { v: scale(1) },
    transition: IN_OUT,
    steps: [
      { duration: 0.16, to: { v: scale(1.03) }, transition: easing([0.2, 0.7, 0.3, 1]) },
      { duration: 0.27, to: { v: scale(0.99) }, transition: easing([0.89, 0.97, 0.05, 1]) },
      { duration: 0.05, to: { v: scale(1) } },
    ],
  },
  // Rocks about the screen's x axis as it lands: up, back, and still.
  pitch: {
    at: 1.02,
    from: { v: degrees(0) },
    transition: IN_OUT,
    steps: [
      { duration: 0.16, to: { v: degrees(6) }, transition: easing([0.57, 0.09, 0.3, 1]) },
      { duration: 0.14, to: { v: degrees(-7) } },
      { duration: 0.14, to: { v: degrees(0) } },
      { duration: 0.12, to: { v: degrees(0) } },
    ],
  },
  yaw: {
    at: 1.02,
    from: { v: degrees(0) },
    transition: IN_OUT,
    steps: [
      { duration: 0.3, to: { v: degrees(15) }, transition: easing([0.28, 0.43, 0.5, 1]) },
      { duration: 0.14, to: { v: degrees(-6) }, transition: easing([0.24, 0, 0.71, 1.01]) },
      { duration: 0.05, to: { v: degrees(0) } },
    ],
  },
  settle: {
    at: 0.1,
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

/** The frame for one sample of REVEAL's clips (`revealAt`). */
export function revealFrame(sample: RevealSample): RevealFrame {
  const wipe = num(sample.wipe, 1);
  // 1 while the phone is hinged to the edge: moving towards the camera, spreading or turning any
  // other way would pull it off the drawing.
  const held = num(sample.hold, 0);
  const free = 1 - held;
  const pose: FormPose = {
    depth: Math.max(WIPE_DEPTH, num(sample.depth, 1)),
    lift: num(sample.lift, 0) * free,
    spread: 1 + (num(sample.spread, 1) - 1) * free,
    tiltX: (num(sample.pitch, 0) + num(sample.peel, 0, "pitch")) * RADIANS,
    tiltY: num(sample.yaw, 0) * free * RADIANS,
    settled: num(sample.settle, 1),
    // As it lets go it turns about its centre again (where a host's own drift turns it at rest).
    pivot: num(sample.hinge, 0, "y") * held,
    pin: held,
    x: num(sample.position, 0, "x"),
    y: num(sample.position, 0, "y"),
  };
  if (wipe < 1) pose.cut = wipeLine(wipe);
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
