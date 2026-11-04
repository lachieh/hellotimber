import { wipeLine } from "@hellotimber/phone-3d/sketch";
import { describe, expect, it } from "vite-plus/test";
import { parseTimelineConfig } from "dialkit/timeline";
import { DRAWN, REVEAL, REVEALED, revealAt, revealFrame, WIPE_MS } from "../src/phone/reveal";
import type { RevealSample } from "../src/phone/reveal";

/** Every slider in a DialKit config: `[path, [value, min, max, step]]`. */
function sliders(config: unknown, path = ""): [string, number[]][] {
  if (Array.isArray(config) && config.length === 4 && config.every((v) => typeof v === "number"))
    return [[path, config as number[]]];
  if (typeof config !== "object" || config === null || Array.isArray(config)) return [];
  return Object.entries(config).flatMap(([key, value]) => sliders(value, `${path}.${key}`));
}

describe("the phone reveal", () => {
  it("has every value on its slider in the dock, so tuning never rounds it away", () => {
    const all = sliders(parseTimelineConfig(REVEAL).dialConfig).filter(
      ([path]) => !/\.(at|duration|ease)$/.test(path),
    );
    expect(all.length).toBeGreaterThan(20);
    for (const [path, [value, min, max, step]] of all) {
      expect(value, path).toBeGreaterThanOrEqual(min!);
      expect(value, path).toBeLessThanOrEqual(max!);
      expect(Math.abs(value! / step! - Math.round(value! / step!)), path).toBeLessThan(1e-6);
    }
  });

  it("starts as the drawing over a flat phone", () => {
    expect(DRAWN.wipe).toBe(0);
    expect(DRAWN.pose).toMatchObject({ lift: 0, settled: 0 });
    expect(DRAWN.pose.depth).toBeLessThan(0.1);
  });

  it("peels the phone up about the edge while it sweeps down the drawing", () => {
    const wipes = Array.from({ length: 21 }, (_, i) => revealAt((i / 20) * WIPE_MS));
    for (const [i, frame] of wipes.entries())
      if (i > 0) expect(frame.wipe).toBeGreaterThanOrEqual(wipes[i - 1]!.wipe);
    expect(wipes.at(-1)!.wipe).toBe(1);
    for (const { wipe, pose } of wipes.slice(0, -1)) {
      const line = wipeLine(wipe);
      // Hidden below the edge, and turning about it while it's on the phone: pinned to the page
      // there, so it never shows past the drawing still covering it.
      expect(pose.cut).toBe(line);
      expect(pose.pin).toBe(1);
      expect([pose.lift, pose.spread, pose.tiltY]).toEqual([0, 1, 0].map((v) => expect.closeTo(v)));
    }
    // Mid-wipe, what's revealed is already pitching up off the page.
    expect(Math.max(...wipes.map((frame) => frame.pose.tiltX))).toBeGreaterThan(0.1);
  });

  it("moves only the line with the wipe, never the phone", () => {
    const sample = (wipe: number): RevealSample => ({
      wipe: { v: wipe },
      hold: { v: 1 },
      hinge: { y: 1.5 },
      position: { x: 0.2, y: -0.4 },
      peel: { pitch: 12 },
      depth: { v: 1.1 },
      lift: { v: 0.1 },
      spread: { v: 1.02 },
      pitch: { v: 4 },
      yaw: { v: -3 },
      settle: { v: 0.3 },
    });
    const { cut: cutA, ...phoneA } = revealFrame(sample(0.2)).pose;
    const { cut: cutB, ...phoneB } = revealFrame(sample(0.7)).pose;
    expect(phoneB).toEqual(phoneA);
    expect(cutA).toBe(wipeLine(0.2));
    expect(cutB).toBe(wipeLine(0.7));
  });

  it("lets the phone go to leap free once the drawing has gone", () => {
    const after = Array.from({ length: 21 }, (_, i) => revealAt(WIPE_MS + i * 50));
    for (const frame of after) expect(frame.pose.cut).toBeUndefined();
    expect(Math.max(...after.map((frame) => frame.pose.lift))).toBeGreaterThan(0.05);
  });

  it("ends with the phone at rest", () => {
    expect(REVEALED).toMatchObject({ wipe: 1, pose: { depth: 1, settled: 1 } });
    expect(REVEALED.pose.lift).toBeCloseTo(0);
    expect(REVEALED.pose.pivot).toBeCloseTo(0);
    expect(REVEALED.pose.pin).toBeCloseTo(0);
  });
});
