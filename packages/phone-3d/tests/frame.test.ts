import { describe, expect, it } from "vite-plus/test";
import { FORM_MS, formDepth } from "../src/frame";

describe("formDepth", () => {
  it("starts flat and ends at full depth", () => {
    expect(formDepth(-50)).toBe(0);
    expect(formDepth(0)).toBe(0);
    expect(formDepth(FORM_MS)).toBe(1);
    expect(formDepth(FORM_MS + 500)).toBe(1);
  });

  it("pops past full depth before settling, without dipping below flat", () => {
    const samples = Array.from({ length: 101 }, (_, i) => formDepth((i / 100) * FORM_MS));
    expect(Math.max(...samples)).toBeGreaterThan(1.05);
    expect(Math.max(...samples)).toBeLessThan(1.25);
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    // Rising through the first half: each sample deeper than the last.
    for (let i = 1; i <= 50; i++) expect(samples[i]).toBeGreaterThan(samples[i - 1]!);
  });

  it("stretches over a given duration", () => {
    expect(formDepth(500, 500)).toBe(1);
    expect(formDepth(250, 500)).toBeCloseTo(formDepth(FORM_MS / 2), 10);
  });
});
