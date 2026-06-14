import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { ReactNode } from "react";
import type { Group } from "three";
import { Nokia3310 } from "./Nokia3310";
import type { Nokia3310Props } from "./types";

/** Gentle idle sway (sine) + pointer-follow tilt, eased toward the target.
 *  Honors prefers-reduced-motion: the rig holds still for those users
 *  (plan 06 deviation 6 — the single sanctioned phone-3d edit). */
const prefersReducedMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function SwayRig({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (prefersReducedMotion) return; // hold still — idle sway + tilt both off
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const targetY = Math.sin(t * 0.5) * 0.06 + state.pointer.x * 0.18;
    const targetX = Math.sin(t * 0.7) * 0.02 - state.pointer.y * 0.12;
    g.rotation.y += (targetY - g.rotation.y) * 0.05;
    g.rotation.x += (targetX - g.rotation.x) * 0.05;
  });
  return <group ref={group}>{children}</group>;
}

/** Convenience scene: Canvas + lighting + resize + subtle idle motion (VISION contract).
 *  R3F's Canvas tracks its container size, so resize works out of the box. */
export function PhoneStage({ className, ...props }: Nokia3310Props & { className?: string }) {
  return (
    <Canvas className={className} dpr={[1, 2]} camera={{ position: [0, 0, 15], fov: 42 }}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 6, 8]} intensity={1.6} />
      <directionalLight position={[-5, -2, 4]} intensity={0.45} />
      <SwayRig>
        <Nokia3310 {...props} />
      </SwayRig>
    </Canvas>
  );
}
