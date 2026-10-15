/** A single-channel image: one 0–255 coverage value per texel, row-major. */
export interface Mask {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** The ink's drop shadow on the backlit layer below it: its opacity, how far it
 *  falls right and down (in LCD pixels), and the shadow mask's resolution
 *  (texels per LCD pixel) and blur radius (in those texels). */
export const INK_SHADOW_OPACITY = 0.3;
export const INK_SHADOW_OFFSET = 1 / 3;
export const INK_SHADOW_SCALE = 3;
export const INK_SHADOW_BLUR = 1;

/**
 * Which screen pixels are ink: 255 where a pixel lies farther from the
 * background `bg` (`#rrggbb`) than half the distance of the screen's farthest
 * colour (its foreground), 0 elsewhere. Any palette works; a blank screen has
 * no ink.
 */
export function inkMask(
  image: { readonly width: number; readonly height: number; readonly data: ArrayLike<number> },
  bg: string,
): Mask {
  const n = Number.parseInt(bg.slice(1), 16);
  const [br, bgreen, bb] = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const count = image.width * image.height;
  const distance = new Float64Array(count);
  let farthest = 0;
  for (let i = 0; i < count; i++) {
    const dr = image.data[i * 4]! - br;
    const dg = image.data[i * 4 + 1]! - bgreen;
    const db = image.data[i * 4 + 2]! - bb;
    distance[i] = dr * dr + dg * dg + db * db;
    farthest = Math.max(farthest, distance[i]!);
  }
  // Squared distances: half the distance is a quarter of the square.
  const threshold = farthest / 4;
  const data = new Uint8Array(count);
  for (let i = 0; i < count; i++) data[i] = farthest > 0 && distance[i]! > threshold ? 255 : 0;
  return { width: image.width, height: image.height, data };
}

/**
 * The ink's shadow: the mask upscaled `scale`× (nearest) and box-blurred with
 * a `(2·blur + 1)²` window; texels beyond the edge count as clear.
 */
export function shadowMask(mask: Mask, scale: number, blur: number): Mask {
  const width = mask.width * scale;
  const height = mask.height * scale;
  const big = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      big[y * width + x] = mask.data[Math.floor(y / scale) * mask.width + Math.floor(x / scale)]!;
    }
  }
  // Separable box sum: rows, then columns.
  const rows = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = Math.max(0, x - blur); k <= Math.min(width - 1, x + blur); k++) {
        sum += big[y * width + k]!;
      }
      rows[y * width + x] = sum;
    }
  }
  const window = (2 * blur + 1) ** 2;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = Math.max(0, y - blur); k <= Math.min(height - 1, y + blur); k++) {
        sum += rows[k * width + x]!;
      }
      data[y * width + x] = Math.round(sum / window);
    }
  }
  return { width, height, data };
}
