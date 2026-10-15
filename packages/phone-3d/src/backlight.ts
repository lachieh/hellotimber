import { SCREEN_DIM_TINT } from "./materials";

/** The 3310's display backlight: three LEDs in a row just above the LCD's top
 *  edge, evenly spaced (fractions of the LCD width). */
export const LED_X = [1 / 6, 1 / 2, 5 / 6] as const;

/** The dimmest lit texel (sRGB-encoded fraction of full light): the bottom of
 *  the LCD, farthest from the LEDs, stays readable. */
export const LIT_FLOOR = 0.7;

// Light model, in fractions of the map's width (so square texels keep the
// shape at any resolution). Each LED is a soft hotspot a little above the top
// edge, shining down into the light guide (so it reaches farther down than
// across); the guide spreads the rest across the width and it fades downward.
// Both parts fall with distance from the top, so every column darkens downward.
const LED_DEPTH = 3 / 84; // how far above the top edge the LEDs sit
const HOTSPOT_RADIUS = 6 / 84; // half-brightness radius of one LED's hotspot, across
const HOTSPOT_REACH = 3; // the hotspot's downward stretch against its width
const GUIDE_FADE = 45 / 84; // the light guide's 1/e fade length downward
const HOTSPOT_SHARE = 0.35; // the hotspots' share of the light, against the guide's

/**
 * The lit LCD's lightmap: `width × height` RGBA texels, row 0 at the top edge,
 * white light from 255 (the brightest hotspot) down to `LIT_FLOOR` (the bottom
 * corners). The values are sRGB-encoded.
 */
export function backlightLightmap(width: number, height: number): Uint8Array {
  const depth = LED_DEPTH * width;
  const radius = HOTSPOT_RADIUS * width;
  const fade = GUIDE_FADE * width;
  const light = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    const dy = y + 0.5 + depth;
    const guide = Math.exp(-dy / fade);
    const reach = dy / HOTSPOT_REACH;
    for (let x = 0; x < width; x++) {
      let hotspots = 0;
      for (const fx of LED_X) {
        const dx = x + 0.5 - fx * width;
        hotspots += 1 / (1 + (dx * dx + reach * reach) / (radius * radius));
      }
      light[y * width + x] = HOTSPOT_SHARE * hotspots + (1 - HOTSPOT_SHARE) * guide;
    }
  }
  let min = Infinity;
  let max = -Infinity;
  for (const v of light) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const data = new Uint8Array(width * height * 4);
  light.forEach((v, i) => {
    const level = Math.round(255 * (LIT_FLOOR + ((1 - LIT_FLOOR) * (v - min)) / (max - min)));
    data.set([level, level, level, 255], i * 4);
  });
  return data;
}

/** The unlit LCD's lightmap: one texel at the unlit level, the daylight that
 *  reaches the LCD through its green polariser (`SCREEN_DIM_TINT`). */
export function unlitLightmap(): Uint8Array {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(SCREEN_DIM_TINT.slice(i, i + 2), 16));
  return new Uint8Array([r!, g!, b!, 255]);
}
