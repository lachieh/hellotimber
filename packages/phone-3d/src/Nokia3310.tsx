import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import Key from "./Key";
import { KEY_NODES, SCREEN_APERTURE, SCREEN_SCALE, STATIC_NODES } from "./layout";
import {
  BACKLIGHT_COLOR,
  LCD_GLOW_INTENSITY,
  MATERIALS,
  SCREEN_DIM_PIXEL_TINT,
  SCREEN_DIM_TINT,
  SCREEN_LIT_PIXEL_TINT,
} from "./materials";
import type { MaterialSpec } from "./materials";
import { DEFAULT_DRACO_PATH, DEFAULT_MODEL_URL, DEFAULT_SCREEN_BG, resolveLights } from "./types";
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

/** The visible aperture of the model's display plane, in the plane's LOCAL
 *  coords (the plane extends under the island's frame — SCREEN_APERTURE in
 *  layout.ts records the hidden margins, measured once against this asset). */
function visibleApertureRect(
  mesh: THREE.Mesh,
): { cx: number; cy: number; w: number; h: number; z: number } | null {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox;
  if (bb === null) return null;
  const w = bb.max.x - bb.min.x;
  const h = bb.max.y - bb.min.y;
  const a = SCREEN_APERTURE;
  const x0 = bb.min.x + a.left * w;
  const x1 = bb.max.x - a.right * w;
  const yTop = bb.max.y - a.top * h;
  const yBot = bb.min.y + a.bottom * h;
  return { cx: (x0 + x1) / 2, cy: (yTop + yBot) / 2, w: x1 - x0, h: yTop - yBot, z: bb.max.z };
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
  backlightOn,
  keypadLightOn,
  pressedKeys,
  screenBgColor = DEFAULT_SCREEN_BG,
  modelUrl = DEFAULT_MODEL_URL,
  dracoPath = DEFAULT_DRACO_PATH,
}: Nokia3310Props) {
  const { scene } = useGLTF(modelUrl, dracoPath);
  const { display: displayOn, keypad: keypadOn } = resolveLights({ backlightOn, keypadLightOn });

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
    // The sourced glass mesh only covers the upper part of the LCD. A matching
    // full-size glass plane is added with lcd_pixels below.
    if (nodes.glass) {
      nodes.glass.visible = false;
    }
  }, [model, nodes]);

  // ── the LCD: CanvasTexture onto the model's display mesh ──────────────────
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(screenCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.flipY = true; // the LCD child is a generated plane (standard v-up UVs)
    return t;
  }, [screenCanvas]);
  useEffect(() => () => texture.dispose(), [texture]);

  // Two layers: the model's oversized display plane becomes the LCD SURROUND
  // (filled with screenBgColor so it reads as one continuous screen — same
  // contract as the v1 era), and a smaller child plane carries the pixels
  // (SCREEN_SCALE of the visible aperture).
  const lcd = useMemo(() => {
    if (nodes.screen === null) return null;
    nodes.screen.material = new THREE.MeshBasicMaterial({ toneMapped: false });
    const rect = visibleApertureRect(nodes.screen);
    if (rect === null) return null;
    const existing = nodes.screen.getObjectByName("lcd_pixels");
    if (existing instanceof THREE.Mesh) return existing; // StrictMode re-run
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(rect.w * SCREEN_SCALE, rect.h * SCREEN_SCALE),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    );
    plane.name = "lcd_pixels";
    plane.position.set(rect.cx, rect.cy, rect.z + 0.0005);
    nodes.screen.add(plane);

    const glass = new THREE.Mesh(
      plane.geometry,
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.08,
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.4,
        depthWrite: false,
      }),
    );
    glass.name = "lcd_glass";
    glass.position.set(rect.cx, rect.cy, rect.z + 0.001);
    nodes.screen.add(glass);
    return plane;
  }, [nodes, texture]);

  // Tint/dim reacts to props without rebuilding materials. The surround is
  // screenBgColor multiplied by the same dim tint as the pixels, so both
  // layers read as one LCD in either backlight state.
  useEffect(() => {
    if (lcd === null || nodes.screen === null) return;
    const pixelTint = new THREE.Color(displayOn ? SCREEN_LIT_PIXEL_TINT : SCREEN_DIM_PIXEL_TINT);
    const surroundTint = new THREE.Color(displayOn ? "#ffffff" : SCREEN_DIM_TINT);
    const pixels = lcd.material as THREE.MeshBasicMaterial;
    pixels.map = texture;
    pixels.color.copy(pixelTint);
    pixels.needsUpdate = true;
    const surround = nodes.screen.material as THREE.MeshBasicMaterial;
    surround.color.set(screenBgColor).multiply(surroundTint);
    surround.needsUpdate = true;
  }, [lcd, nodes, texture, displayOn, screenBgColor]);

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
  const glow = displayOn ? LCD_GLOW_INTENSITY : 0;

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
            lightOn={keypadOn}
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
