import { bitmapFromArt } from "../bitmap";
import type { Bitmap } from "../bitmap";

/**
 * Variable-width pixel font supplied by a consumer.
 * Each glyph's bitmap width IS its advance (right-side bearing baked in),
 * so rendering is simply: blit, move right by width, repeat.
 */
export interface PixelFont {
  /** Cell height in rows. */
  readonly glyphHeight: number;
  /** Advance used for characters missing from the map. */
  readonly nominalAdvance: number;
  /** Optional glyph used for unknown characters; absent means unknown input is rejected. */
  readonly fallbackGlyph?: string;
  readonly glyphs: ReadonlyMap<string, Bitmap>;
}

export function createPixelFont(
  art: Record<string, readonly string[]>,
  glyphHeight: number,
  nominalAdvance: number,
  fallbackGlyph?: string,
): PixelFont {
  const glyphs = new Map<string, Bitmap>();
  for (const [ch, rows] of Object.entries(art)) {
    const bitmap = bitmapFromArt(rows);
    if (bitmap.height !== glyphHeight) {
      throw new Error(`glyph '${ch}' is ${bitmap.height} rows, expected ${glyphHeight}`);
    }
    glyphs.set(ch, bitmap);
  }
  if (fallbackGlyph !== undefined && !glyphs.has(fallbackGlyph)) {
    throw new Error(`fallback glyph '${fallbackGlyph}' is not defined`);
  }
  return { glyphHeight, nominalAdvance, fallbackGlyph, glyphs };
}

/** Advance of a single character (nominal for unmapped characters). */
export function charAdvance(font: PixelFont, ch: string): number {
  const glyph =
    font.glyphs.get(ch) ??
    (font.fallbackGlyph === undefined ? undefined : font.glyphs.get(font.fallbackGlyph));
  if (glyph === undefined) throw new Error(`unknown glyph '${ch}'`);
  return glyph.width;
}

/** Pixel width of a rendered string (advance is baked into each glyph). */
export function textWidth(font: PixelFont, text: string, scale = 1): number {
  let w = 0;
  for (const ch of text) w += charAdvance(font, ch);
  return w * scale;
}
