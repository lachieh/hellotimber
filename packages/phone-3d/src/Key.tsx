import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { cellPlaneGeometry, keyGlowTexture, legendTexture } from "./atlas";
import { LEGEND_GLOW_COLOR, MATERIALS, PRINT_DARK, legendEmission } from "./materials";
import { DECAL_SPAN } from "./legend-paths";
import type { PrintedKey } from "./legends";
import type { MaterialSpec } from "./materials";
import type { Nokia3310Key } from "./types";

/** The atlas cell printed on each key (legends.ts): the GLB ships geometry only. The power key
 *  (on the top edge) has no front print, and the NaviKey's bar is a part of its own. */
function legendCellFor(key: Nokia3310Key): PrintedKey | null {
  return key === "power" || key === "navi" ? null : key;
}

/** A w × h bar with round ends, bent along a parabola so its ends sit `rise` above its middle:
 *  its outline is traced point by point (ShapeGeometry only triangulates the outline it gets). */
function naviBarGeometry(w: number, h: number, rise: number): THREE.BufferGeometry {
  const r = h / 2;
  const half = w / 2 - r;
  const spine = (x: number) => rise * (x / half) ** 2;
  const steps = 24;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = -half + (2 * half * i) / steps;
    points.push(new THREE.Vector2(x, spine(x) - r));
  }
  for (let i = 1; i < 12; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 12;
    points.push(new THREE.Vector2(half + r * Math.cos(a), spine(half) + r * Math.sin(a)));
  }
  for (let i = steps; i >= 0; i--) {
    const x = -half + (2 * half * i) / steps;
    points.push(new THREE.Vector2(x, spine(x) + r));
  }
  for (let i = 1; i < 12; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 12;
    points.push(new THREE.Vector2(-half + r * Math.cos(a), spine(-half) + r * Math.sin(a)));
  }
  const geometry = new THREE.ShapeGeometry(new THREE.Shape(points));
  geometry.translate(0, -rise / 2, 0);
  return geometry;
}

function specFor(key: Nokia3310Key): MaterialSpec {
  if (key === "navi") return MATERIALS.navi;
  if (key === "power") return MATERIALS.badge; // dark top-edge button
  return MATERIALS.key;
}

export interface KeyProps {
  id: Nokia3310Key;
  /** The adopted GLB node — geometry/position live in the mesh. */
  mesh: THREE.Mesh;
  /** The keypad LEDs: the legend (or NaviKey bar) glows while on. */
  lightOn: boolean;
  /** Externally-driven depress (keyboard input mirrored into the keypad). */
  pressed: boolean;
  /** Depress travel in model units (scale-relative, computed by the loader). */
  travel: number;
  onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
}

/**
 * Drives one adopted key mesh: dresses its material, lerps the depress along
 * the model's protrusion axis (+z), and floats a legend decal on the cap.
 * Pointer events are routed by the loader (one handler on the model root);
 * this component only animates. `pointerHeldRef` is flipped by that router.
 */
export default function Key({ id, mesh, lightOn, pressed, travel, onKey }: KeyProps) {
  void onKey; // events are routed centrally; prop kept for API symmetry
  const baseZ = useRef<number | null>(null);
  const pointerHeldRef = useRef(false);
  // The router finds this ref through mesh.userData (set once below).
  useMemo(() => {
    mesh.userData.keyId = id;
    mesh.userData.heldRef = pointerHeldRef;
  }, [mesh, id]);

  useMemo(() => {
    const spec = specFor(id);
    const m = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness,
    });
    mesh.material = m;
    return m;
  }, [mesh, id]);

  // Legend decal: child of the key mesh, so it inherits position AND depress.
  // Key rotations are baked into the vertices (separated from one object), so
  // local +z faces the viewer and the print stays upright automatically.
  const legend = useMemo(() => {
    const cell = legendCellFor(id);
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (bb === null) return null;
    const w = bb.max.x - bb.min.x;
    const h = bb.max.y - bb.min.y;
    const front = bb.max.z;
    if (id === "navi") {
      // The cyan bar is the NaviKey's only marking: a thin rounded stroke curving up to its ends
      // with the key's top edge.
      const bar = new THREE.Mesh(
        naviBarGeometry(w * 0.54, h * 0.1, h * 0.08),
        new THREE.MeshStandardMaterial({
          color: MATERIALS.naviBar.color,
          roughness: MATERIALS.naviBar.roughness,
          metalness: MATERIALS.naviBar.metalness,
          emissive: new THREE.Color(LEGEND_GLOW_COLOR),
          emissiveIntensity: 0,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        }),
      );
      bar.position.set((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, front + h * 0.02);
      return bar;
    }
    if (cell === null) return null;
    const decal = new THREE.Mesh(
      cellPlaneGeometry(w * DECAL_SPAN, h * DECAL_SPAN, cell),
      new THREE.MeshStandardMaterial({
        map: legendTexture(),
        transparent: true,
        color: PRINT_DARK,
        roughness: 0.55,
        metalness: 0,
        emissive: new THREE.Color(LEGEND_GLOW_COLOR),
        emissiveMap: keyGlowTexture(),
        emissiveIntensity: 0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    decal.position.set((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, front + h * 0.02);
    return decal;
  }, [mesh, id]);
  useMemo(() => {
    if (legend !== null && legend.parent !== mesh) mesh.add(legend);
  }, [mesh, legend]);

  useFrame((_, dt) => {
    if (baseZ.current === null) baseZ.current = mesh.position.z;
    const down = pointerHeldRef.current || pressed;
    const target = baseZ.current - (down ? travel : 0);
    const rate = Math.min(1, dt * 25);
    mesh.position.z += (target - mesh.position.z) * rate;
    const lm = legend?.material as THREE.MeshStandardMaterial | undefined;
    if (lm) {
      const glow = legendEmission(id === "navi" ? "naviBar" : "legend", lightOn);
      lm.emissive.set(glow.color);
      lm.emissiveIntensity = glow.intensity;
    }
  });

  return null;
}
