import { bitmapFromArt } from "../bitmap";
import type { Bitmap } from "../bitmap";
import { GLYPHS } from "./glyphs";

export interface PixelFont {
  readonly glyphWidth: number;
  readonly glyphHeight: number;
  /** Blank columns between glyphs; advance = glyphWidth + gap. */
  readonly gap: number;
  readonly glyphs: ReadonlyMap<string, Bitmap>;
}

function compileFont(
  art: Record<string, readonly string[]>,
  glyphWidth: number,
  glyphHeight: number,
  gap: number,
): PixelFont {
  const glyphs = new Map<string, Bitmap>();
  for (const [ch, rows] of Object.entries(art)) {
    const bitmap = bitmapFromArt(rows);
    if (bitmap.width !== glyphWidth || bitmap.height !== glyphHeight) {
      throw new Error(
        `glyph '${ch}' is ${bitmap.width}x${bitmap.height}, expected ${glyphWidth}x${glyphHeight}`,
      );
    }
    glyphs.set(ch, bitmap);
  }
  return { glyphWidth, glyphHeight, gap, glyphs };
}

/** The body font: 5×7 glyphs, 1px gap → 6px advance, 14 chars per 84px line. */
export const FONT: PixelFont = compileFont(GLYPHS, 5, 7, 1);

/** Pixel width of a rendered string (no trailing gap). */
export function textWidth(font: PixelFont, text: string, scale = 1): number {
  const len = [...text].length;
  if (len === 0) return 0;
  return (len * (font.glyphWidth + font.gap) - font.gap) * scale;
}
