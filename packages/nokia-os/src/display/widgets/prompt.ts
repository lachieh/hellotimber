import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../../resources";
import { SOFTKEY_TOP } from "../standby";

/** Label lines in the small face from x 0, 9 rows apart from top 7. */
const LABEL_TOP = 7;
const LINE_PITCH = 9;
/** The entry box's bottom edge; values sit on it, the box spans x 0..83. */
const BOX_BOTTOM = 36;
/** Right-aligned values end here (their last cell's blank column is x 82). */
const VALUE_END = 83;
/** Text entry starts 2 columns in, 2 rows below the box's top edge (Rename's `Silent`). */
const TEXT_INSET = 2;
/** A text entry's cursor spans 15 rows from just below the box's top edge. */
const TEXT_CURSOR_ROWS = 15;
/**
 * A code entry's mask: one `*` per digit in the small face from x 0, top 29 (plan 15 Task 0
 * A2/A5: `probe/code-keys-6-4`, `boot/security-gate-keys`).
 */
const MASK_TOP = 29;

/**
 * Where an input prompt's entry is (plan 14 D11: first screen only):
 * - `value`: the value in the large face right below the label, from x 0 (Speed dials `(empty)`);
 * - `box`: a frame from below the label to y 36 holding the value: `text` entry (left, large,
 *   the cursor after it), or a number or time right-aligned on the frame's bottom, with the
 *   cursor at its `end`, at its `start`, or `none` (Search does not blink);
 * - `mask`: a code entry, one `*` per digit typed (plan 15 D7).
 */
export type PromptEntry =
  | { readonly kind: "value"; readonly text: string }
  | { readonly kind: "mask"; readonly digits: number }
  /**
   * Plan 18: an editable text in the box, large from x 2 (Routing address, Name); the cursor
   * before character `cursor`, absent while a character is pending.
   */
  | { readonly kind: "text"; readonly text: string; readonly cursor?: number }
  /**
   * Plan 18: an editable number, right-aligned in the box: large while it fits, else small rows
   * of up to 78 columns filled from its end (`text/number`); the cursor before `cursor`.
   */
  | { readonly kind: "number"; readonly text: string; readonly cursor?: number }
  | {
      readonly kind: "box";
      readonly text: string;
      readonly font: "large" | "small";
      readonly cursor: "text" | "end" | "start" | "none";
    };

export interface PromptModel {
  readonly kind: "prompt";
  /** Mode icons by sprite id (`prompt/pen`, `prompt/abc`, ...), at their captured positions. */
  readonly icons: readonly string[];
  /** Characters left, top right in the digits face (Add name: `16`). */
  readonly counter?: string;
  readonly label: readonly string[];
  /** Absent: the label only (the PIN, PIN2 and barring prompts, plan 14 D11). */
  readonly entry?: PromptEntry;
  /** The blinking cursor's step: shown or hidden. */
  readonly cursor: boolean;
  readonly softkey: string;
}

/** A number in large fits the box while it is this wide (ten digits, `text/number` len-10). */
const NUMBER_LARGE_WIDTH = 80;
/** A row of a long number holds this many columns (13 digits from x 5, `text/number` len-14). */
const NUMBER_ROW_WIDTH = 78;
/** Long numbers' rows: the last one at top 28, the ones before it 9 rows up. */
const NUMBER_LAST_ROW_TOP = 28;
const NUMBER_ROW_PITCH = 9;
/** With three rows the box rises to here and the label is not drawn (`text/number` len-27). */
const NUMBER_TALL_BOX_TOP = 7;

/** A long number's rows, filled from its end (`text/number` len-14: `1` / `2345678901234`). */
function numberRows(text: string): { start: number; end: number }[] {
  const chars = Array.from(text);
  const font = STOCK_FONTS.small;
  const rows: { start: number; end: number }[] = [];
  let end = chars.length;
  while (end > 0) {
    let start = end;
    let width = 0;
    while (start > 0) {
      const advance = font.glyphs.get(chars[start - 1]!)?.width ?? 0;
      if (width + advance > NUMBER_ROW_WIDTH) break;
      width += advance;
      start--;
    }
    rows.unshift({ start, end });
    end = start;
  }
  return rows.length === 0 ? [{ start: 0, end: 0 }] : rows;
}

export function paintPrompt(fb: Framebuffer, model: PromptModel): void {
  for (const id of model.icons) {
    const icon = WIDGET_SPRITES[id];
    if (icon === undefined) throw new Error(`No stock widget sprite "${id}".`);
    fb.blitBitmap(icon.bitmap, icon.x, icon.y);
  }
  if (model.counter !== undefined) {
    const counter = model.counter;
    fb.drawText(STOCK_FONTS.digits, counter, fb.width - textWidth(STOCK_FONTS.digits, counter), 0);
  }
  const { entry } = model;
  const tall =
    entry?.kind === "number" &&
    textWidth(STOCK_FONTS.large, entry.text) > NUMBER_LARGE_WIDTH &&
    numberRows(entry.text).length >= 3;
  if (!tall) {
    model.label.forEach((line, i) =>
      fb.drawText(STOCK_FONTS.small, line, 0, LABEL_TOP + i * LINE_PITCH),
    );
  }
  const below = tall ? NUMBER_TALL_BOX_TOP : LABEL_TOP + model.label.length * LINE_PITCH;
  if (entry?.kind === "value") fb.drawText(STOCK_FONTS.large, entry.text, 0, below);
  if (entry?.kind === "box") paintBox(fb, entry, below, model.cursor);
  if (entry?.kind === "text") paintTextEntry(fb, entry, below, model.cursor);
  if (entry?.kind === "number") paintNumber(fb, entry, below, model.cursor);
  if (entry?.kind === "mask") fb.drawText(STOCK_FONTS.small, "*".repeat(entry.digits), 0, MASK_TOP);
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}

