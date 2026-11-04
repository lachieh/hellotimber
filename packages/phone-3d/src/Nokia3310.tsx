import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LED_X, backlightLightmap, unlitLightmap } from "./backlight";
import { STAGE_HEIGHT } from "./frame";
import Key from "./Key";
import {
  INK_SHADOW_BLUR,
  INK_SHADOW_OFFSET,
  INK_SHADOW_OPACITY,
  INK_SHADOW_SCALE,
  inkMask,
  shadowMask,
} from "./lcd-ink";
import type { Mask } from "./lcd-ink";
import {
  LCD_SHADOW_OPACITY,
  LCD_SHADOW_SOFTNESS,
  recessShadow as shadowFromLip,
  towardLightIn,
} from "./lcd-recess";
import {
  KEY_NODES,
  LCD_OPENING,
  LCD_RECESS,
  SCREEN_APERTURE,
  SCREEN_SCALE,
  STATIC_NODES,
} from "./layout";
import {
  BACKLIGHT_COLOR,
  LCD_GLOW_INTENSITY,
  MATERIALS,
  SCREEN_DIM_TINT,
  SCREEN_LIT_PIXEL_TINT,
} from "./materials";
import type { MaterialSpec } from "./materials";
import { startPress } from "./press";
import { DEFAULT_DRACO_PATH, DEFAULT_MODEL_URL, DEFAULT_SCREEN_BG, resolveLights } from "./types";
import type { Nokia3310Key, Nokia3310Props } from "./types";

const POINTER_EVENTS = ["pointermove", "pointerup", "pointercancel"] as const;

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

/** The brightest directional light in `scene`: the key light the bezel's shadow follows. */
function keyLight(scene: THREE.Object3D): THREE.DirectionalLight | undefined {
  let key: THREE.DirectionalLight | undefined;
  scene.traverseVisible((object) => {
    if (object instanceof THREE.DirectionalLight && object.intensity > (key?.intensity ?? 0))
      key = object;
  });
  return key;
}

/**
 * The bezel's shadow on the LCD (lcd-recess.ts): a plane over the opening, in front of the LCD's
 * layers, dark where a point's ray to the key light crosses the lip's height outside the opening.
 * Its opening and recess are the display plane's (LCD_OPENING, LCD_RECESS), in its local space.
 */
