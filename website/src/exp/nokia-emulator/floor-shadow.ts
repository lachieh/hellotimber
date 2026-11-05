import * as THREE from "three";
import type { StageDrift } from "@hellotimber/phone-3d";

/** The phone's box in stage units: 10 tall (113 × 48 × 22 mm), centred. */
const PHONE = { width: 4.25, height: 10, depth: 1.95 } as const;
/** How far above its lowest point the phone still darkens the floor, roughly. */
const REACH = 1.5;

/** The contact shadow's place and shape on the floor, in the stage's x and z. */
export interface ShadowShape {
  x: number;
  z: number;
  /** Radians about the vertical, as the phone is turned. */
  angle: number;
  /** Its size across and front to back of the phone, times its size at rest. */
  across: number;
  along: number;
  /** The phone's lowest point, in its own (unfloated) frame: -height/2 at rest. */
  bottom: number;
}

/** Points over the phone's box: its four long edges, sampled down its height. */
const SAMPLES: THREE.Vector3[] = [];
for (let y = -PHONE.height / 2; y <= PHONE.height / 2 + 1e-9; y += 0.25)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      SAMPLES.push(new THREE.Vector3((sx * PHONE.width) / 2, y, (sz * PHONE.depth) / 2));

function moments(pose: Pick<StageDrift, "tiltX" | "tiltY">) {
  const turn = new THREE.Euler(pose.tiltX, pose.tiltY, 0);
  const points = SAMPLES.map((p) => p.clone().applyEuler(turn));
  const bottom = Math.min(...points.map((p) => p.y));
  // The parts of the phone nearest the floor shade it most.
  const weights = points.map((p) => Math.exp(-(p.y - bottom) / REACH));
  const total = weights.reduce((a, b) => a + b, 0);
  const mean = (f: (p: THREE.Vector3) => number) =>
    points.reduce((sum, p, i) => sum + f(p) * weights[i]!, 0) / total;
  const x = mean((p) => p.x);
  const z = mean((p) => p.z);
  // Spread along the phone's own across and front-to-back, as it is turned on the floor.
  const c = Math.cos(pose.tiltY);
  const s = Math.sin(pose.tiltY);
  const across = Math.sqrt(mean((p) => ((p.x - x) * c - (p.z - z) * s) ** 2));
  const along = Math.sqrt(mean((p) => ((p.x - x) * s + (p.z - z) * c) ** 2));
  return { x, z, across, along, bottom };
}

const REST = moments({ tiltX: 0, tiltY: 0 });

/** Where the phone, posed by `pose`, shades the floor under it. */
export function shadowUnder(pose: Pick<StageDrift, "tiltX" | "tiltY">): ShadowShape {
  const m = moments(pose);
  return {
    x: m.x,
    z: m.z,
    angle: pose.tiltY,
    across: m.across / REST.across,
    along: m.along / REST.along,
    bottom: m.bottom,
  };
}
