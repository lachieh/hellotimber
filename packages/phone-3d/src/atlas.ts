import * as THREE from "three";
import { createLegendAtlas, LEGEND_CELLS } from "./legends";
import { keyGlowFalloff } from "./materials";
import type { PrintedKey } from "./legends";

/**
 * three-side bindings for the legend atlas: ONE shared CanvasTexture and
 * per-decal plane geometries whose UVs address a single atlas cell (so every
 * legend/decal shares the same GPU texture instead of cloning it).
 * Lazy singletons — nothing is constructed at import time (SSR-safe).
 */

let texture: THREE.CanvasTexture | null = null;

export function legendTexture(): THREE.CanvasTexture {
  if (texture === null) {
    texture = new THREE.CanvasTexture(createLegendAtlas());
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
  }
  return texture;
}

let glow: THREE.DataTexture | null = null;

/** The keypad light across one key (keyGlowFalloff), for a decal's emissive map. It's addressed
 *  by the decal's second UV set, which spans the whole decal (cellPlaneGeometry). */
export function keyGlowTexture(): THREE.DataTexture {
  if (glow === null) {
    const [w, h] = [64, 32];
    const data = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const level = Math.round(
          255 * keyGlowFalloff(((i + 0.5) / w) * 2 - 1, ((j + 0.5) / h) * 2 - 1),
        );
        data.set([level, level, level, 255], (j * w + i) * 4);
      }
    }
    glow = new THREE.DataTexture(data, w, h);
    glow.channel = 1;
    glow.magFilter = THREE.LinearFilter;
    glow.minFilter = THREE.LinearFilter;
    glow.needsUpdate = true;
  }
  return glow;
}

/** A w×h plane whose UVs cover the named atlas cell **aspect-correctly**: the
 *  full cell width maps to the plane width and the v-range is the centered
 *  horizontal band matching the plane's aspect, so texels stay square (the
 *  atlas itself is square). Painters must keep art inside that band. Its second UV set (`uv1`)
 *  spans the plane 0 to 1, for keyGlowTexture. */
export function cellPlaneGeometry(w: number, h: number, key: PrintedKey): THREE.PlaneGeometry {
  const cell = LEGEND_CELLS[key];
  const bandH = Math.min(cell.h, cell.w * (h / w));
  const v0 = cell.v + (cell.h - bandH) / 2;
  const geometry = new THREE.PlaneGeometry(w, h);
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  geometry.setAttribute("uv1", uv.clone());
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, cell.u + uv.getX(i) * cell.w, v0 + uv.getY(i) * bandH);
  }
  uv.needsUpdate = true;
  return geometry;
}
