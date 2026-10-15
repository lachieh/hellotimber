// The Composer's editor (plan 27 Task 7): the three-note icon top left, the tokens left top right
// in the digits face, three notation lines in the small face from x 1 at tops 8, 18 and 28, the
// cursor bar and the soft key (Task 0: entry/*, cursor/*, layout/*).
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../../resources";
import { SOFTKEY_TOP } from "../standby";

/** Lines start at x 1 (the small face's advances end in a blank column: a line's width is its last
 * column's x, where the cursor goes); the first line's top; lines are 10 rows apart. */
const LINE_LEFT = 1;
const FIRST_LINE_TOP = 8;
const LINE_PITCH = 10;
const LINES_SHOWN = 3;
/** The cursor: a 1 px bar from the row above a line's top, 10 rows (`entry/empty`). */
const CURSOR_ABOVE = 1;
const CURSOR_ROWS = 10;

export interface ComposerModel {
  readonly kind: "composer";
  /** The lines shown (at most three), top to bottom. */
  readonly lines: readonly string[];
  /** The cursor on a shown line (0-2) at x, or null in its hidden phase. */
  readonly cursor: { readonly line: number; readonly x: number } | null;
  /** Tokens left (`50` … `0`). */
  readonly counter: string;
  readonly softkey: string;
}

export function paintComposer(fb: Framebuffer, model: ComposerModel): void {
  if (model.lines.length > LINES_SHOWN) {
    throw new Error(`The Composer shows ${LINES_SHOWN} lines, not ${model.lines.length}.`);
  }
  const icon = WIDGET_SPRITES["composer/icon"];
  if (icon === undefined) throw new Error('No widget sprite "composer/icon".');
  fb.blitBitmap(icon.bitmap, icon.x, icon.y);
  const digits = STOCK_FONTS.digits;
  fb.drawText(digits, model.counter, fb.width - textWidth(digits, model.counter), 0);
  const small = STOCK_FONTS.small;
  model.lines.forEach((line, i) => {
    const width = textWidth(small, line);
    if (LINE_LEFT + width > fb.width)
      throw new Error(`Composer line "${line}" is ${width} px wide.`);
    fb.drawText(small, line, LINE_LEFT, FIRST_LINE_TOP + i * LINE_PITCH);
  });
  if (model.cursor !== null) {
    const top = FIRST_LINE_TOP + model.cursor.line * LINE_PITCH - CURSOR_ABOVE;
    fb.fillRect(model.cursor.x, top, 1, CURSOR_ROWS, 1);
  }
  fb.drawTextCentered(small, model.softkey, SOFTKEY_TOP);
}
