import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import Key from "./Key";
import { KEY_NODES, SCREEN_APERTURE, STATIC_NODES } from "./layout";
import { BACKLIGHT_COLOR, LCD_GLOW_INTENSITY, MATERIALS, SCREEN_DIM_TINT } from "./materials";
import type { MaterialSpec } from "./materials";
import { DEFAULT_DRACO_PATH, DEFAULT_MODEL_URL, DEFAULT_SCREEN_BG } from "./types";
import type { Nokia3310Key, Nokia3310Props } from "./types";

/** World height the stage is framed against (plan 03 convention). */
const STAGE_HEIGHT = 10;

function standard(spec: MaterialSpec): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: spec.roughness,
    metalness: spec.metalness,
  });
}

/** Replace the display mesh's UVs with a planar projection from its own
 *  local-space bounding rect, mapped so the texture spans exactly the VISIBLE
 *  aperture (the plane extends under the island's frame — SCREEN_APERTURE in
 *  layout.ts records the hidden margins, measured once against this asset).
 *  The authored UVs were unusable (status bars cropped clean off); the face
 *  is flat so position-projection is exact. flipY=false ⇒ v grows downward. */
function projectPlanarUVs(mesh: THREE.Mesh): void {
  const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  const uv = mesh.geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (uv === undefined) return;
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox;
  if (bb === null) return;
  const w = bb.max.x - bb.min.x || 1;
  const h = bb.max.y - bb.min.y || 1;
  const a = SCREEN_APERTURE;
  for (let i = 0; i < uv.count; i++) {
    const px = (pos.getX(i) - bb.min.x) / w; // 0 = left edge of the plane
    const py = (pos.getY(i) - bb.min.y) / h; // 0 = bottom edge of the plane
    const u = (px - a.left) / (1 - a.left - a.right);
    const v = (1 - py - a.top) / (1 - a.top - a.bottom);
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}

/**
 * The Nokia 3310 — model v3: a sourced, surgically prepared GLB (every key a
 * named node; see docs/plans/10-phone-model-v3-sourced.md). This component
 * adopts the named nodes: keys get the interaction wrapper (depress, pointer,
 * backlight), the display mesh carries the host's 84×48 CanvasTexture, and
 * all materials are dressed in code — the GLB ships geometry only.
 */
export function Nokia3310({
  screenCanvas,
  screenVersion,
  onKey,
  backlightOn = true,
  pressedKeys,
  screenBgColor = DEFAULT_SCREEN_BG,
  modelUrl = DEFAULT_MODEL_URL,
  dracoPath = DEFAULT_DRACO_PATH,
}: Nokia3310Props) {
  const { scene } = useGLTF(modelUrl, dracoPath);

  // Clone per mount (StrictMode/dual mounts must not fight over one graph).
  const model = useMemo(() => scene.clone(true), [scene]);

  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    return { scale: STAGE_HEIGHT / size.y, center, size };
  }, [model]);

  // ── adopt named nodes ──────────────────────────────────────────────────────
  const nodes = useMemo(() => {
    const keys = new Map<Nokia3310Key, THREE.Mesh>();
    for (const [key, name] of Object.entries(KEY_NODES) as [Nokia3310Key, string][]) {
      const mesh = model.getObjectByName(name);
      if (mesh instanceof THREE.Mesh) keys.set(key, mesh);
    }
    const screen = model.getObjectByName("screen");
    const glass = model.getObjectByName("screen_glass");
    return {
      keys,
      screen: screen instanceof THREE.Mesh ? screen : null,
      glass: glass instanceof THREE.Mesh ? glass : null,
    };
  }, [model]);

  // ── dress static materials ─────────────────────────────────────────────────
  useMemo(() => {
    const dress: Record<string, MaterialSpec> = {
      body: MATERIALS.body,
      island: MATERIALS.island,
      badge: MATERIALS.badge,
      badge_logo: MATERIALS.badge,
      side_cap: MATERIALS.body,
    };
    for (const name of STATIC_NODES) {
      const o = model.getObjectByName(name);
      if (o instanceof THREE.Mesh && dress[name]) o.material = standard(dress[name]);
    }
    // badge logo prints light
    const logo = model.getObjectByName("badge_logo");
    if (logo instanceof THREE.Mesh) {
      logo.material = new THREE.MeshStandardMaterial({
        color: "#e8ecf2",
        roughness: 0.5,
        metalness: 0.05,
      });
    }
    // glass: barely-there gloss over the LCD
    if (nodes.glass) {
      nodes.glass.material = new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.08,
        roughness: 0.08,
        metalness: 0,
      });
    }
  }, [model, nodes]);

  // ── the LCD: CanvasTexture onto the model's display mesh ──────────────────
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(screenCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.flipY = false; // glTF UV convention (v down) — flipping is wrong here
    return t;
  }, [screenCanvas]);
  useEffect(() => () => texture.dispose(), [texture]);

  useMemo(() => {
    if (nodes.screen === null) return;
    projectPlanarUVs(nodes.screen);
    nodes.screen.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  }, [nodes, texture]);

  // Tint/dim + surround color react to props without rebuilding the material.
  useEffect(() => {
    if (nodes.screen === null) return;
    const mat = nodes.screen.material as THREE.MeshBasicMaterial;
    mat.color.set(backlightOn ? "#ffffff" : SCREEN_DIM_TINT);
    mat.needsUpdate = true;
  }, [nodes, backlightOn]);
  void screenBgColor; // surround fill is part of the mesh in v3 (dark well)

  const versionRef = useRef(screenVersion);
  versionRef.current = screenVersion;
  const uploadedRef = useRef(-1);
  useFrame(() => {
    if (uploadedRef.current !== versionRef.current) {
      texture.needsUpdate = true;
      uploadedRef.current = versionRef.current;
    }
  });

  // Soft LCD glow behind the glass when lit.
  const glow = backlightOn ? LCD_GLOW_INTENSITY : 0;

  // ── central pointer routing: one raycast surface, name → key ──────────────
  const keyFromEvent = (obj: THREE.Object3D | null): THREE.Mesh | null => {
    let o: THREE.Object3D | null = obj;
    while (o !== null) {
      if (o instanceof THREE.Mesh && typeof o.userData.keyId === "string") return o;
      o = o.parent;
    }
    return null;
  };
  const emit = (mesh: THREE.Mesh, action: "down" | "up") => {
    const held = mesh.userData.heldRef as { current: boolean } | undefined;
    if (held === undefined) return;
    if (action === "down" && !held.current) {
      held.current = true;
      onKey?.(mesh.userData.keyId as Nokia3310Key, "down");
    } else if (action === "up" && held.current) {
      held.current = false;
      onKey?.(mesh.userData.keyId as Nokia3310Key, "up");
    }
  };

  return (
    <group scale={fit.scale}>
      <group position={[-fit.center.x, -fit.center.y, -fit.center.z]}>
        <primitive
          object={model}
          onPointerDown={(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
            const mesh = keyFromEvent(e.object);
            if (mesh === null) return;
            e.stopPropagation();
            (e.nativeEvent.target as Element | null)?.setPointerCapture(e.nativeEvent.pointerId);
            emit(mesh, "down");
          }}
          onPointerUp={(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
            // release EVERY held key — capture means we may not re-hit the mesh
            for (const mesh of nodes.keys.values()) emit(mesh, "up");
            const el = e.nativeEvent.target as Element | null;
            if (el?.hasPointerCapture(e.nativeEvent.pointerId)) {
              el.releasePointerCapture(e.nativeEvent.pointerId);
            }
          }}
          onPointerCancel={() => {
            for (const mesh of nodes.keys.values()) emit(mesh, "up");
          }}
          onPointerOver={(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
            if (keyFromEvent(e.object) !== null) {
              (e.nativeEvent.target as HTMLElement | null)?.style.setProperty("cursor", "pointer");
            }
          }}
          onPointerOut={(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
            (e.nativeEvent.target as HTMLElement | null)?.style.setProperty("cursor", "auto");
          }}
        />
        {[...nodes.keys.entries()].map(([key, mesh]) => (
          <Key
            key={key}
            id={key}
            mesh={mesh}
            backlightOn={backlightOn}
            pressed={pressedKeys?.has(key) ?? false}
            travel={fit.size.y * 0.004}
            onKey={onKey}
          />
        ))}
        {nodes.screen !== null && glow > 0 && (
          <pointLight
            color={BACKLIGHT_COLOR}
            intensity={glow * fit.size.y * 0.15}
            distance={fit.size.y * 0.25}
            decay={2}
            position={[0, fit.center.y + fit.size.y * 0.11, fit.center.z + fit.size.z]}
          />
        )}
      </group>
    </group>
  );
}

useGLTF.preload(DEFAULT_MODEL_URL, DEFAULT_DRACO_PATH);
