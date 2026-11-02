import { describe, expect, it } from "vite-plus/test";
import { parseTimelineConfig } from "dialkit/timeline";
import { DRAWN, REVEAL, REVEAL_SECONDS, REVEALED, sampleReveal } from "../src/phone/reveal";

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

  it("starts as the still drawing over a flat phone", () => {
    expect(DRAWN).toMatchObject({ boil: 0, halftone: 1, ink: 1, burstOpacity: 0 });
    expect(DRAWN.pose).toMatchObject({ depth: 0, lift: 0, settled: 0 });
  });

  it("ends at the resting phone, the ink gone", () => {
    const end = sampleReveal(REVEAL_SECONDS);
    expect(end.ink).toBe(0);
    expect(end.boil).toBeCloseTo(0);
    expect(end.burstOpacity).toBeCloseTo(0);
    for (const [key, value] of Object.entries(REVEALED.pose))
      expect(end.pose[key as keyof typeof end.pose]).toBeCloseTo(value);
  });

  it("boils the ink before the phone leaps, then leaps out of it", () => {
    const frames = Array.from({ length: 100 }, (_, i) => sampleReveal((i / 99) * REVEAL_SECONDS));
    const firstBoil = frames.findIndex((f) => f.boil > 0.5);
    const firstDepth = frames.findIndex((f) => f.pose.depth > 0.05);
    expect(firstBoil).toBeGreaterThan(0);
    expect(firstBoil).toBeLessThan(firstDepth);
    expect(Math.max(...frames.map((f) => f.pose.lift))).toBeGreaterThan(0.1);
    expect(Math.max(...frames.map((f) => f.burstOpacity))).toBeGreaterThan(0.5);
    // The phone never sinks into the desk.
    expect(Math.min(...frames.map((f) => f.pose.lift))).toBeGreaterThanOrEqual(0);
  });
});
