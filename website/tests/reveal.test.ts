import { describe, expect, it } from "vite-plus/test";
import { DRAWN, REVEAL_SECONDS, REVEALED, sampleReveal } from "../src/phone/reveal";

describe("the phone reveal", () => {
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
