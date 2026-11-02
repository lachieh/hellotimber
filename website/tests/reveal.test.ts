import { describe, expect, it } from "vite-plus/test";
import { DRAWN, REVEAL_MS, REVEALED, revealAt, WIPE_MS } from "../src/phone/reveal";

describe("the phone reveal", () => {
  it("starts as the drawing over a flat phone", () => {
    expect(DRAWN.wipe).toBe(0);
    expect(DRAWN.pose).toMatchObject({ lift: 0, settled: 0 });
    expect(DRAWN.pose.depth).toBeLessThan(0.1);
  });

  it("turns the drawing into the flat phone, top to bottom, before the phone moves", () => {
    const wipes = Array.from({ length: 21 }, (_, i) => revealAt((i / 20) * WIPE_MS));
    for (const [i, frame] of wipes.entries()) {
      expect(frame.pose.depth).toBe(DRAWN.pose.depth);
      if (i > 0) expect(frame.wipe).toBeGreaterThanOrEqual(wipes[i - 1]!.wipe);
    }
    expect(wipes.at(-1)!.wipe).toBe(1);
  });

  it("then leaps the phone out of the desk, pitching up, and ends at rest", () => {
    const leap = Array.from({ length: 50 }, (_, i) =>
      revealAt(WIPE_MS + (i / 49) * (REVEAL_MS - WIPE_MS)),
    );
    expect(Math.max(...leap.map((f) => f.pose.tiltX))).toBeGreaterThan(0.1);
    expect(Math.max(...leap.map((f) => f.pose.lift))).toBeGreaterThan(0.1);
    expect(REVEALED).toMatchObject({ wipe: 1, pose: { depth: 1, settled: 1 } });
    expect(REVEALED.pose.lift).toBeCloseTo(0);
  });
});
