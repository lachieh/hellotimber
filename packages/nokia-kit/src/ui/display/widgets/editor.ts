import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../../resources";
import { SOFTKEY_TOP } from "../standby";

/**
 * The stock text editor (plan 18 S6, Task 3's display table): the header's pen and mode sprites,
 * the counter in the digits face ending at x 83, the text lines from x 1, the cursor bar and the
 * soft key.
 */
export interface EditorModel {
  readonly kind: "editor";
  /**
   * Header sprites by id (`prompt/pen`, the mode text), at their own place or at `x` (plan 18b:
   * the T9 header's mode text from x 21).
   */
  readonly icons: readonly (string | { readonly id: string; readonly x: number })[];
  readonly counter: string;
  readonly font: "small" | "large";
  /** The shown lines, each at its top. */
  readonly lines: readonly { readonly text: string; readonly top: number }[];
  /** The cursor bar while it shows (absent while a character is pending or the blink hides it). */
  readonly cursor?: { readonly x: number; readonly top: number; readonly height: number };
  /** Plan 18b: the T9 composing word's underline, one 1-pixel line per text line it is on. */
  readonly underlines?: readonly {
    readonly x: number;
    readonly y: number;
    readonly width: number;
  }[];
  readonly softkey: string;
}

/** Text lines start here (x 0 is the cursor's column at a line start). */
export const EDITOR_TEXT_LEFT = 1;

export function paintEditor(fb: Framebuffer, model: EditorModel): void {
  for (const entry of model.icons) {
    const id = typeof entry === "string" ? entry : entry.id;
    const icon = WIDGET_SPRITES[id];
    if (icon === undefined) throw new Error(`No stock widget sprite "${id}".`);
    fb.blitBitmap(icon.bitmap, typeof entry === "string" ? icon.x : entry.x, icon.y);
  }
  const digits = STOCK_FONTS.digits;
  fb.drawText(digits, model.counter, fb.width - textWidth(digits, model.counter), 0);
  const font = STOCK_FONTS[model.font];
  for (const line of model.lines) fb.drawText(font, line.text, EDITOR_TEXT_LEFT, line.top);
  const { cursor } = model;
  if (cursor !== undefined) fb.fillRect(cursor.x, cursor.top, 1, cursor.height, 1);
  for (const line of model.underlines ?? []) fb.fillRect(line.x, line.y, line.width, 1, 1);
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
