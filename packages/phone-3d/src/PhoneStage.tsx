import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import type { Group } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Nokia3310 } from "./Nokia3310";
import type { Nokia3310Props } from "./types";

/** Procedural studio environment (no fetched assets) — required for the
 *  chrome island/keys to pick up reflections; without an env map, metallic
 *  materials render near-black. */
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.4; // reflections only — lights carry the scene
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Gentle idle sway (sine) + pointer-follow tilt, eased toward the target.
 *  Honors prefers-reduced-motion: the rig holds still for those users
 *  (plan 06 deviation 6 — the single sanctioned phone-3d edit). */
const prefersReducedMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const CAMERA_Z = 15;
const CAMERA_FOV = 42;

/** Points `(offset along an axis, z)` of the phone at rest: the convex hull of its vertices'. */
type Profile = readonly (readonly [number, number])[];

/** The phone's profiles at rest (no sway) along the camera's x and y axes, in world units. */
interface Silhouette {
  readonly x: Profile;
  readonly y: Profile;
}

function restSilhouette(g: Group): Silhouette | undefined {
  const { x, y } = g.rotation;
  g.rotation.set(0, 0, 0);
  g.updateMatrixWorld(true);
  const across: [number, number][] = [];
  const up: [number, number][] = [];
  const v = new THREE.Vector3();
  g.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = (object.geometry as THREE.BufferGeometry).getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      across.push([v.x, v.z]);
      up.push([v.y, v.z]);
    }
  });
  g.rotation.set(x, y, 0);
  g.updateMatrixWorld(true);
  if (across.length === 0) return undefined;
  return { x: convexHull(across), y: convexHull(up) };
}

/** Andrew's monotone chain: the hull's corners (a linear maximum over the points is at one). */
function convexHull(points: [number, number][]): Profile {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: readonly number[], a: readonly number[], b: readonly number[]) =>
    (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const chain = (ordered: [number, number][]) => {
    const out: [number, number][] = [];
    for (const p of ordered) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0)
        out.pop();
      out.push(p);
    }
    return out;
  };
  return [...chain(points), ...chain([...points].reverse())];
}

/**
 * The camera at which the phone at rest spans `fit` of the view's limiting side, centred: a camera
 * at `(c, d)` along an axis sees each point `(e, z)` inside `fit` of its half view `t` when
 * `|e - c| <= t (d - z)`. Some `c` satisfies every point when `d` is at least
 * `max(z / 2 + e / 2t) + max(z / 2 - e / 2t)`; `c` is then the middle of the range left.
 */
function fitCamera(silhouette: Silhouette, aspect: number, fit: number): THREE.Vector3Tuple {
  const t = fit * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));
  const axes = [
    { profile: silhouette.x, t: t * aspect },
    { profile: silhouette.y, t },
  ];
  let d = 0;
  for (const { profile, t } of axes) {
    let high = -Infinity;
    let low = -Infinity;
    for (const [e, z] of profile) {
      high = Math.max(high, z / 2 + e / (2 * t));
      low = Math.max(low, z / 2 - e / (2 * t));
    }
    d = Math.max(d, high + low);
  }
  const [x, y] = axes.map(({ profile, t }) => {
    let from = -Infinity;
    let to = Infinity;
    for (const [e, z] of profile) {
      from = Math.max(from, e - t * (d - z));
      to = Math.min(to, e + t * (d - z));
    }
    return (from + to) / 2;
  });
  return [x!, y!, d];
}

function SwayRig({ children, fit }: { children: ReactNode; fit: number | undefined }) {
  const group = useRef<Group>(null);
  const silhouette = useRef<Silhouette>(undefined);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    // The model loads (suspends) after the rig mounts: measure once it is there.
    if (fit !== undefined) silhouette.current ??= restSilhouette(g);
    const [x, y, z] =
      fit === undefined || silhouette.current === undefined
        ? [0, 0, CAMERA_Z]
        : fitCamera(silhouette.current, state.size.width / state.size.height, fit);
    state.camera.position.set(x, y, z);
    if (prefersReducedMotion) {
      g.rotation.y += (0 - g.rotation.y) * 0.1;
      g.rotation.x += (0 - g.rotation.x) * 0.1;
      return;
    }
    const t = state.clock.elapsedTime;
    const targetY = Math.sin(t * 0.5) * 0.06 + state.pointer.x * 0.18;
    const targetX = Math.sin(t * 0.7) * 0.02 - state.pointer.y * 0.12;
    g.rotation.y += (targetY - g.rotation.y) * 0.05;
    g.rotation.x += (targetX - g.rotation.x) * 0.05;
  });
  return <group ref={group}>{children}</group>;
}

/** Convenience scene: Canvas + lighting + resize + subtle idle motion (VISION contract).
 *  R3F's Canvas tracks its container size, so resize works out of the box. With `fit`, the
 *  camera frames the phone at rest to that fraction of the canvas's limiting side. */
export function PhoneStage({
  className,
  fit,
  ...props
}: Nokia3310Props & { className?: string; fit?: number }) {
  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
    >
      <StudioEnvironment />
      <ambientLight intensity={0.3} />
      <directionalLight position={[4, 6, 8]} intensity={1.0} />
      <directionalLight position={[-5, -2, 4]} intensity={0.3} />
      <SwayRig fit={fit}>
        <Nokia3310 {...props} />
      </SwayRig>
    </Canvas>
  );
}
