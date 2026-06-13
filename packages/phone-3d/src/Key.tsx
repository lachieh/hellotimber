import { RoundedBox } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import { KEY_PRESS_DEPTH, type KeyLayoutEntry } from "./layout";
import { MATERIALS, type MaterialSpec } from "./materials";
import type { Nokia3310Key } from "./types";

export interface KeyProps {
  entry: KeyLayoutEntry;
  onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
  /** Depress visually without pointer input (Nokia3310Props.pressedKeys). */
  externallyPressed?: boolean;
}

function materialFor(entry: KeyLayoutEntry): MaterialSpec {
  if (entry.shape === "pill") return MATERIALS.navi; // the blue NaviKey
  if (entry.key === "power") return MATERIALS.bezel; // stiff black top button
  return MATERIALS.key;
}

export function Key({ entry, onKey, externallyPressed = false }: KeyProps) {
  const [pointerPressed, setPointerPressed] = useState(false);
  const pressed = pointerPressed || externallyPressed;
  const [x, y, z] = entry.position;
  const position: [number, number, number] = [x, y, pressed ? z - KEY_PRESS_DEPTH : z];

  const release = () => {
    if (pointerPressed) {
      setPointerPressed(false);
      onKey?.(entry.key, "up");
    }
  };
  const handlers = {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setPointerPressed(true);
      onKey?.(entry.key, "down");
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      release();
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      document.body.style.cursor = "auto";
      release(); // dragging off a held key releases it — no stuck keys
    },
  };
  const spec = materialFor(entry);

  if (entry.shape === "pill") {
    // Horizontal capsule (axis X), flattened in z to the entry depth
    const radius = entry.size[1] / 2;
    const length = entry.size[0] - entry.size[1];
    return (
      <mesh
        position={position}
        rotation={[0, 0, Math.PI / 2]}
        scale={[1, 1, entry.size[2] / entry.size[1]]}
        {...handlers}
      >
        <capsuleGeometry args={[radius, length, 8, 16]} />
        <meshStandardMaterial {...spec} />
      </mesh>
    );
  }

  const cornerRadius = Math.min(...entry.size) / 2 - 0.005;
  return (
    <RoundedBox
      args={entry.size}
      radius={cornerRadius}
      smoothness={4}
      position={position}
      {...handlers}
    >
      <meshStandardMaterial {...spec} />
    </RoundedBox>
  );
}
