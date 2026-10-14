// The stock editor's text layout (plan 18 D2): word wrap with the firmware's font advances, and
// the window of lines that follows the cursor. Pure.
//
// Measured on the wrap goldens (`text/wrap-words`, `-long-word`, `-spaces`, `text/counter`,
// `welcome/face`): a line holds 81 columns of glyph cells; a word that does not fit on the rest
// of a line moves to the next one, a word longer than a line breaks where it overflows, and
// spaces stay at the end of their line however far they overflow it. A pending character takes
// the width of the widest character of its key's cycle (so cycling never re-wraps): this is the
// one rule that fits every capture (`text/wrap-words` 15 wraps `gj` at 80 columns, while 81
// columns of `tadgjmptw` fit), unverified beyond them. The cursor stands on the blank column
// after the character before it (x = the width before it, from the line's left edge at x 1);
// when spaces push the end of the text past x 83, the cursor there starts a new, empty line
// (`text/wrap-spaces` 06).
import { STOCK_FONTS, type StockFontName } from "../resources";
import { pendingCycle, type TextState } from "./multitap";

/** One line of wrapped text: the characters `start`..`end - 1` (trailing spaces included). */
export interface TextLine {
  readonly start: number;
  readonly end: number;
}

/** A pending character's place in the text and the width it takes while it cycles. */
export interface PendingSlot {
  readonly at: number;
  readonly width: number;
}

/** The editor's line width in columns (x 1..81 from the text's left edge at x 1). */
export const EDITOR_LINE_WIDTH = 81;

/** The last column the cursor can stand on (the LCD's last). */
const LAST_CURSOR_X = 83;

/** A character's advance in `font`; one the font lacks takes no room. */
export function advance(font: StockFontName, char: string): number {
  return STOCK_FONTS[font].glyphs.get(char)?.width ?? 0;
}

/** The width of `text` in `font`. */
export function textWidth(font: StockFontName, text: string): number {
  let width = 0;
  for (const char of text) width += advance(font, char);
  return width;
}

/** The slot of `state`'s pending character: the widest character of its key's cycle. */
export function pendingSlot(state: TextState, font: StockFontName): PendingSlot | undefined {
  const cycle = pendingCycle(state);
  if (cycle === undefined) return undefined;
  return { at: state.cursor - 1, width: Math.max(...cycle.map((char) => advance(font, char))) };
}

/** `text` wrapped into lines of `width` columns (see the header for the rules). */
export function wrapText(
  text: string,
  font: StockFontName,
  width: number,
  pending?: PendingSlot,
): readonly TextLine[] {
  const chars = Array.from(text);
  const widthOf = (i: number): number =>
    pending !== undefined && pending.at === i ? pending.width : advance(font, chars[i]!);
  const lines: TextLine[] = [];
  let start = 0;
  let x = 0;
  const breakAt = (i: number): void => {
    lines.push({ start, end: i });
    start = i;
    x = 0;
  };
  let i = 0;
  while (i < chars.length) {
    if (chars[i] === " ") {
      x += widthOf(i);
      i++;
      continue;
    }
    let end = i;
    let word = 0;
    while (end < chars.length && chars[end] !== " ") word += widthOf(end++);
    if (x > 0 && x + word > width) breakAt(i);
    if (x + word <= width) {
      x += word;
      i = end;
      continue;
    }
    for (; i < end; i++) {
      if (x > 0 && x + widthOf(i) > width) breakAt(i);
      x += widthOf(i);
    }
  }
  lines.push({ start, end: chars.length });
  // Spaces past the last cursor column: the cursor at the end goes to a new line.
  if (x > LAST_CURSOR_X) lines.push({ start: chars.length, end: chars.length });
  return lines;
}

/**
 * The line the cursor is on: the one it is inside, or the next one at a line break; the end of
 * the text is on the last line.
 */
export function cursorLine(lines: readonly TextLine[], cursor: number): number {
  const index = lines.findIndex((line) => cursor >= line.start && cursor < line.end);
  return index >= 0 ? index : lines.length - 1;
}

/**
 * The first line shown in a window of `rows` lines: the previous one while the cursor's line is
 * in view, else the one that brings it to the nearest edge (`text/counter` 151, `text/wrap-words`
 * 44: typing on below the window scrolls it by one line).
 */
export function viewTop(
  lines: readonly TextLine[],
  cursor: number,
  rows: number,
  previousTop = 0,
): number {
  const line = cursorLine(lines, cursor);
  let top = Math.min(previousTop, Math.max(0, lines.length - rows));
  if (line < top) top = line;
  if (line >= top + rows) top = line - rows + 1;
  return top;
}
