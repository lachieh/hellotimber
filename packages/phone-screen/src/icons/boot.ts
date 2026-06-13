import { bitmapFromArt } from "../bitmap";
import type { Bitmap } from "../bitmap";
import { Framebuffer } from "../framebuffer";

/** Left hand reaching right (16×14). */
const HAND_LEFT = bitmapFromArt([
  "................",
  "........####....",
  ".......######...",
  "......########..",
  "......########..",
  "##############..",
  "################",
  "################",
  "##############..",
  "......########..",
  "......########..",
  ".......######...",
  "........####....",
  "................",
]);

/** Right hand reaching left (16×14). */
const HAND_RIGHT = bitmapFromArt([
  "................",
  "....####........",
  "...######.......",
  "..########......",
  "..########......",
  "..##############",
  "################",
  "################",
  "..##############",
  "..########......",
  "..########......",
  "...######.......",
  "....####........",
  "................",
]);

/** [leftHandX, rightHandX] per frame — the hands slide together and interlock. */
const FRAME_POSITIONS: readonly [number, number][] = [
  [6, 62],
  [16, 52],
  [24, 44],
  [30, 38],
];

function composeFrame(leftX: number, rightX: number): Bitmap {
  const fb = new Framebuffer(84, 30);
  fb.blitBitmap(HAND_LEFT, leftX, 8);
  fb.blitBitmap(HAND_RIGHT, rightX, 8);
  return { width: fb.width, height: fb.height, pixels: fb.pixels };
}

/** The 4 'connecting hands' boot frames, 84×30 each (frame 3 = clasped). */
export const HANDS_FRAMES: readonly Bitmap[] = FRAME_POSITIONS.map(([l, r]) => composeFrame(l, r));
