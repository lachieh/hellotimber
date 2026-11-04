import { OUTLINE_BOTTOM, wipeLine } from "@hellotimber/phone-3d/sketch";
import { describe, expect, it } from "vite-plus/test";
import { DRAWN, REVEALED, revealAt, WIPE_MS } from "../src/phone/reveal";

describe("the phone reveal", () => {
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
      expect(pose.pivot).toBe(Math.max(line, OUTLINE_BOTTOM));
      expect([pose.lift, pose.spread, pose.tiltY]).toEqual([0, 1, 0].map((v) => expect.closeTo(v)));
    }
    // Mid-wipe, what's revealed is already pitching up off the page.
    expect(Math.max(...wipes.map((frame) => frame.pose.tiltX))).toBeGreaterThan(0.1);
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
  });
});
