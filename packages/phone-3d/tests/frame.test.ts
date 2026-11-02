import { describe, expect, it } from "vite-plus/test";
import { DEPTH_MS, FORM_MS, formDepth, formPose } from "../src/frame";

describe("formDepth", () => {
  it("starts flat and ends at full depth", () => {
    expect(formDepth(-50)).toBe(0);
    expect(formDepth(0)).toBe(0);
    expect(formDepth(DEPTH_MS)).toBe(1);
    expect(formDepth(DEPTH_MS + 500)).toBe(1);
  });

  it("pops past full depth before settling, without dipping below flat", () => {
    const samples = Array.from({ length: 101 }, (_, i) => formDepth((i / 100) * DEPTH_MS));
    expect(Math.max(...samples)).toBeGreaterThan(1.05);
    expect(Math.max(...samples)).toBeLessThan(1.3);
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    // Rising through the first half: each sample deeper than the last.
    for (let i = 1; i <= 50; i++) expect(samples[i]).toBeGreaterThan(samples[i - 1]!);
  });

  it("stretches over a given duration", () => {
    expect(formDepth(500, 500)).toBe(1);
    expect(formDepth(250, 500)).toBeCloseTo(formDepth(DEPTH_MS / 2), 10);
  });
});

describe("formPose", () => {
  it("starts exactly flat on the outline and ends at rest", () => {
    const start = formPose(0);
    expect(start).toMatchObject({ depth: 0, lift: 0, spread: 1, settled: 0 });
    expect(Math.abs(start.tiltX) + Math.abs(start.tiltY)).toBe(0);
    const end = formPose(FORM_MS);
    expect(end.depth).toBe(1);
    expect(end.settled).toBe(1);
    expect(
      Math.abs(end.lift) + Math.abs(end.spread - 1) + Math.abs(end.tiltX) + Math.abs(end.tiltY),
    ).toBeLessThan(1e-9);
  });

  it("leaps well off the surface, then comes back down", () => {
    const lifts = Array.from({ length: 33 }, (_, i) => formPose((i / 32) * FORM_MS).lift);
    const peak = Math.max(...lifts);
    expect(1 / (1 - peak)).toBeGreaterThan(1.12); // looks over 12 % bigger at the top
    expect(Math.min(...lifts)).toBeGreaterThanOrEqual(0); // never sinks into the desk
    expect(lifts.indexOf(peak)).toBeLessThan(16); // up faster than down
  });

  it("squashes before it bulges", () => {
    expect(formPose(FORM_MS / 12).spread).toBeLessThan(0.95);
    const later = Array.from({ length: 20 }, (_, i) => formPose(FORM_MS * (0.2 + i / 40)).spread);
    expect(Math.max(...later)).toBeGreaterThan(1.02);
  });
});
