import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { KEY_HOTSPOTS } from "./hotspots";
import { SCREEN_DIM_TINT } from "./materials";
import { DEFAULT_DRACO_PATH, DEFAULT_MODEL_URL } from "./types";
import type { Nokia3310Key, Nokia3310Props } from "./types";

/** Target height (world units) the model is normalized to, so the rest of the
 *  scene (camera, lights, hotspots) can be authored against a stable size
 *  regardless of the GLB's native units. */
const MODEL_HEIGHT = 10;

/** Name of the screen mesh inside the GLB (verified via gltf inspect). */
const SCREEN_MESH = "Plane003_screen_0";
/** Name of the backlight element mesh. */
const LIGHT_MESH = "Plane007_light_1_0";

/**
 * The real Nokia 3310 — a Draco-compressed glTF model (shaderbytes, Sketchfab
 * Standard license). The package renders whatever model URL the host serves; it
 * never imports phone-core. The 84×48 LCD is drawn by the host onto a canvas and
 * mapped here as a CanvasTexture overlay on the model's screen face.
 */
export function Nokia3310({
  screenCanvas,
  screenVersion,
  onKey,
  backlightOn = true,
  pressedKeys,
  modelUrl = DEFAULT_MODEL_URL,
  dracoPath = DEFAULT_DRACO_PATH,
}: Nokia3310Props) {
  const { scene } = useGLTF(modelUrl, dracoPath);

  // Clone so multiple instances / strict-mode double-mounts don't fight over one
  // graph, and so we can freely mutate materials.
  const model = useMemo(() => scene.clone(true), [scene]);

  // --- Normalize: center the model and scale it to MODEL_HEIGHT, front facing +Z.
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = MODEL_HEIGHT / size.y;
    return { scale, center, size };
  }, [model]);

  // --- LCD CanvasTexture (same pixel-crisp setup as the old Screen.tsx).
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(screenCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.flipY = true;
    return t;
  }, [screenCanvas]);
  useEffect(() => () => texture.dispose(), [texture]);

  // Locate the screen + light meshes once, and compute the screen's local
  // placement so the LCD overlay sits exactly on the screen face.
  const screenInfo = useMemo(() => {
    let screen: THREE.Mesh | undefined;
    let light: THREE.Mesh | undefined;
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        if (o.name === SCREEN_MESH) screen = o as THREE.Mesh;
        if (o.name === LIGHT_MESH) light = o as THREE.Mesh;
      }
    });
    let overlay: { x: number; y: number; z: number; w: number; h: number } | null = null;
    if (screen) {
      // Box of the screen mesh in the MODEL's coordinate frame (accounts for the
      // mesh's own transform within the model hierarchy). model is untransformed
      // at this point, so setFromObject gives model-local coordinates — the same
      // frame the overlay mesh (a sibling of <primitive>) lives in.
      model.updateWorldMatrix(true, true);
      const bb = new THREE.Box3().setFromObject(screen);
      overlay = {
        x: (bb.min.x + bb.max.x) / 2,
        y: (bb.min.y + bb.max.y) / 2,
        z: bb.max.z + 0.3, // float just proud of the recessed glass
        w: bb.max.x - bb.min.x,
        h: bb.max.y - bb.min.y,
      };
      // Hide the model's baked screen graphic so our LCD reads clean.
      screen.visible = false;
    }
    return { screen, light, overlay };
  }, [model]);

  // --- Backlight: drive the light mesh's emissive + a soft green point light.
  useEffect(() => {
    const light = screenInfo.light;
    if (light && (light.material as THREE.MeshStandardMaterial).emissive) {
      const mat = light.material as THREE.MeshStandardMaterial;
      mat.emissive = new THREE.Color(backlightOn ? "#9fe3b0" : "#000000");
      mat.emissiveIntensity = backlightOn ? 1.2 : 0;
      mat.needsUpdate = true;
    }
  }, [screenInfo, backlightOn]);

  // Re-upload the LCD texture only when the host bumps screenVersion.
  const versionRef = useRef(screenVersion);
  versionRef.current = screenVersion;
  const uploadedRef = useRef(-1);
  useFrame(() => {
    if (uploadedRef.current !== versionRef.current) {
      texture.needsUpdate = true;
      uploadedRef.current = versionRef.current;
    }
  });

  // The model group: scaled + centered. Children (screen overlay, hotspots) are
  // authored in the SAME local space as the model so they line up.
  return (
    <group scale={fit.scale} position={[0, 0, 0]}>
      <group position={[-fit.center.x, -fit.center.y, -fit.center.z]}>
        <primitive object={model} />

        {/* LCD overlay on the screen face */}
        {screenInfo.overlay && (
          <mesh position={[screenInfo.overlay.x, screenInfo.overlay.y, screenInfo.overlay.z]}>
            <planeGeometry args={[screenInfo.overlay.w, screenInfo.overlay.h]} />
            <meshBasicMaterial
              map={texture}
              toneMapped={false}
              color={backlightOn ? "#ffffff" : SCREEN_DIM_TINT}
            />
          </mesh>
        )}

        {/* Invisible key hotspots for pointer interaction (the model's keypad is
            one fused mesh, so we raycast transparent planes over each key). */}
        <KeyHotspots fit={fit} onKey={onKey} pressedKeys={pressedKeys} />

        {backlightOn && (
          <pointLight
            color="#9fe3b0"
            intensity={fit.size.y * 2}
            distance={fit.size.y}
            decay={2}
            position={[0, fit.center.y, fit.size.z + fit.size.y * 0.5]}
          />
        )}
      </group>
    </group>
  );
}

/** Renders one transparent, pointer-interactive plane per key, positioned from
 *  KEY_HOTSPOTS (fractions of the model's front face). */
function KeyHotspots({
  fit,
  onKey,
  pressedKeys,
}: {
  fit: { center: THREE.Vector3; size: THREE.Vector3 };
  onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
  pressedKeys?: ReadonlySet<Nokia3310Key>;
}) {
  const { size, center } = fit;
  const frontZ = center.z + size.z / 2 + 0.2;
  return (
    <>
      {KEY_HOTSPOTS.map((h) => {
        const x = center.x + (h.cx - 0.5) * size.x;
        const y = center.y + (h.cy - 0.5) * size.y;
        const w = h.w * size.x;
        const hgt = h.h * size.y;
        const pressed = pressedKeys?.has(h.key) ?? false;
        return (
          <Hotspot
            key={h.key}
            id={h.key}
            x={x}
            y={y}
            z={frontZ - (pressed ? 0.3 : 0)}
            w={w}
            h={hgt}
            onKey={onKey}
          />
        );
      })}
    </>
  );
}

function Hotspot({
  id,
  x,
  y,
  z,
  w,
  h,
  onKey,
}: {
  id: Nokia3310Key;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
}) {
  const { gl } = useThree();
  return (
    <mesh
      position={[x, y, z]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onKey?.(id, "down");
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onKey?.(id, "up");
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        gl.domElement.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        gl.domElement.style.cursor = "auto";
      }}
    >
      <planeGeometry args={[w, h]} />
      {/* Invisible but still raycast-hit (transparent material with opacity 0).
          Flip DEBUG_HOTSPOTS to visualize hit areas when re-calibrating. */}
      <meshBasicMaterial
        color="#ff0044"
        transparent
        opacity={DEBUG_HOTSPOTS ? 0.4 : 0}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

const DEBUG_HOTSPOTS = false;

useGLTF.preload(DEFAULT_MODEL_URL, DEFAULT_DRACO_PATH);
