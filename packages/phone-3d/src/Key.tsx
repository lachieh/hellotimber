import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { cellPlaneGeometry, legendTexture } from "./atlas";
import { LEGEND_GLOW_COLOR, LEGEND_GLOW_INTENSITY, MATERIALS, PRINT_DARK } from "./materials";
import type { MaterialSpec } from "./materials";
import type { Nokia3310Key } from "./types";

/** Which atlas cell prints on each key. The sourced mesh ships geometry only
 *  (its legends lived in the stripped textures), so the plan-09 atlas decals
 *  carry the print. Power sits on the top edge — no front print. */
function legendCellFor(key: Nokia3310Key): string | null {
  if (key === "power") return null;
  if (key === "*") return "*";
  if (key === "#") return "#";
  return key; // digits, c, up, down — cell names match the key ids
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
  backlightOn: boolean;
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
export default function Key({ id, mesh, backlightOn, pressed, travel, onKey }: KeyProps) {
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
      // The cyan bar is the NaviKey's only marking.
      const bar = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.42, h * 0.22),
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
      cellPlaneGeometry(w * 0.86, h * 0.86, cell),
      new THREE.MeshStandardMaterial({
        map: legendTexture(),
        transparent: true,
        color: PRINT_DARK,
        roughness: 0.55,
        metalness: 0,
        emissive: new THREE.Color(LEGEND_GLOW_COLOR),
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
    if (lm) lm.emissiveIntensity = backlightOn ? LEGEND_GLOW_INTENSITY : 0;
  });

  return null;
}