function paintBox(
  fb: Framebuffer,
  entry: Extract<PromptEntry, { kind: "box" }>,
  top: number,
  cursorShown: boolean,
): void {
  fb.fillRect(0, top, fb.width, 1, 1);
  fb.fillRect(0, BOX_BOTTOM, fb.width, 1, 1);
  fb.fillRect(0, top, 1, BOX_BOTTOM - top + 1, 1);
  fb.fillRect(fb.width - 1, top, 1, BOX_BOTTOM - top + 1, 1);
  const font = STOCK_FONTS[entry.font];
  const width = textWidth(font, entry.text);
  if (entry.cursor === "text") {
    fb.drawText(font, entry.text, TEXT_INSET, top + TEXT_INSET);
    if (cursorShown) fb.fillRect(TEXT_INSET + width - 1, top + 1, 1, TEXT_CURSOR_ROWS, 1);
    return;
  }
  const textTop = BOX_BOTTOM - font.glyphHeight;
  const left = VALUE_END - width;
  fb.drawText(font, entry.text, left, textTop);
  if (!cursorShown || entry.cursor === "none") return;
  const x = entry.cursor === "end" ? VALUE_END - 1 : left - 1;
  const cursorTop = Math.max(top + 1, textTop - 1);
  fb.fillRect(x, cursorTop, 1, BOX_BOTTOM - cursorTop, 1);
}

function paintFrame(fb: Framebuffer, top: number): void {
  fb.fillRect(0, top, fb.width, 1, 1);
  fb.fillRect(0, BOX_BOTTOM, fb.width, 1, 1);
  fb.fillRect(0, top, 1, BOX_BOTTOM - top + 1, 1);
  fb.fillRect(fb.width - 1, top, 1, BOX_BOTTOM - top + 1, 1);
}

/** Plan 18: an editable text, large from x 2 and 2 rows into the box; the cursor 15 rows. */
function paintTextEntry(
  fb: Framebuffer,
  entry: Extract<PromptEntry, { kind: "text" }>,
  top: number,
  cursorShown: boolean,
): void {
  paintFrame(fb, top);
  const font = STOCK_FONTS.large;
  fb.drawText(font, entry.text, TEXT_INSET, top + TEXT_INSET);
  if (!cursorShown || entry.cursor === undefined) return;
  const before = Array.from(entry.text).slice(0, entry.cursor).join("");
  fb.fillRect(TEXT_INSET + textWidth(font, before) - 1, top + 1, 1, TEXT_CURSOR_ROWS, 1);
}

/**
 * Plan 18: an editable number (`text/number`). Large and right-aligned on the box's bottom while
 * it fits, the cursor from a row above the digits to the box's bottom; else small rows, each
 * right-aligned, the cursor 9 rows from a row above its row.
 */
function paintNumber(
  fb: Framebuffer,
  entry: Extract<PromptEntry, { kind: "number" }>,
  top: number,
  cursorShown: boolean,
): void {
  paintFrame(fb, top);
  const chars = Array.from(entry.text);
  const showCursor = cursorShown && entry.cursor !== undefined;
  const large = STOCK_FONTS.large;
  if (textWidth(large, entry.text) <= NUMBER_LARGE_WIDTH) {
    const textTop = BOX_BOTTOM - large.glyphHeight;
    const left = VALUE_END - textWidth(large, entry.text);
    fb.drawText(large, entry.text, left, textTop);
    if (!showCursor) return;
    const x = left + textWidth(large, chars.slice(0, entry.cursor).join("")) - 1;
    fb.fillRect(x, textTop - 1, 1, BOX_BOTTOM - textTop + 1, 1);
    return;
  }
  const small = STOCK_FONTS.small;
  const rows = numberRows(entry.text);
  rows.forEach((row, i) => {
    const text = chars.slice(row.start, row.end).join("");
    const rowTop = NUMBER_LAST_ROW_TOP - (rows.length - 1 - i) * NUMBER_ROW_PITCH;
    const left = VALUE_END - textWidth(small, text);
    fb.drawText(small, text, left, rowTop);
    const cursor = entry.cursor;
    if (!showCursor || cursor === undefined) return;
    const last = i === rows.length - 1;
    if (cursor < row.start || cursor > row.end || (cursor === row.end && !last)) return;
    const x = left + textWidth(small, chars.slice(row.start, cursor).join("")) - 1;
    fb.fillRect(x, rowTop - 1, 1, NUMBER_ROW_PITCH, 1);
  });
}
