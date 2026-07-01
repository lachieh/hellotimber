import { useMemo } from "react";
import * as THREE from "three";
import { cellPlaneGeometry, legendTexture } from "./atlas";
import { BADGE, BEZEL, BODY, BODY_PROFILE, FACE_Z, ISLAND, ISLAND_LIFT } from "./layout";
import { MATERIALS } from "./materials";
import type { MaterialSpec } from "./materials";

/** Side-wall curvature of the shell. The extruded cross-section grows by
 *  BEVEL_SIZE beyond the front-face outline, so the front-face silhouette is
 *  BODY_PROFILE inset by BEVEL_SIZE and the mid-body silhouette is the full
 *  profile — total width stays BODY.w. */
const BEVEL_SIZE = 0.35;
const BEVEL_THICKNESS = 0.55;

export function materialParams(spec: MaterialSpec): {
  color: string;
  roughness: number;
  metalness: number;
} {
  return { color: spec.color, roughness: spec.roughness, metalness: spec.metalness };
}

/** The waisted 3310 silhouette: spline through the mirrored width profile. */
function silhouetteShape(inset: number): THREE.Shape {
  const right = BODY_PROFILE.map(({ y, hw }) => new THREE.Vector2(Math.max(hw - inset, 0.2), y));
  const left = [...right].reverse().map((p) => new THREE.Vector2(-p.x, p.y));
  const shape = new THREE.Shape();
  const first = right[0]!;
  shape.moveTo(first.x, first.y);
  shape.splineThru([...right.slice(1), ...left]);
  shape.closePath(); // straight run across the top dome between the ±apex points
  return shape;
}

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(hw, hh - r);
  shape.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-hw + r, hh);
  shape.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw, -hh + r);
  shape.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/** Center an extrusion on z so its front face lands exactly at +total/2. */
function centerDepth(geometry: THREE.ExtrudeGeometry): THREE.ExtrudeGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box !== null) geometry.translate(0, 0, -(box.min.z + box.max.z) / 2);
  return geometry;
}

/**
 * The shell, the chrome island (the 3310's single silver plate carrying
 * screen surround + navi cluster), the dark screen surround, the NOKIA badge,
 * and the LCD well. All beveled extrusions from 2D outlines traced against
 * the reference renders in `nokia-3310/` — smooth normals by construction.
 */
export default function PhoneBody() {
  const shell = useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(silhouetteShape(BEVEL_SIZE), {
      depth: BODY.d - 2 * BEVEL_THICKNESS,
      bevelEnabled: true,
      bevelThickness: BEVEL_THICKNESS,
      bevelSize: BEVEL_SIZE,
      bevelSegments: 6,
      curveSegments: 48,
    });
    return centerDepth(geometry);
  }, []);

  const shellMaterials = useMemo(
    () => [
      // material 0: front/back caps — the face; material 1: beveled side walls.
      new THREE.MeshStandardMaterial(materialParams(MATERIALS.face)),
      new THREE.MeshStandardMaterial(materialParams(MATERIALS.body)),
    ],
    [],
  );

  // The chrome island: SOLID silver rounded plate. (Punching the screen
  // window through the extrude triangulated badly and z-fought the LCD — the
  // dark surround is instead layered on top of the plate.)
  const island = useMemo(() => {
    // depth + 2×bevelThickness = ISLAND_LIFT exactly, so the front face sits
    // 0.01 below FACE_Z + ISLAND_LIFT (the mesh is sunk 0.01 into the shell)
    // and everything layered on the island clears it.
    const geometry = new THREE.ExtrudeGeometry(roundedRect(ISLAND.w, ISLAND.h, ISLAND.r), {
      depth: ISLAND_LIFT - 0.08,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 3,
      curveSegments: 32,
    });
    geometry.computeBoundingBox();
    const minZ = geometry.boundingBox?.min.z ?? 0;
    geometry.translate(0, 0, -minZ);
    return geometry;
  }, []);

  // Dark screen surround layered on the island (the LCD sits on top of it).
  const surround = useMemo(
    () => new THREE.ShapeGeometry(roundedRect(BEZEL.w, BEZEL.h, 0.42), 24),
    [],
  );

  const badgePlate = useMemo(
    () => new THREE.ShapeGeometry(roundedRect(BADGE.w, BADGE.h, BADGE.h / 2 - 0.02), 24),
    [],
  );
  const badgeText = useMemo(() => cellPlaneGeometry(BADGE.w * 0.82, BADGE.h * 0.62, "nokia"), []);
  const badgeTextMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: legendTexture(),
        transparent: true,
        color: "#f2f4f8",
        roughness: 0.5,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [],
  );

  return (
    <group>
      <mesh geometry={shell} material={shellMaterials} />

      {/* Chrome island around screen + navi cluster. */}
      <mesh geometry={island} position={[ISLAND.x, ISLAND.y, FACE_Z - 0.01]}>
        <meshStandardMaterial {...materialParams(MATERIALS.island)} />
      </mesh>

      {/* Dark screen surround on the island face. */}
      <mesh geometry={surround} position={[BEZEL.x, BEZEL.y, FACE_Z + ISLAND_LIFT + 0.002]}>
        <meshStandardMaterial {...materialParams(MATERIALS.bezel)} />
      </mesh>

      {/* NOKIA badge: black plate, white wordmark. */}
      <group position={[BADGE.x, BADGE.y, FACE_Z + 0.012]}>
        <mesh geometry={badgePlate}>
          <meshStandardMaterial {...materialParams(MATERIALS.badge)} />
        </mesh>
        <mesh geometry={badgeText} material={badgeTextMaterial} position={[0, 0, 0.004]} />
      </group>
    </group>
  );
}
