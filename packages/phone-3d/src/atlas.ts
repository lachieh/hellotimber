import * as THREE from "three";
import { createLegendAtlas, LEGEND_CELLS } from "./legends";

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

/** A w×h plane whose UVs cover the named atlas cell **aspect-correctly**: the
 *  full cell width maps to the plane width and the v-range is the centered
 *  horizontal band matching the plane's aspect, so texels stay square (the
 *  atlas itself is square). Painters must keep art inside that band. */
export function cellPlaneGeometry(w: number, h: number, cellName: string): THREE.PlaneGeometry {
  const cell = LEGEND_CELLS[cellName];
  if (cell === undefined) throw new Error(`unknown atlas cell: ${cellName}`);
  const bandH = Math.min(cell.h, cell.w * (h / w));
  const v0 = cell.v + (cell.h - bandH) / 2;
  const geometry = new THREE.PlaneGeometry(w, h);
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, cell.u + uv.getX(i) * cell.w, v0 + uv.getY(i) * bandH);
  }
  uv.needsUpdate = true;
  return geometry;
}
