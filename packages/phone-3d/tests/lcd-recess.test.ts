import * as THREE from "three";
import { describe, expect, it } from "vite-plus/test";
import { recessShadow, towardLightIn } from "../src/lcd-recess";

/** The stage's default key light: up, right and in front of the phone. */
const KEY = new THREE.Vector3(4, 6, 8).normalize();
const RECESS = 0.1;

/** The LCD's shadow with the phone at `depth` (its z scale) and turned by `tilt`. */
function shadow(depth: number, tilt = new THREE.Euler(), light = KEY) {
  const phone = new THREE.Object3D();
  phone.scale.set(1, 1, depth);
  phone.rotation.copy(tilt);
  phone.updateMatrixWorld();
  return recessShadow(towardLightIn(phone, light), RECESS);
}
const offset = (...args: Parameters<typeof shadow>) => shadow(...args).offset;

describe("the bezel's shadow on the LCD", () => {
  it("falls from the edges facing the light, as far as the lip's height reaches along it", () => {
    const [x, y] = offset(1);
    // Up and right, towards the light: the top and right edges of the LCD are shaded.
    expect(x).toBeCloseTo((RECESS * 4) / 8);
    expect(y).toBeCloseTo((RECESS * 6) / 8);
  });

  it("shrinks with the phone's depth and is gone when it's flat", () => {
    const full = Math.hypot(...offset(1));
    expect(Math.hypot(...offset(0.5))).toBeCloseTo(full * 0.5);
    expect(Math.hypot(...offset(0.01))).toBeCloseTo(full * 0.01);
    // Popping out past its rest depth, the lip stands taller and the shadow grows.
    expect(Math.hypot(...offset(1.25))).toBeCloseTo(full * 1.25);
  });

  it("moves with the light as the device's tilt turns it", () => {
    const turned = KEY.clone().applyEuler(new THREE.Euler(0.3, -0.3, 0));
    const [x, y] = offset(1, undefined, turned);
    const [restX, restY] = offset(1);
    expect(x).not.toBeCloseTo(restX);
    expect(y).not.toBeCloseTo(restY);
  });

  it("follows the phone as it turns, against the light", () => {
    // Pitched top-towards-the-light, the light is more nearly overhead and the shadow at the
    // top shortens.
    const [, pitched] = offset(1, new THREE.Euler(-0.4, 0, 0));
    expect(pitched).toBeLessThan(offset(1)[1]);
  });

  it("casts nothing with the light straight on, at full strength", () => {
    expect(shadow(1, undefined, new THREE.Vector3(0, 0, 1))).toEqual({
      offset: [0, 0],
      strength: 1,
    });
  });

  it("fades as the light grazes the LCD, so a long shadow is a faint one", () => {
    const grazing = shadow(1, undefined, new THREE.Vector3(0, 1, 0.15).normalize());
    expect(Math.hypot(...grazing.offset)).toBeGreaterThan(Math.hypot(...offset(1)));
    expect(grazing.strength).toBeLessThan(shadow(1).strength / 4);
  });

  it("casts nothing with the light behind the LCD, which it doesn't light at all", () => {
    expect(shadow(1, undefined, new THREE.Vector3(0, 1, -0.2)).strength).toBe(0);
  });
});
