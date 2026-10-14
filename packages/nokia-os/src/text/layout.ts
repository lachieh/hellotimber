// The stock editor's text layout (plan 18 D2): word wrap with the firmware's font advances, and
// the window of lines that follows the cursor. Pure.
//
// Measured on the wrap goldens (`text/wrap-words`, `-long-word`, `-spaces`, `text/counter`,
// `welcome/face`): a line's glyph cells run from x 1 to x 83 (83 columns); a word moves to the
// next line unless it ends two columns short of that (81 columns of `gjmp tadgjmptw` stay,
// 82 of `ptw adgjmptwad` move, `text/counter` 166), a word longer than a line breaks where it
// overflows the whole line (82 large columns of `Adgjmptwadgj` stay, `welcome/face` 13), and
// spaces stay at the end of their line however far they overflow it. A pending character takes
// the width of the widest character of its key's cycles (both cases), so cycling never re-wraps
// (`text/wrap-words` 15 moves `gj`, 80 columns, because `K` takes 7). These are the rules that fit
// every capture; the text re-wraps when the character commits (`welcome/face` 13). The cursor stands on the blank column
// after the character before it (x = the width before it, from the line's left edge at x 1);
// when spaces push the end of the text past x 83, the cursor there starts a new, empty line
// (`text/wrap-spaces` 06).
import { STOCK_FONTS, type StockFontName } from "../resources";
import { isTextKey, MULTITAP_KEYS } from "./keys";
import type { TextState } from "./multitap";

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

/** The editor's line width in columns (x 1..83 from the text's left edge at x 1). */
export const EDITOR_LINE_WIDTH = 83;

/** A word moves to the next line unless it ends this many columns short of the line's end. */
const WORD_MARGIN = 2;

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
  const key = state.pending?.key;
  if (key === undefined || !isTextKey(key)) return undefined;
  const chars = [...MULTITAP_KEYS[key].upper, ...MULTITAP_KEYS[key].lower];
  return { at: state.cursor - 1, width: Math.max(...chars.map((char) => advance(font, char))) };
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
    if (x > 0 && x + word > width - WORD_MARGIN) breakAt(i);
    if (x + word <= width - WORD_MARGIN) {
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
