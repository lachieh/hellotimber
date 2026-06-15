import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { isCalibrating, useCal, useScreenCal, useSelectedKey } from "./calibration";
import type { ScreenCal } from "./calibration";
import { KEY_HOTSPOTS } from "./hotspots";
import { SCREEN_DIM_TINT } from "./materials";
import { DEFAULT_DRACO_PATH, DEFAULT_MODEL_URL, DEFAULT_SCREEN_BG } from "./types";
import type { Nokia3310Key, Nokia3310Props } from "./types";

/** Target height (world units) the model is normalized to, so the rest of the
 *  scene (camera, lights, hotspots) can be authored against a stable size
 *  regardless of the GLB's native units. */
const MODEL_HEIGHT = 10;

/** Name of the screen mesh inside the GLB (verified via gltf inspect). */
const SCREEN_MESH = "Plane003_screen_0";
/** Name of the backlight element mesh. */
const LIGHT_MESH = "Plane007_light_1_0";

/** Depth of the key hotspot planes as a fraction of model depth, measured out
 *  from center toward the camera. 0.5 = front rim. Tunable in one place. */
const HOTSPOT_Z_FRAC = 0.5;

/** Baked screen-overlay adjustment (tuned via `?calibrate=1` → Screen sliders).
 *  Multiplies/offsets the auto-detected LCD rectangle so it sits inside the
 *  model's screen frame. offX/offY are fractions of the screen size; offZ is in
 *  model-local depth units (before the model is scaled). */
const SCREEN_ADJUST: ScreenCal = {
  scaleW: 0.87,
  scaleH: 0.87,
  offX: 0,
  offY: 0,
  offZ: -3.75,
  pitch: -8,
  yaw: 0,
  roll: 0,
};

const DEG = Math.PI / 180;

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
  modelUrl = DEFAULT_MODEL_URL,
  dracoPath = DEFAULT_DRACO_PATH,
  screenBgColor = DEFAULT_SCREEN_BG,
}: Nokia3310Props) {
  const { scene } = useGLTF(modelUrl, dracoPath);
  // Calibration mode is dev-only; reads the live cal store so the panel can move
  // hotspots in real time. selected drives the green highlight.
  const calibrating = isCalibrating();
  const selected = useSelectedKey();
  const liveScreen = useScreenCal();
  const screenAdj = calibrating ? liveScreen : SCREEN_ADJUST;

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
      // Replace the model's baked screen graphic with a flat LCD-background fill,
      // so when the overlay is smaller than the frame the surrounding screen
      // surface still reads as one continuous LCD (colour set in an effect below).
      screen.material = new THREE.MeshBasicMaterial({ toneMapped: false });
    }
    return { screen, light, overlay };
  }, [model]);

  // Keep the screen-face fill in sync with the host's LCD background colour.
  useEffect(() => {
    const screen = screenInfo.screen;
    const mat = screen?.material as THREE.MeshBasicMaterial | undefined;
    if (mat) {
      mat.color.set(screenBgColor);
      mat.needsUpdate = true;
    }
  }, [screenInfo, screenBgColor]);

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

        {/* LCD overlay on the screen face. Auto-sized from the screen mesh box,
            then nudged by screenAdj (scale + offset + pitch/yaw/roll) to seat it
            inside the frame. */}
        {screenInfo.overlay && (
          <mesh
            position={[
              screenInfo.overlay.x + screenAdj.offX * screenInfo.overlay.w,
              screenInfo.overlay.y + screenAdj.offY * screenInfo.overlay.h,
              screenInfo.overlay.z + screenAdj.offZ,
            ]}
            rotation={[screenAdj.pitch * DEG, screenAdj.yaw * DEG, screenAdj.roll * DEG]}
          >
            <planeGeometry
              args={[
                screenInfo.overlay.w * screenAdj.scaleW,
                screenInfo.overlay.h * screenAdj.scaleH,
              ]}
            />
            <meshBasicMaterial
              map={texture}
              toneMapped={false}
              color={backlightOn ? "#ffffff" : SCREEN_DIM_TINT}
            />
          </mesh>
        )}

        {/* Invisible key hotspots for pointer interaction (the model's keypad is
            one fused mesh, so we raycast transparent planes over each key). */}
        <KeyHotspots fit={fit} onKey={onKey} calibrating={calibrating} selected={selected} />

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

/** Renders one transparent, pointer-interactive plane per key. Positions come
 *  from KEY_HOTSPOTS, or — when calibration mode is on — from the live cal map
 *  so the on-screen panel can adjust x/y/z/w/h per key in real time. */
function KeyHotspots({
  fit,
  onKey,
  calibrating,
  selected,
}: {
  fit: { center: THREE.Vector3; size: THREE.Vector3 };
  onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
  calibrating: boolean;
  selected?: Nokia3310Key;
}) {
  const { size, center } = fit;
  const cal = useCal();
  return (
    <>
      {KEY_HOTSPOTS.map((base) => {
        const c = calibrating
          ? cal[base.key]
          : {
              x: base.cx,
              y: base.cy,
              z: base.z ?? HOTSPOT_Z_FRAC,
              w: base.w,
              h: base.h,
              rot: base.rot ?? 0,
            };
        const x = center.x + (c.x - 0.5) * size.x;
        const y = center.y + (c.y - 0.5) * size.y;
        const z = center.z + size.z * c.z;
        const w = c.w * size.x;
        const hgt = c.h * size.y;
        return (
          <Hotspot
            key={base.key}
            id={base.key}
            x={x}
            y={y}
            z={z}
            w={w}
            h={hgt}
            rot={c.rot}
            onKey={onKey}
            debug={calibrating || DEBUG_HOTSPOTS}
            highlight={calibrating && base.key === selected}
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
  rot,
  onKey,
  debug,
  highlight,
}: {
  id: Nokia3310Key;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  rot: number;
  onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
  debug: boolean;
  highlight: boolean;
}) {
  const { gl } = useThree();
  return (
    <mesh
      position={[x, y, z]}
      rotation={[0, 0, (rot * Math.PI) / 180]}
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
      {/* Invisible but still raycast-hit (opacity 0) in normal use; tinted when
          debugging/calibrating, brighter for the selected key. */}
      <meshBasicMaterial
        color={highlight ? "#22ff88" : "#ff0044"}
        transparent
        opacity={debug ? (highlight ? 0.7 : 0.35) : 0}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

const DEBUG_HOTSPOTS = false;

useGLTF.preload(DEFAULT_MODEL_URL, DEFAULT_DRACO_PATH);
