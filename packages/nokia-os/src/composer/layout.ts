// The Composer's notation on the LCD (plan 27 K6, Task 0 U): tokens in the small face from x 0,
// separated by one space, wrapped at token boundaries (a token never splits: Task 0's layout
// stills) when a line would pass 83 px; three lines shown, the view scrolled as little as the
// cursor needs. The cursor sits right after the token before it, on that token's line.
import { STOCK_FONTS } from "../resources";
import { formatToken, type ComposerToken } from "./notation";

/** The widest line: 83 px fits, 84 wraps (`layout/edge-83`, `layout/edge-84`). */
export const COMPOSER_LINE_WIDTH = 83;
/** Lines shown at once. */
export const COMPOSER_LINES_SHOWN = 3;

/** Advance width of `text` in the small face. */
export function smallWidth(text: string): number {
  const glyphs = STOCK_FONTS.small.glyphs;
  let width = 0;
  for (const ch of text) {
    const glyph = glyphs.get(ch);
    if (glyph === undefined) throw new Error(`The small face has no "${ch}".`);
    width += glyph.width;
  }
  return width;
}

export interface ComposerLayout {
  /** Every wrapped line. */
  readonly lines: readonly string[];
  /** The first line shown. */
  readonly top: number;
  /** The cursor: its line, and its x (the width of its line's text before it). */
  readonly cursorAt: { readonly line: number; readonly x: number };
}

export function composerLines(
  tokens: readonly ComposerToken[],
  cursor: number,
  previousTop?: number,
): ComposerLayout {
  const lines: string[] = [];
  /** Per token: its line and the width of its line's text up to its end. */
  const ends: { line: number; x: number }[] = [];
  let line = "";
  for (const token of tokens) {
    const text = formatToken(token);
    const joined = line === "" ? text : `${line} ${text}`;
    if (line !== "" && smallWidth(joined) > COMPOSER_LINE_WIDTH) {
      lines.push(line);
      line = text;
    } else line = joined;
    ends.push({ line: lines.length, x: smallWidth(line) });
  }
  lines.push(line);
  const cursorAt = cursor === 0 ? { line: 0, x: 0 } : ends[cursor - 1]!;
  const lowest = Math.max(0, cursorAt.line - (COMPOSER_LINES_SHOWN - 1));
  const top =
    previousTop === undefined ? lowest : Math.min(Math.max(previousTop, lowest), cursorAt.line);
  return { lines, top, cursorAt };
}
