import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { cellPlaneGeometry, legendTexture } from "./atlas";
import { FACE_Z, KEY_DEPTH, KEY_TRAVEL, LEGEND_LIFT } from "./layout";
import type { KeyLayoutEntry } from "./layout";
import {
  BACKLIGHT_COLOR,
  KEY_GLOW_INTENSITY,
  LEGEND_GLOW_INTENSITY,
  MATERIALS,
  PRINT_DARK,
} from "./materials";
import type { Nokia3310Key } from "./types";

/** Cap bevel: outlines are built inset by this so the key's widest
 *  cross-section equals the layout footprint (the non-overlap guarantee). */
const CAP_BEVEL = 0.05;

/** Stadium (rounded-ends pill), centered, with optional vertical bowing of the
 *  long edges: positive bow curves an edge upward at its center. */
function bowedPill(w: number, h: number, topBow: number, bottomBow: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const r = hh;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.quadraticCurveTo(0, -hh + bottomBow * 2, hw - r, -hh);
  shape.absarc(hw - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.quadraticCurveTo(0, hh + topBow * 2, -hw + r, hh);
  shape.absarc(-hw + r, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  return shape;
}

function keyShape(entry: KeyLayoutEntry): THREE.Shape {
  const w = entry.w - 2 * CAP_BEVEL;
  const h = entry.h - 2 * CAP_BEVEL;
  switch (entry.shape) {
    case "pill":
    case "dot":
      return bowedPill(w, h, 0, 0);
    case "crescent":
      // The wide NaviKey: gentle smile — top edge nearly level, bottom bows up.
      return bowedPill(w, h, 0.04, 0.1);
    case "wing-l":
    case "wing-r":
      // C / ▲▼ wings: a slight banana that hugs the NaviKey once rotated.
      return bowedPill(w, h, 0.05, 0.05);
  }
}

function legendCellFor(key: Nokia3310Key): string | null {
  if (key === "power") return null; // top-edge dot carries no print
  return key; // digits, *, #, c, up, down, navi all have atlas cells
}

export interface KeyProps {
  entry: KeyLayoutEntry;
  backlightOn: boolean;
  /** Externally-driven depress (keyboard input mirrored into the 3D keypad). */
  pressed: boolean;
  onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
}

/** One pressable key: beveled extruded cap + legend decal, sinks by KEY_TRAVEL
 *  while pointer-held or externally pressed. */
export default function Key({ entry, backlightOn, pressed, onKey }: KeyProps) {
  const group = useRef<THREE.Group>(null);
  const [pointerHeld, setPointerHeld] = useState(false);
  const { gl } = useThree();
  const down = pointerHeld || pressed;

  const capGeometry = useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(keyShape(entry), {
      depth: KEY_DEPTH - 2 * CAP_BEVEL,
      bevelEnabled: true,
      bevelThickness: CAP_BEVEL,
      bevelSize: CAP_BEVEL,
      bevelSegments: 3,
      curveSegments: 24,
    });
    // Root the cap so it rises from the face plane: z ∈ [0, KEY_DEPTH].
    geometry.computeBoundingBox();
    const minZ = geometry.boundingBox?.min.z ?? 0;
    geometry.translate(0, 0, -minZ);
    return geometry;
  }, [entry]);

  const legendCell = legendCellFor(entry.key);
  const legendGeometry = useMemo(() => {
    if (legendCell === null) return null;
    if (legendCell === "navi") {
      const w = entry.w * 0.72;
      return cellPlaneGeometry(w, w / 4, "navi"); // wide 4:1 atlas cell
    }
    const side = Math.min(entry.w, entry.h) * 0.92;
    return cellPlaneGeometry(side, side, legendCell);
  }, [entry, legendCell]);

  const spec = entry.key === "navi" ? MATERIALS.navi : MATERIALS.key;

  const release = () => {
    setPointerHeld((held) => {
      if (held) onKey?.(entry.key, "up");
      return false;
    });
  };

  useFrame((_, dt) => {
    const g = group.current;
    if (g === null) return;
    const target = down ? -KEY_TRAVEL : 0;
    const rate = Math.min(1, dt * 25);
    g.position.z += (target - g.position.z) * rate;
  });

  return (
    <group position={[entry.x, entry.y, FACE_Z]} rotation={[0, 0, (entry.rot * Math.PI) / 180]}>
      <group ref={group}>
        <mesh
          geometry={capGeometry}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.target as Element | null)?.setPointerCapture(e.pointerId);
            setPointerHeld(true);
            onKey?.(entry.key, "down");
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            (e.target as Element | null)?.releasePointerCapture(e.pointerId);
            release();
          }}
          onPointerCancel={release}
          onPointerOver={(e) => {
            e.stopPropagation();
            gl.domElement.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            gl.domElement.style.cursor = "auto";
          }}
        >
          <meshStandardMaterial
            color={spec.color}
            roughness={spec.roughness}
            metalness={spec.metalness}
            emissive={BACKLIGHT_COLOR}
            emissiveIntensity={backlightOn ? KEY_GLOW_INTENSITY : 0}
          />
        </mesh>

        {legendGeometry !== null && (
          <mesh geometry={legendGeometry} position={[0, 0, KEY_DEPTH + LEGEND_LIFT]}>
            <meshStandardMaterial
              map={legendTexture()}
              transparent
              color={PRINT_DARK}
              roughness={0.55}
              metalness={0}
              emissive={BACKLIGHT_COLOR}
              emissiveIntensity={backlightOn ? LEGEND_GLOW_INTENSITY : 0}
              polygonOffset
              polygonOffsetFactor={-1}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}
