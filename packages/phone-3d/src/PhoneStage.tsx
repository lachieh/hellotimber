import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import type { Group } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CAMERA_FOV, CAMERA_Z, FORM_MS, formDepth } from "./frame";
import { KEY_NODES } from "./layout";
import { settleRest, tiltRotation, watchTilt } from "./tilt";
import type { ScreenTilt } from "./tilt";
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

/** Gentle idle sway (sine) + device tilt (tilt.ts; none without a sensor), eased toward the target.
 *  Honors prefers-reduced-motion: the rig holds still for those users
 *  (plan 06 deviation 6 — the single sanctioned phone-3d edit). */
const prefersReducedMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
function fitCamera(
  silhouette: Silhouette,
  aspect: number,
  fit: number,
  depth: number,
): THREE.Vector3Tuple {
  const t = fit * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));
  // Squashing the phone's depth about z = 0 squashes its profiles' z the same way.
  const squash = (profile: Profile) => profile.map(([e, z]) => [e, z * depth] as const);
  const axes = [
    { profile: squash(silhouette.x), t: t * aspect },
    { profile: squash(silhouette.y), t },
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

/** Lowest depth scale while forming: a zero scale has no inverse for the normals. */
const FLAT = 0.002;

/** How long the keys trail the body, from the top key to the bottom one. */
const KEY_DELAY_MS = { first: 260, last: 520 } as const;

const KEY_NODE_NAMES = new Set<string>(Object.values(KEY_NODES));

/** The phone's key meshes and when each starts forming (a wave down the keypad). */
function keyWave(g: Group): { mesh: THREE.Mesh; delayMs: number }[] {
  const keys: { mesh: THREE.Mesh; y: number }[] = [];
  g.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !KEY_NODE_NAMES.has(object.name)) return;
    object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox;
    if (box !== null) keys.push({ mesh: object, y: (box.min.y + box.max.y) / 2 });
  });
  const top = Math.max(...keys.map((k) => k.y));
  const bottom = Math.min(...keys.map((k) => k.y));
  return keys.map(({ mesh, y }) => ({
    mesh,
    delayMs:
      KEY_DELAY_MS.first +
      ((top - y) / (top - bottom || 1)) * (KEY_DELAY_MS.last - KEY_DELAY_MS.first),
  }));
}

/** Where forming has got to, once the model is there. */
interface Forming {
  startedAt: number;
  keys: { mesh: THREE.Mesh; delayMs: number }[];
  done: boolean;
}

function SwayRig({
  children,
  fit,
  form,
  onFormStart,
}: {
  children: ReactNode;
  fit: number | undefined;
  form: boolean;
  onFormStart: (() => void) | undefined;
}) {
  const group = useRef<Group>(null);
  const silhouette = useRef<Silhouette>(undefined);
  const forming = useRef<Forming>(undefined);
  // The latest sensor reading and the rest pose it is measured from; unset without a sensor.
  const tilt = useRef<{ now: ScreenTilt; rest: ScreenTilt }>(undefined);
  useEffect(
    () =>
      watchTilt((now) => {
        tilt.current = { now, rest: tilt.current?.rest ?? now };
      }),
    [],
  );
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    // The model loads (suspends) after the rig mounts: measure once it is there.
    silhouette.current ??= restSilhouette(g);
    if (silhouette.current === undefined) return;

    // The first frame with the model: the phone starts flat, as its outline, and rises.
    if (forming.current === undefined) {
      forming.current = {
        startedAt: performance.now(),
        keys: form && !prefersReducedMotion ? keyWave(g) : [],
        done: !form || prefersReducedMotion,
      };
      onFormStart?.();
    }
    const f = forming.current;
    let depth = 1;
    if (!f.done) {
      const ms = performance.now() - f.startedAt;
      depth = Math.max(FLAT, formDepth(ms));
      for (const key of f.keys)
        key.mesh.scale.z =
          Math.max(FLAT, formDepth(ms - key.delayMs, FORM_MS - KEY_DELAY_MS.first)) / depth;
      if (ms >= FORM_MS + KEY_DELAY_MS.last) {
        f.done = true;
        for (const key of f.keys) key.mesh.scale.z = 1;
        depth = 1;
      }
    }
    g.scale.z = depth;

    const [x, y, z] =
      fit === undefined
        ? [0, 0, CAMERA_Z]
        : fitCamera(silhouette.current, state.size.width / state.size.height, fit, depth);
    state.camera.position.set(x, y, z);
    if (prefersReducedMotion) {
      g.rotation.y += (0 - g.rotation.y) * 0.1;
      g.rotation.x += (0 - g.rotation.x) * 0.1;
      return;
    }
    // Sway grows in with the depth: a flat phone lies still.
    const sway = Math.min(1, depth);
    const t = state.clock.elapsedTime;
    let turn = { x: 0, y: 0 };
    if (tilt.current !== undefined) {
      tilt.current.rest = settleRest(tilt.current.rest, tilt.current.now, dt);
      turn = tiltRotation(tilt.current.rest, tilt.current.now);
    }
    const targetY = (Math.sin(t * 0.5) * 0.06 + turn.y) * sway;
    const targetX = (Math.sin(t * 0.7) * 0.02 + turn.x) * sway;
    g.rotation.y += (targetY - g.rotation.y) * 0.05;
    g.rotation.x += (targetX - g.rotation.x) * 0.05;
  });
  return <group ref={group}>{children}</group>;
}

export interface PhoneStageProps extends Nokia3310Props {
  className?: string;
  /** Frame the phone at rest to this fraction of the canvas's limiting side. */
  fit?: number;
  /**
   * Form the phone out of its flat front outline once the model has loaded: it rises out of the
   * surface over FORM_MS, keys last. `<Nokia3310Sketch>` with the same `fit` draws that outline,
   * so a host can show the sketch until `onFormStart` and let the phone grow out of it.
   */
  form?: boolean;
  /** The first frame the model is drawn (flat, when forming). */
  onFormStart?: () => void;
}

/** Convenience scene: Canvas + lighting + resize + subtle idle motion (VISION contract).
 *  R3F's Canvas tracks its container size, so resize works out of the box. */
export function PhoneStage({
  className,
  fit,
  form = false,
  onFormStart,
  ...props
}: PhoneStageProps) {
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
      <SwayRig fit={fit} form={form} onFormStart={onFormStart}>
        <Nokia3310 {...props} />
      </SwayRig>
    </Canvas>
  );
}
