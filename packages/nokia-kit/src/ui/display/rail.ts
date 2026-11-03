import type { Framebuffer } from "@hellotimber/phone-screen";

const RAIL_X = 81;
const RAIL_TOP = 7;
const RAIL_BOTTOM = 36;
/** The bump spans 7 rows; its top travels 23 rows (7..30). */
const BUMP_TRAVEL = RAIL_BOTTOM - RAIL_TOP - 6;

/** Top row of the bump for item `index` of `count` visible items: 7 + floor(i*23/(n-1)). */
export function railBumpTop(index: number, count: number): number {
  return RAIL_TOP + (count <= 1 ? 0 : Math.floor((index * BUMP_TRAVEL) / (count - 1)));
}

/**
 * The position rail on carousel and submenu screens: a 1-pixel track at x 81, y 7..36, and a
 * bump that steps out to x 83 for five rows, joined by single pixels at x 82 above and below.
 * The track is absent beside the bump.
 */
export function paintRail(fb: Framebuffer, index: number, count: number): void {
  const top = railBumpTop(index, count);
  fb.fillRect(RAIL_X, RAIL_TOP, 1, RAIL_BOTTOM - RAIL_TOP + 1, 1);
  fb.fillRect(RAIL_X, top + 1, 1, 5, 0);
  fb.setPixel(RAIL_X + 1, top, 1);
  fb.fillRect(RAIL_X + 2, top + 1, 1, 5, 1);
  fb.setPixel(RAIL_X + 1, top + 6, 1);
}
