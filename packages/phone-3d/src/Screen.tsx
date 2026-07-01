import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LCD, LCD_Z } from "./layout";
import { BACKLIGHT_COLOR, LCD_GLOW_INTENSITY, SCREEN_DIM_TINT } from "./materials";

export interface ScreenProps {
  screenCanvas: HTMLCanvasElement;
  screenVersion: number;
  backlightOn: boolean;
  bgColor: string;
}

/**
 * The 84×48 LCD, seated at the layout position — no runtime calibration.
 * Pixel-crisp CanvasTexture (NearestFilter, no mipmaps), re-uploaded only when
 * the host bumps `screenVersion`. A surround plane fills the bezel opening in
 * the LCD background color and carries the green backlight glow.
 */
export default function Screen({ screenCanvas, screenVersion, backlightOn, bgColor }: ScreenProps) {
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

  // Re-upload only when the host bumps screenVersion (v1 pipeline, unchanged).
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
    <group position={[LCD.x, LCD.y, 0]}>
      {/* Surround fill + backlight glow behind the pixel plane. */}
      <mesh position={[0, 0, LCD_Z - 0.004]}>
        <planeGeometry args={[LCD.w + 0.06, LCD.h + 0.06]} />
        <meshStandardMaterial
          color={bgColor}
          roughness={0.9}
          metalness={0}
          emissive={BACKLIGHT_COLOR}
          emissiveIntensity={backlightOn ? LCD_GLOW_INTENSITY : 0}
        />
      </mesh>
      {/* The pixels. toneMapped=false keeps the exact LCD palette. */}
      <mesh position={[0, 0, LCD_Z]}>
        <planeGeometry args={[LCD.w, LCD.h]} />
        <meshBasicMaterial
          map={texture}
          toneMapped={false}
          color={backlightOn ? "#ffffff" : SCREEN_DIM_TINT}
        />
      </mesh>
    </group>
  );
}
