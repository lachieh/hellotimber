import { describe, expect, it } from "vite-plus/test";
import { pinRig } from "../src/pin";

type Vec3 = readonly [number, number, number];

/** A point of the phone (its own coordinates) on screen: where the stage draws it, untilted. */
function onScreen(camera: Vec3, rig: ReturnType<typeof pinRig>, point: Vec3): [number, number] {
  const world = point.map((v, i) => rig.position[i]! + rig.scale[i]! * (v + rig.hang[i]!));
  const away = camera[2] - world[2]!;
  return [(world[0]! - camera[0]) / away, (world[1]! - camera[1]) / away];
}

/** The same point in the drawing: the phone flat, from the paper camera. */
const inDrawing = (paper: Vec3, [x, y]: Vec3): [number, number] => [
  (x - paper[0]) / paper[2],
  (y - paper[1]) / paper[2],
];

describe("pinRig", () => {
  const paper: Vec3 = [-0.01, 0.02, 27.6];
  // Pulled back for the phone's depth, as fitCamera does.
  const camera: Vec3 = [-0.01, 0.05, 29.3];
  const front = 1.1;
  const base = { camera, paper, front, depth: 1.15, spread: 1, lift: 0 };
  const points: Vec3[] = [
    [0, 4.2, front],
    [1.8, 0, front],
    [-1.5, -3.6, front],
  ];

  it("lays the pinned phone's front over the drawing, wherever the pivot is", () => {
    for (const pivot of [4.5, 0.3, -2.8, -5]) {
      const rig = pinRig({ ...base, pivot, pin: 1 });
      for (const point of points) {
        const [sx, sy] = onScreen(camera, rig, point);
        const [dx, dy] = inDrawing(paper, point);
        expect(sx).toBeCloseTo(dx, 10);
        expect(sy).toBeCloseTo(dy, 10);
      }
    }
  });

  it("leaves an unpinned phone where it would be anyway", () => {
    const rig = pinRig({ ...base, pivot: -2, pin: 0 });
    expect(rig.scale).toEqual([1, 1, 1.15]);
    for (const point of points) {
      const world = point.map((v, i) => rig.position[i]! + rig.scale[i]! * (v + rig.hang[i]!));
      expect(world[0]).toBeCloseTo(point[0]);
      expect(world[1]).toBeCloseTo(point[1]);
      expect(world[2]).toBeCloseTo(point[2] * 1.15);
    }
  });
});
