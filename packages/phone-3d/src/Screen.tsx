import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCREEN_DIM_TINT } from "./materials";

export interface ScreenProps {
  screenCanvas: HTMLCanvasElement;
  screenVersion: number;
  backlightOn?: boolean;
}

/** 2.8 × 1.6 screen plane at [0, 2.0, 1.2] — 0.05 proud of the bezel front
 *  (z-offset avoids z-fighting, integration-notes §5). */
export function Screen({ screenCanvas, screenVersion, backlightOn = true }: ScreenProps) {
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(screenCanvas);
    t.colorSpace = THREE.SRGBColorSpace; // canvas 2D pixels are sRGB
    t.magFilter = THREE.NearestFilter; // crisp pixels when upscaled
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false; // 84×48 NPOT + nearest: mips wrong and wasteful
    // flipY stays true (default) — matches planeGeometry 0..1 UVs
    return t;
  }, [screenCanvas]);

  // Dispose the GPU texture on unmount / canvas swap
  useEffect(() => () => texture.dispose(), [texture]);

  // Re-upload only when dirty: compare version counters inside useFrame
  const versionRef = useRef(screenVersion);
  versionRef.current = screenVersion;
  const uploadedRef = useRef(-1);
  useFrame(() => {
    if (uploadedRef.current !== versionRef.current) {
      texture.needsUpdate = true;
      uploadedRef.current = versionRef.current;
    }
  });

  return (
    <mesh position={[0, 2.0, 1.2]}>
      <planeGeometry args={[2.8, 1.6]} />
      {/* Unlit is right for an emissive LCD; toneMapped={false} keeps the green true */}
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        color={backlightOn ? "#ffffff" : SCREEN_DIM_TINT}
      />
    </mesh>
  );
}
