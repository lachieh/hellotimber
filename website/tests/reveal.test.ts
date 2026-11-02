import { describe, expect, it } from "vite-plus/test";
import { DRAWN, REVEALED, revealAt, WIPE_MS } from "../src/phone/reveal";

describe("the phone reveal", () => {
  it("starts as the drawing over a flat phone", () => {
    expect(DRAWN.wipe).toBe(0);
    expect(DRAWN.pose).toMatchObject({ lift: 0, settled: 0 });
    expect(DRAWN.pose.depth).toBeLessThan(0.1);
  });

  it("pops the phone out of the drawing while the edge sweeps down it", () => {
    const wipes = Array.from({ length: 21 }, (_, i) => revealAt((i / 20) * WIPE_MS));
    for (const [i, frame] of wipes.entries())
      if (i > 0) expect(frame.wipe).toBeGreaterThanOrEqual(wipes[i - 1]!.wipe);
    expect(wipes.at(-1)!.wipe).toBe(1);
    // Mid-wipe, the phone is already pitching up and rising.
    const half = wipes.find((frame) => frame.wipe >= 0.5)!;
    expect(half.pose.lift).toBeGreaterThan(0.05);
    expect(Math.max(...wipes.map((frame) => frame.pose.tiltX))).toBeGreaterThan(0.1);
  });

  it("ends with the phone at rest", () => {
    expect(REVEALED).toMatchObject({ wipe: 1, pose: { depth: 1, settled: 1 } });
    expect(REVEALED.pose.lift).toBeCloseTo(0);
  });
});
