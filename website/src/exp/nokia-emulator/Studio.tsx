import { useFrame } from "@react-three/fiber";
import { PhoneStage, type Nokia3310Key } from "@hellotimber/phone-3d";
import { Nokia3310Sketch } from "@hellotimber/phone-3d/sketch";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { StageDrift } from "@hellotimber/phone-3d";
import { attachKeyboard } from "../../phone/keyboard";
import { REVEAL_MS, revealAt, WIPE_MS } from "../../phone/reveal";
import type { PhoneRuntime } from "../../phone/runtime";
import type { Emulator } from "./emulator";
import {
  DRAWING,
  fitForScale,
  floatAt,
  CAMERA,
  keyLightPosition,
  rimLightPosition,
  STILL,
  turned,
  type StageSettings,
} from "./stage-settings";
import type { BacklightMode } from "./world";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Key from the stage's bearing, a cool rim from behind, a warm bounce off the floor. */
function StudioLights({ angle, intensity }: { angle: number; intensity: number }) {
  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={keyLightPosition(angle)} intensity={intensity} color="#fff6ea" />
      <directionalLight
        position={rimLightPosition(angle)}
        intensity={0.9 + intensity * 0.25}
        color="#cfe3ff"
      />
      <hemisphereLight args={["#1c2026", "#5a4a3a", 0.35]} />
      <directionalLight position={[0, -8, 4]} intensity={0.22} color="#ffd9b0" />
    </>
  );
}

/** How far the view and float have eased in: 0 until the wipe is over, 1 once the reveal is. */
function settledShare(reveal: number): number {
  const t = Math.min(1, Math.max(0, (reveal - WIPE_MS) / (REVEAL_MS - WIPE_MS)));
  return t * t * (3 - 2 * t);
}

/** The phone's floor, just under its lowest float (the model is 10 units tall, centred). */
const FLOOR_Y = -5.7;
/** The phone's lowest point at rest. */
const PHONE_BOTTOM = -5;

/** A soft elliptical spot of `rgb`: dense at the centre, gone at the edge. */
function spotTexture(rgb: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(${rgb},1)`);
  gradient.addColorStop(0.35, `rgba(${rgb},0.7)`);
  gradient.addColorStop(0.7, `rgba(${rgb},0.18)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/**
 * The phone's contact shadow on the floor: under the phone's footprint, darker and tighter the
 * nearer it floats to the floor.
 */
function FloorShadow({ drift }: { drift: () => StageDrift }) {
  const texture = useMemo(() => spotTexture("0,0,0"), []);
  const pool = useMemo(() => spotTexture("255,244,230"), []);
  useEffect(
    () => () => {
      texture.dispose();
      pool.dispose();
    },
    [texture, pool],
  );
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const gap = PHONE_BOTTOM + drift().y - FLOOR_Y;
    const spread = 1 + gap * 0.35;
    mesh.current?.scale.set(spread, spread, 1);
    if (material.current) material.current.opacity = Math.min(1, 0.9 / spread);
  });
  return (
    <>
      {/* The key light's pool on the floor, which the shadow sits in. */}
      <mesh position={[0, FLOOR_Y - 0.01, 0]} rotation-x={-Math.PI / 2} renderOrder={-2}>
        <planeGeometry args={[26, 12]} />
        <meshBasicMaterial
          map={pool}
          transparent
          opacity={0.07}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={mesh} position={[0, FLOOR_Y, 0.2]} rotation-x={-Math.PI / 2} renderOrder={-1}>
        <planeGeometry args={[7.5, 3.4]} />
        <meshBasicMaterial
          ref={material}
          map={texture}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

/**
 * The dark studio: the 3D phone over a cyclorama, lit by the Stage tab's rig and floating over its
 * contact shadow. Keyboard and on-model presses go through the emulator (and so into its log).
 */
export default function Studio({
  emulator,
  runtime,
  stage,
  backlight,
  onFormStart,
}: {
  emulator: Emulator;
  runtime: PhoneRuntime;
  stage: StageSettings;
  backlight: BacklightMode;
  onFormStart: () => void;
}) {
  const { renderer, lights } = runtime;
  const [version, setVersion] = useState(renderer.version);
  const [leds, setLeds] = useState({ display: false, keypad: false });
  useEffect(() => {
    let raf = requestAnimationFrame(function loop() {
      setVersion(renderer.version);
      setLeds((prev) => {
        const { display, keypad } = lights;
        return prev.display === display && prev.keypad === keypad ? prev : { display, keypad };
      });
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, [renderer, lights]);

  const [pressedKeys, setPressedKeys] = useState<ReadonlySet<Nokia3310Key>>(new Set());
  useEffect(
    () =>
      attachKeyboard((key, action) => {
        setPressedKeys((prev) => {
          const next = new Set(prev);
          if (action === "down") next.add(key);
          else next.delete(key);
          return next;
        });
        emulator.input(key, action);
      }),
    [emulator],
  );

  // The stage reads these every frame: through a ref, so the callbacks stay put.
  const settings = useRef(stage);
  settings.current = stage;
  const pose = useCallback(() => revealAt(settings.current.reveal).pose, []);
  const deviceTilt = useCallback(() => settings.current.tilt, []);
  const motion = useRef(!reducedMotion());
  // While the drawing wipes away it lines up with the phone only head on and still; the camera's
  // height, the phone's turn and its float ease in over the rest of the reveal.
  const orbit = useCallback(() => {
    const k = settledShare(settings.current.reveal);
    return { yaw: CAMERA.yaw * k, pitch: CAMERA.pitch * k };
  }, []);
  const drift = useCallback(() => {
    const now = settings.current;
    const k = settledShare(now.reveal);
    const float = now.float && motion.current ? floatAt(performance.now()) : STILL;
    const pose = turned(now, float);
    return { y: pose.y * k, tiltX: pose.tiltX * k, tiltY: pose.tiltY * k };
  }, []);

  const fit = fitForScale(stage.scale);
  const display = backlight === "auto" ? leds.display : backlight === "on";
  const keypad = backlight === "auto" ? leds.keypad : backlight === "on";
  const wipe = revealAt(stage.reveal).wipe;

  return (
    <div className="emu-studio">
      <PhoneStage
        className="emu-canvas"
        fit={fit}
        form
        onFormStart={onFormStart}
        pose={pose}
        orbit={orbit}
        drift={drift}
        deviceTilt={deviceTilt}
        lcdShadow={stage.lcdShadow}
        lighting={<StudioLights angle={stage.lightAngle} intensity={stage.lightIntensity} />}
        scene={<FloorShadow drift={drift} />}
        screenCanvas={renderer.canvas}
        screenVersion={version}
        backlightOn={display}
        keypadLightOn={keypad}
        pressedKeys={pressedKeys}
        onKey={(key, action) => emulator.input(key, action)}
      />
      {wipe < 1 && (
        <Nokia3310Sketch className="emu-sketch" fit={fit} progress={1} wipe={wipe} {...DRAWING} />
      )}
    </div>
  );
}
