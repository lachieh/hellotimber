// Drawing helpers over a GameScreen: text in any GameFont, and numbers in the game digits.

import type { GameFont, GameSdk } from "./contract";
import { GAME_DIGITS } from "./digits";
import { encodeBase64 } from "./base64";
import type { GameScreen } from "./screen";

function glyphsOf(font: GameFont, text: string): (readonly string[])[] {
  const glyphs: (readonly string[])[] = [];
  for (const character of text) {
    if (!Object.prototype.hasOwnProperty.call(font.glyphs, character)) {
      throw new Error(`The font has no glyph for ${JSON.stringify(character)}`);
    }
    glyphs.push(font.glyphs[character]!);
  }
  return glyphs;
}

/** A glyph's advance is the length of its rows. */
function advance(glyph: readonly string[]): number {
  return glyph[0]?.length ?? 0;
}

/** The width of `text` in pixels. Throws on a glyph the font lacks, naming it. */
export function textWidth(font: GameFont, text: string): number {
  return glyphsOf(font, text).reduce((width, glyph) => width + advance(glyph), 0);
}

function paint(
  screen: GameScreen,
  glyphs: readonly (readonly string[])[],
  x: number,
  y: number,
  scale: number,
  gap: number,
  ink: 0 | 1,
): void {
  let left = x;
  for (const glyph of glyphs) {
    for (let row = 0; row < glyph.length; row++) {
      const cells = glyph[row]!;
      for (let column = 0; column < cells.length; column++) {
        if (cells[column] !== "#") continue;
        screen.fill(left + column * scale, y + row * scale, scale, scale, ink);
      }
    }
    left += advance(glyph) * scale + gap;
  }
}

/**
 * Draws `text` with its top-left corner at (x, y) and returns its width. Only the glyphs' ink is
 * painted, in `ink` (0 draws paper onto a filled box). Throws on a missing glyph before drawing.
 */
export function drawText(
  screen: GameScreen,
  font: GameFont,
  text: string,
  x: number,
  y: number,
  ink: 0 | 1 = 1,
): number {
  const glyphs = glyphsOf(font, text);
  paint(screen, glyphs, x, y, 1, 0, ink);
  return glyphs.reduce((width, glyph) => width + advance(glyph), 0);
}

/**
 * Draws an integer in `font` (default GAME_DIGITS) and returns its width. `scale` turns each font
 * pixel into a square of that side; `gap` is the pixels between digits (default 0: the game
 * digits carry their own blank column). With `align: "right"`, `x` is the exclusive right edge.
 */
export const drawNumber: GameSdk["drawNumber"] = (screen, value, x, y, options = {}) => {
  const { font = GAME_DIGITS, scale = 1, gap = 0, align = "left", ink = 1 } = options;
  if (!Number.isInteger(value)) throw new Error(`drawNumber draws an integer, not ${value}`);
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error(`drawNumber's scale is a positive integer, not ${scale}`);
  }
  const glyphs = glyphsOf(font, String(value));
  const width =
    glyphs.reduce((sum, glyph) => sum + advance(glyph) * scale, 0) +
    Math.max(0, glyphs.length - 1) * gap;
  paint(screen, glyphs, align === "right" ? x - width : x, y, scale, gap, ink);
  return width;
};

/** Base64 of the packed frame: the form of a manifest's splash frames. */
export function encodeFrame(screen: GameScreen): string {
  return encodeBase64(screen.pack());
}
