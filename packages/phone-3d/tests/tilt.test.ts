import { describe, expect, it } from "vite-plus/test";
import { REST_SECONDS, screenQuaternion, settleRest, tiltBetween, tiltRotation } from "../src/tilt";

const at = (alpha: number, beta: number, gamma: number, screen = 0) =>
  screenQuaternion({ alpha, beta, gamma }, screen);

describe("tiltBetween", () => {
  it("reads gamma across and beta up the screen in portrait", () => {
    const tilt = tiltBetween(at(0, 30, 0), at(0, 30, 10));
    expect(tilt.x).toBeCloseTo(10);
    expect(tilt.y).toBeCloseTo(0);
    const up = tiltBetween(at(0, 0, 0), at(0, 10, 0));
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(10);
  });

  it("swaps the axes in landscape, either way round", () => {
    const right = tiltBetween(at(0, 0, 0, 90), at(0, 10, 0, 90));
    expect(right.x).toBeCloseTo(10);
    expect(right.y).toBeCloseTo(0);
    expect(tiltBetween(at(0, 0, 0, 270), at(0, 10, 0, 270)).x).toBeCloseTo(-10);
    expect(tiltBetween(at(0, 0, 0, -90), at(0, 10, 0, -90)).x).toBeCloseTo(-10);
  });

  it("stays steady held upright, where the sensor's angles swing", () => {
    // Twisting an upright phone half a degree reads as gamma -79° and alpha 79°.
    const tilt = tiltBetween(at(0, 89.9, 0), at(78.69, 89.49, -78.69));
    expect(Math.hypot(tilt.x, tilt.y)).toBeLessThan(1);
  });

  it("reads one pose the same whichever angles the sensor names it by", () => {
    const tilt = tiltBetween(at(10, 89, 3), at(190, 91, -177));
    expect(Math.hypot(tilt.x, tilt.y)).toBeCloseTo(0);
  });
});

describe("tiltRotation", () => {
  it("holds still at rest", () => {
    const turn = tiltRotation({ x: 0, y: 0 });
    expect(Math.abs(turn.x) + Math.abs(turn.y)).toBe(0);
  });

  it("turns the phone against the device, saturating", () => {
    const right = tiltRotation({ x: 10, y: 0 });
    expect(right.y).toBeLessThan(0);
    expect(right.x).toBeCloseTo(0);
    expect(tiltRotation({ x: 80, y: 0 }).y).toBe(tiltRotation({ x: 25, y: 0 }).y);
  });
});

describe("settleRest", () => {
  it("re-centres on a new grip over a few seconds", () => {
    let rest = at(0, 0, 0);
    const now = at(0, 30, 0);
    rest = settleRest(rest, now, REST_SECONDS);
    expect(tiltBetween(at(0, 0, 0), rest).y).toBeCloseTo(30 * (1 - Math.exp(-1)), 1);
    for (let i = 0; i < 600; i++) rest = settleRest(rest, now, 1 / 60);
    expect(tiltBetween(rest, now).y).toBeCloseTo(0, 0);
  });
});
