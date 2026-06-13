/**
 * Same shape and encoding as @hellotimber/phone-core's Bitmap: monochrome,
 * row-major, ONE BYTE per pixel (pixels.length === width * height);
 * 0 = clear, 1 = set. Declared locally so drawing code never needs a
 * phone-core import; phone-core's Bitmap is structurally assignable.
 */
export interface Bitmap {
  width: number;
  height: number;
  pixels: Uint8Array;
}

/** Parse string-art rows ('#' = set, '.' = clear) into a Bitmap. */
export function bitmapFromArt(rows: readonly string[]): Bitmap {
  if (rows.length === 0) throw new Error("bitmapFromArt: no rows");
  const width = rows[0]!.length;
  const pixels = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`bitmapFromArt: row ${y} is ${row.length} chars, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      if (ch === "#") pixels[y * width + x] = 1;
      else if (ch !== ".") throw new Error(`bitmapFromArt: invalid char '${ch}' at ${x},${y}`);
    }
  });
  return { width, height: rows.length, pixels };
}
