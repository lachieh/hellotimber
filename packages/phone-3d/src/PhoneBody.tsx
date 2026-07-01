import { useMemo } from "react";
import * as THREE from "three";
import { cellPlaneGeometry, legendTexture } from "./atlas";
import { BEZEL, BEZEL_LIP, BODY, BODY_PROFILE, FACE_Z, LCD, LCD_Z } from "./layout";
import { MATERIALS, PRINT_LIGHT } from "./materials";
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
 * The shell, screen bezel, screen well, and the printed face decals (NOKIA
 * wordmark + earpiece slots). Everything beveled-extruded from 2D outlines —
 * smooth normals by construction, no facet artifacts.
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

  const bezelRing = useMemo(() => {
    const outer = roundedRect(BEZEL.w, BEZEL.h, 0.5);
    outer.holes.push(roundedRect(LCD.w + 0.14, LCD.h + 0.14, 0.12) as unknown as THREE.Path);
    const geometry = new THREE.ExtrudeGeometry(outer, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 3,
      curveSegments: 24,
    });
    return centerDepth(geometry);
  }, []);

  const decals = useMemo(
    () => ({
      nokia: cellPlaneGeometry(1.9, 0.46, "nokia"),
      earpiece: cellPlaneGeometry(1.15, 0.55, "earpiece"),
    }),
    [],
  );
  const printMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: legendTexture(),
        transparent: true,
        color: PRINT_LIGHT,
        roughness: 0.6,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [],
  );

  return (
    <group>
      <mesh geometry={shell} material={shellMaterials} />

      {/* Screen surround: raised ring with the LCD opening. */}
      <mesh
        geometry={bezelRing}
        position={[BEZEL.x, BEZEL.y, FACE_Z + (BEZEL_LIP + 0.08) / 2 - 0.04]}
      >
        <meshStandardMaterial {...materialParams(MATERIALS.bezel)} />
      </mesh>

      {/* Dark screen well behind/around the LCD plane. */}
      <mesh position={[LCD.x, LCD.y, LCD_Z - 0.008]}>
        <planeGeometry args={[LCD.w + 0.14, LCD.h + 0.14]} />
        <meshStandardMaterial {...materialParams(MATERIALS.grille)} />
      </mesh>

      {/* Printed decals. */}
      <mesh geometry={decals.nokia} material={printMaterial} position={[0, 3.32, FACE_Z + 0.004]} />
      <mesh
        geometry={decals.earpiece}
        material={printMaterial}
        position={[0, 4.55, FACE_Z + 0.004]}
      />
    </group>
  );
}
