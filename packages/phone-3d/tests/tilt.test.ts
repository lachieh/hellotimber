import { describe, expect, it } from "vite-plus/test";
import { REST_SECONDS, screenTilt, settleRest, tiltRotation } from "../src/tilt";

describe("screenTilt", () => {
  const reading = { beta: 40, gamma: 10 };
  it("reads gamma across and beta up the screen in portrait", () => {
    expect(screenTilt(reading, 0)).toEqual({ x: 10, y: 40 });
  });
  it("swaps the axes in landscape, either way round", () => {
    expect(screenTilt(reading, 90)).toEqual({ x: 40, y: -10 });
    expect(screenTilt(reading, 270)).toEqual({ x: -40, y: 10 });
    expect(screenTilt(reading, -90)).toEqual({ x: -40, y: 10 });
  });
});

describe("tiltRotation", () => {
  it("holds still at rest", () => {
    const rest = { x: 5, y: 45 };
    const turn = tiltRotation(rest, rest);
    expect(Math.abs(turn.x) + Math.abs(turn.y)).toBe(0);
  });
  it("turns the phone against the device, saturating", () => {
    const rest = { x: 0, y: 45 };
    const right = tiltRotation(rest, { x: 10, y: 45 });
    expect(right.y).toBeLessThan(0);
    expect(right.x).toBeCloseTo(0);
    const far = tiltRotation(rest, { x: 80, y: 45 });
    expect(far.y).toBe(tiltRotation(rest, { x: 25, y: 45 }).y);
  });
  it("measures across the ±180° wrap", () => {
    expect(tiltRotation({ x: 0, y: 175 }, { x: 0, y: -175 }).x).toBeCloseTo(
      tiltRotation({ x: 0, y: 0 }, { x: 0, y: 10 }).x,
    );
  });
});

describe("settleRest", () => {
  it("re-centres on a new grip over a few seconds", () => {
    let rest = { x: 0, y: 0 };
    const now = { x: 0, y: 30 };
    rest = settleRest(rest, now, REST_SECONDS);
    expect(rest.y).toBeCloseTo(30 * (1 - Math.exp(-1)));
    for (let i = 0; i < 600; i++) rest = settleRest(rest, now, 1 / 60);
    expect(rest.y).toBeCloseTo(30, 0);
  });
});
