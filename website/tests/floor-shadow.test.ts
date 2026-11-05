import { describe, expect, it } from "vite-plus/test";
import { shadowUnder } from "../src/exp/nokia-emulator/floor-shadow";

const RAD = Math.PI / 180;

describe("shadowUnder", () => {
  it("sits square under the phone at rest", () => {
    const shape = shadowUnder({ tiltX: 0, tiltY: 0 });
    expect(shape.x).toBeCloseTo(0);
    expect(shape.z).toBeCloseTo(0);
    expect(shape.angle).toBe(0);
    expect(shape.across).toBeCloseTo(1);
    expect(shape.along).toBeCloseTo(1);
    expect(shape.bottom).toBeCloseTo(-5);
  });

  it("turns with the phone, keeping its size", () => {
    const shape = shadowUnder({ tiltX: 0, tiltY: 40 * RAD });
    expect(shape.angle).toBeCloseTo(40 * RAD);
    expect(shape.across).toBeCloseTo(1);
    expect(shape.along).toBeCloseTo(1);
    expect(Math.hypot(shape.x, shape.z)).toBeCloseTo(0);
  });

  it("stretches front to back and follows the foot as the phone tips", () => {
    // Top towards the camera: the foot swings back, and the shadow under it.
    const forward = shadowUnder({ tiltX: 20 * RAD, tiltY: 0 });
    expect(forward.along).toBeGreaterThan(1.05);
    expect(forward.across).toBeCloseTo(1, 1);
    expect(forward.z).toBeLessThan(-1);
    expect(shadowUnder({ tiltX: -20 * RAD, tiltY: 0 }).z).toBeGreaterThan(1);
  });

  it("spreads more the further it tips", () => {
    expect(shadowUnder({ tiltX: 30 * RAD, tiltY: 0 }).along).toBeGreaterThan(
      shadowUnder({ tiltX: 10 * RAD, tiltY: 0 }).along,
    );
  });
});
