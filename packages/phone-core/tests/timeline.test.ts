import { describe, expect, it } from "vite-plus/test";
import { MenuGraphic, Timeline } from "../src/index";

const steps = [
  { frame: 0, durationMs: 100 },
  { frame: 1, durationMs: 50 },
  { frame: 0, durationMs: 30 },
  { frame: 2, durationMs: 20 },
];

describe("Timeline", () => {
  it("rejects empty steps, bad frames, bad durations and an out-of-range loopFrom", () => {
    expect(() => new Timeline([])).toThrow(/at least one step/);
    expect(() => new Timeline([{ frame: -1, durationMs: 10 }])).toThrow(/frame/);
    expect(() => new Timeline([{ frame: 1.5, durationMs: 10 }])).toThrow(/frame/);
    expect(() => new Timeline([{ frame: 0, durationMs: 0 }])).toThrow(/durationMs/);
    expect(() => new Timeline([{ frame: 0, durationMs: 2.5 }])).toThrow(/durationMs/);
    expect(() => new Timeline([{ frame: 0, durationMs: Infinity }])).toThrow(/durationMs/);
    expect(() => new Timeline(steps, { loopFrom: 4 })).toThrow(/loopFrom/);
    expect(() => new Timeline(steps, { loopFrom: -1 })).toThrow(/loopFrom/);
    expect(() => new Timeline(steps, { loopFrom: 0.5 })).toThrow(/loopFrom/);
  });

  it("starts each step exactly at its cumulative start", () => {
    const timeline = new Timeline(steps);
    expect(timeline.frameAt(0)).toBe(0);
    expect(timeline.frameAt(99)).toBe(0);
    expect(timeline.frameAt(100)).toBe(1);
    expect(timeline.frameAt(149)).toBe(1);
    expect(timeline.frameAt(150)).toBe(0);
    expect(timeline.frameAt(179)).toBe(0);
    expect(timeline.frameAt(180)).toBe(2);
  });

  it("holds the last step after one pass, and the first step before the start", () => {
    const timeline = new Timeline(steps);
    expect(timeline.durationMs).toBe(200);
    expect(timeline.frameAt(200)).toBe(2);
    expect(timeline.frameAt(1_000_000)).toBe(2);
    expect(timeline.frameAt(-5)).toBe(0);
  });

  it("cycles from loopFrom after the first pass and reports an infinite duration", () => {
    const timeline = new Timeline(steps, { loopFrom: 1 });
    expect(timeline.durationMs).toBe(Infinity);
    // One pass is 200 ms; the loop (steps 1..3) is 100 ms long and starts at 100.
    expect(timeline.frameAt(200)).toBe(1);
    expect(timeline.frameAt(249)).toBe(1);
    expect(timeline.frameAt(250)).toBe(0);
    expect(timeline.frameAt(280)).toBe(2);
    expect(timeline.frameAt(300)).toBe(1);
    expect(timeline.frameAt(100 + 100 * 1000 + 55)).toBe(0);
  });

  it("copies and freezes its steps", () => {
    const input = steps.map((step) => ({ ...step }));
    const timeline = new Timeline(input);
    input[0]!.frame = 9;
    input.push({ frame: 7, durationMs: 1 });
    expect(timeline.steps).toEqual(steps);
    expect(Object.isFrozen(timeline)).toBe(true);
    expect(Object.isFrozen(timeline.steps)).toBe(true);
    expect(Object.isFrozen(timeline.steps[0])).toBe(true);
  });
});

describe("MenuGraphic timelines", () => {
  const timeline = new Timeline(steps);

  it("has no timeline by default and keeps the one it is given", () => {
    expect(new MenuGraphic("icon").timeline).toBeUndefined();
    expect(new MenuGraphic("icon", timeline).timeline).toBe(timeline);
  });

  it("plays the default timeline for every reveal unless one is overridden", () => {
    const previous = new Timeline([{ frame: 3, durationMs: 10 }]);
    const graphic = new MenuGraphic("icon", timeline, { reveals: { previous } });
    expect(graphic.timelineFor("enter")).toBe(timeline);
    expect(graphic.timelineFor("next")).toBe(timeline);
    expect(graphic.timelineFor("previous")).toBe(previous);
    expect(graphic.timelineFor("return")).toBe(timeline);
    expect(new MenuGraphic("still").timelineFor("next")).toBeUndefined();
  });

  it("rejects reveal timelines without a default, unknown reveals and non-timelines", () => {
    const other = new Timeline([{ frame: 0, durationMs: 1 }]);
    expect(() => new MenuGraphic("icon", undefined, { reveals: { next: other } })).toThrow(
      /default timeline/,
    );
    expect(
      () =>
        new MenuGraphic("icon", timeline, {
          reveals: { sideways: other } as never,
        }),
    ).toThrow(/sideways/);
    expect(
      () =>
        new MenuGraphic("icon", timeline, {
          reveals: { next: steps } as never,
        }),
    ).toThrow(/Timeline/);
    expect(() => new MenuGraphic("icon", steps as never)).toThrow(/Timeline/);
  });

  it("is immutable", () => {
    const graphic = new MenuGraphic("icon", timeline, { reveals: { return: timeline } });
    expect(Object.isFrozen(graphic)).toBe(true);
    expect(() => {
      (graphic as { id: string }).id = "other";
    }).toThrow();
  });
});
