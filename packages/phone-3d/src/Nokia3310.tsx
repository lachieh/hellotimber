import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LED_X, backlightLightmap, unlitLightmap } from "./backlight";
import Key from "./Key";
import { KEY_NODES, SCREEN_APERTURE, SCREEN_SCALE, STATIC_NODES } from "./layout";
import { BACKLIGHT_COLOR, LCD_GLOW_INTENSITY, MATERIALS, SCREEN_LIT_PIXEL_TINT } from "./materials";
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

type ApertureRect = NonNullable<ReturnType<typeof visibleApertureRect>>;

/** Planar UVs over the visible aperture (0–1 across it; the hidden margins
 *  fall outside and clamp), so a lightmap lines up with what the eye sees. */
function apertureUvs(geometry: THREE.BufferGeometry, rect: ApertureRect): THREE.BufferGeometry {
  const g = geometry.clone();
  const pos = g.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - (rect.cx - rect.w / 2)) / rect.w;
    uv[i * 2 + 1] = (pos.getY(i) - (rect.cy - rect.h / 2)) / rect.h;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Texels across the lit lightmap (its height follows the aperture's aspect). */
const LIGHTMAP_WIDTH = 84;

/** A lightmap texture: sRGB-encoded light levels, row 0 at the top. */
function lightmapTexture(data: Uint8Array, width: number, height: number): THREE.DataTexture {
  const t = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.flipY = true;
  t.needsUpdate = true;
  return t;
}

/** MeshBasicMaterial divides lightmap texels by π; this makes a full texel
 *  reproduce the material's own colour (the pre-plan-25 lit look). */
const FULL_LIGHTMAP = Math.PI;

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
  // (SCREEN_SCALE of the visible aperture). Both are lit by the display LEDs
  // through one lightmap laid over the aperture.
  const lcd = useMemo(() => {
    if (nodes.screen === null) return null;
    nodes.screen.material = new THREE.MeshBasicMaterial({ toneMapped: false });
    const rect = visibleApertureRect(nodes.screen);
    if (rect === null) return null;
    nodes.screen.geometry = apertureUvs(nodes.screen.geometry, rect);
    const height = Math.max(1, Math.round((LIGHTMAP_WIDTH * rect.h) / rect.w));
    const lit = lightmapTexture(backlightLightmap(LIGHTMAP_WIDTH, height), LIGHTMAP_WIDTH, height);
    // The pixel plane's UVs span only its SCREEN_SCALE share of the aperture.
    const litInset = lit.clone();
    litInset.repeat.setScalar(SCREEN_SCALE);
    litInset.offset.setScalar((1 - SCREEN_SCALE) / 2);
    const lightmaps = { lit, litInset, unlit: lightmapTexture(unlitLightmap(), 1, 1) };
    // LED positions in the model's parent space: just above the aperture's
    // top edge, a little in front of the glass so they spill onto the bezel.
    nodes.screen.updateWorldMatrix(true, false);
    const toModel = model.matrixWorld
      .clone()
      .invert()
      .multiply(nodes.screen.matrixWorld)
      .premultiply(model.matrix);
    const leds = LED_X.map((fx) =>
      new THREE.Vector3(
        rect.cx - rect.w / 2 + fx * rect.w,
        rect.cy + rect.h / 2,
        rect.z + rect.h * 0.15,
      ).applyMatrix4(toModel),
    );

    const existing = nodes.screen.getObjectByName("lcd_pixels");
    if (existing instanceof THREE.Mesh) return { pixels: existing, lightmaps, leds }; // StrictMode re-run
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
    return { pixels: plane, lightmaps, leds };
  }, [model, nodes, texture]);
  useEffect(
    () => () => {
      if (lcd === null) return;
      for (const t of Object.values(lcd.lightmaps)) t.dispose();
    },
    [lcd],
  );

  // The display light swaps the lightmaps: lit, the three LEDs' gradient;
  // unlit, the uniform daylight level. Reacts without rebuilding materials.
  useEffect(() => {
    if (lcd === null || nodes.screen === null) return;
    const { lit, litInset, unlit } = lcd.lightmaps;
    const pixels = lcd.pixels.material as THREE.MeshBasicMaterial;
    pixels.map = texture;
    pixels.color.set(SCREEN_LIT_PIXEL_TINT);
    pixels.lightMap = displayOn ? litInset : unlit;
    pixels.lightMapIntensity = FULL_LIGHTMAP;
    pixels.needsUpdate = true;
    const surround = nodes.screen.material as THREE.MeshBasicMaterial;
    surround.color.set(screenBgColor);
    surround.lightMap = displayOn ? lit : unlit;
    surround.lightMapIntensity = FULL_LIGHTMAP;
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

  // The LEDs' green spill onto the bezel when lit: one weak light per LED.
  const glow = displayOn ? LCD_GLOW_INTENSITY / LED_X.length : 0;

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
        {glow > 0 &&
          lcd?.leds.map((led, i) => (
            <pointLight
              key={i}
              color={BACKLIGHT_COLOR}
              intensity={glow * fit.size.y * 0.15}
              distance={fit.size.y * 0.25}
              decay={2}
              position={led}
            />
          ))}
      </group>
    </group>
  );
}

useGLTF.preload(DEFAULT_MODEL_URL, DEFAULT_DRACO_PATH);