function recessShadow(screen: THREE.Mesh): THREE.Mesh | null {
  screen.geometry.computeBoundingBox();
  const bb = screen.geometry.boundingBox;
  if (bb === null) return null;
  const w = bb.max.x - bb.min.x;
  const h = bb.max.y - bb.min.y;
  const o = LCD_OPENING;
  const x0 = bb.min.x + o.left * w;
  const x1 = bb.max.x - o.right * w;
  const y0 = bb.min.y + o.bottom * h;
  const y1 = bb.max.y - o.top * h;
  const recess = LCD_RECESS * h;
  const uniforms = {
    uHalf: { value: new THREE.Vector2((x1 - x0) / 2, (y1 - y0) / 2) },
    uRadius: { value: new THREE.Vector2(o.radiusTop * (x1 - x0), o.radiusBottom * (x1 - x0)) },
    uOffset: { value: new THREE.Vector2() },
    uSoft: { value: 0 },
  };
  const material = new THREE.MeshBasicMaterial({
    color: "#000000",
    transparent: true,
    opacity: LCD_SHADOW_OPACITY,
    depthWrite: false,
    toneMapped: false,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vLcd;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLcd = position.xy;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vLcd;
uniform vec2 uHalf, uRadius, uOffset;
uniform float uSoft;
// Signed distance to the opening, the plane's own centre: a rounded rectangle, its top corners
// tighter than its bottom.
float opening(vec2 p) {
  float r = p.y > 0.0 ? uRadius.x : uRadius.y;
  vec2 q = abs(p) - uHalf + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
if (opening(vLcd) > 0.0) discard;
diffuseColor.a *= smoothstep(-uSoft, uSoft, opening(vLcd + uOffset));`,
      );
  };
  material.customProgramCacheKey = () => "lcd-recess-shadow";

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), material);
  mesh.name = "lcd_recess_shadow";
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, bb.max.z + 0.0015);
  mesh.renderOrder = 1;
  mesh.raycast = () => {};
  let key: THREE.DirectionalLight | undefined;
  const toLight = new THREE.Vector3();
  const target = new THREE.Vector3();
  mesh.onBeforeRender = (_renderer, scene) => {
    if (key?.parent == null) key = keyLight(scene);
    if (key === undefined) {
      material.opacity = 0;
      return;
    }
    key.getWorldPosition(toLight).sub(key.target.getWorldPosition(target));
    const { offset, strength } = shadowFromLip(towardLightIn(mesh, toLight), recess);
    uniforms.uOffset.value.set(...offset);
    uniforms.uSoft.value =
      LCD_SHADOW_SOFTNESS.recess * recess + LCD_SHADOW_SOFTNESS.reach * Math.hypot(...offset);
    material.opacity = LCD_SHADOW_OPACITY * strength;
  };
  return mesh;
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

/** A coverage mask as a texture. three's alphaMap samples the green channel,
 *  so every channel carries the coverage. */
function maskTexture(width: number, height: number, filter: THREE.MagnificationTextureFilter) {
  const t = new THREE.DataTexture(new Uint8Array(width * height * 4), width, height);
  t.magFilter = filter;
  t.minFilter = filter;
  t.flipY = true; // row 0 is the screen's top; the planes have v-up UVs
  t.needsUpdate = true;
  return t;
}

function writeMask(texture: THREE.DataTexture, mask: Mask): void {
  const rgba = texture.image.data as Uint8Array;
  mask.data.forEach((v, i) => rgba.fill(v, i * 4, i * 4 + 4));
  texture.needsUpdate = true;
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
    // The shell's inside, seen through its openings (the earpiece slots, the key wells): the
    // one-sided body would show straight through to whatever is behind the phone, so its
    // inward faces are drawn dark and unlit.
    for (const name of ["body", "side_cap"]) {
      const o = model.getObjectByName(name);
      if (!(o instanceof THREE.Mesh) || o.getObjectByName(`${name}_interior`)) continue;
      const interior = new THREE.Mesh(
        o.geometry,
        new THREE.MeshBasicMaterial({ color: MATERIALS.interior.color, side: THREE.BackSide }),
      );
      interior.name = `${name}_interior`;
      interior.raycast = () => {};
      o.add(interior);
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

  // The LCD, back to front: the model's oversized display plane is the lit
  // LCD (screenBgColor under the display LEDs' lightmap, laid over the visible
  // aperture), then the ink's soft drop shadow, then the ink itself (the host
  // canvas's foreground pixels, cut out by a mask) a hair above it, so the
  // pixels seem to float over the backlight like an early monochrome LCD. The
  // ink layers cover SCREEN_SCALE of the aperture; the canvas's background is
  // never drawn (the lit plane is the background).
  const lcd = useMemo(() => {
    if (nodes.screen === null) return null;
    nodes.screen.material = new THREE.MeshBasicMaterial({ toneMapped: false });
    const rect = visibleApertureRect(nodes.screen);
    if (rect === null) return null;
    nodes.screen.geometry = apertureUvs(nodes.screen.geometry, rect);
    const height = Math.max(1, Math.round((LIGHTMAP_WIDTH * rect.h) / rect.w));
    const lightmaps = {
      lit: lightmapTexture(backlightLightmap(LIGHTMAP_WIDTH, height), LIGHTMAP_WIDTH, height),
      unlit: lightmapTexture(unlitLightmap(), 1, 1),
    };
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

    const { width, height: rows } = screenCanvas;
    const masks = {
      ink: maskTexture(width, rows, THREE.NearestFilter),
      shadow: maskTexture(width * INK_SHADOW_SCALE, rows * INK_SHADOW_SCALE, THREE.LinearFilter),
    };
    const plane = new THREE.PlaneGeometry(rect.w * SCREEN_SCALE, rect.h * SCREEN_SCALE);
    const shadow = new THREE.Mesh(
      plane,
      new THREE.MeshBasicMaterial({
        color: "#000000",
        alphaMap: masks.shadow,
        transparent: true,
        opacity: INK_SHADOW_OPACITY,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    shadow.name = "lcd_shadow";
    const pixel = (rect.w * SCREEN_SCALE) / width;
    shadow.position.set(
      rect.cx + pixel * INK_SHADOW_OFFSET,
      rect.cy - pixel * INK_SHADOW_OFFSET,
      rect.z + 0.0003,
    );
    const ink = new THREE.Mesh(
      plane,
      new THREE.MeshBasicMaterial({
        map: texture,
        alphaMap: masks.ink,
        alphaTest: 0.5,
        toneMapped: false,
      }),
    );
    ink.name = "lcd_ink";
    ink.position.set(rect.cx, rect.cy, rect.z + 0.0005);
    const glass = new THREE.Mesh(
      plane,
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
    const recess = recessShadow(nodes.screen);
    const layers = recess === null ? [shadow, ink, glass] : [shadow, ink, glass, recess];
    return { layers, ink, lightmaps, masks, leds };
  }, [model, nodes, texture, screenCanvas]);
  // Attach the layers in an effect: StrictMode runs the memo twice and keeps
  // one result, so only the kept layers may join the scene.
  useEffect(() => {
    if (lcd === null || nodes.screen === null) return;
    const screen = nodes.screen;
    screen.add(...lcd.layers);
    return () => {
      screen.remove(...lcd.layers);
      for (const t of [...Object.values(lcd.lightmaps), ...Object.values(lcd.masks)]) t.dispose();
    };
  }, [lcd, nodes]);

  // The display light swaps the lit plane's lightmap: lit, the three LEDs'
  // gradient; unlit, the uniform daylight level. The ink blocks the backlight,
  // so it only dims with it. Reacts without rebuilding materials.
  useEffect(() => {
    if (lcd === null || nodes.screen === null) return;
    const ink = lcd.ink.material as THREE.MeshBasicMaterial;
    ink.color.set(displayOn ? SCREEN_LIT_PIXEL_TINT : SCREEN_DIM_TINT);
    const surround = nodes.screen.material as THREE.MeshBasicMaterial;
    surround.color.set(screenBgColor);
    surround.lightMap = displayOn ? lcd.lightmaps.lit : lcd.lightmaps.unlit;
    surround.lightMapIntensity = FULL_LIGHTMAP;
    surround.needsUpdate = true;
  }, [lcd, nodes, displayOn, screenBgColor]);

  // Each new screen (or background colour) re-uploads the canvas and
  // re-derives the ink and shadow masks from its pixels.
  const versionRef = useRef(screenVersion);
  versionRef.current = screenVersion;
  const uploadedRef = useRef(-1);
  useEffect(() => {
    uploadedRef.current = -1;
  }, [lcd, screenBgColor]);
  const scratch = useMemo(() => document.createElement("canvas"), []);
  useFrame(() => {
    if (uploadedRef.current === versionRef.current) return;
    uploadedRef.current = versionRef.current;
    texture.needsUpdate = true;
    if (lcd === null) return;
    // Read through a 2D scratch canvas: the host's canvas may hold any context.
    scratch.width = screenCanvas.width;
    scratch.height = screenCanvas.height;
    const ctx = scratch.getContext("2d", { willReadFrequently: true });
    if (ctx === null) return;
    ctx.drawImage(screenCanvas, 0, 0);
    const ink = inkMask(ctx.getImageData(0, 0, scratch.width, scratch.height), screenBgColor);
    writeMask(lcd.masks.ink, ink);
    writeMask(lcd.masks.shadow, shadowMask(ink, INK_SHADOW_SCALE, INK_SHADOW_BLUR));
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
            const el = e.nativeEvent.target as Element | null;
            if (mesh === null || el === null) return;
            e.stopPropagation();
            const { pointerId, pointerType, clientX, clientY } = e.nativeEvent;
            const press = startPress(pointerType, clientX, clientY, (action) => emit(mesh, action));
            // Follow this pointer on the canvas itself: it may leave the key
            // mesh (or the phone) before it lifts.
            const onEvent = (ev: Event) => {
              const pe = ev as PointerEvent;
              if (pe.pointerId !== pointerId) return;
              if (pe.type === "pointermove") return press.move(pe.clientX, pe.clientY);
              if (pe.type === "pointerup") press.up();
              else press.cancel();
              for (const type of POINTER_EVENTS) el.removeEventListener(type, onEvent);
              if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
            };
            for (const type of POINTER_EVENTS) el.addEventListener(type, onEvent);
            el.setPointerCapture(pointerId);
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
