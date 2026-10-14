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
  model.label.forEach((line, i) =>
    fb.drawText(STOCK_FONTS.small, line, 0, LABEL_TOP + i * LINE_PITCH),
  );
  const below = LABEL_TOP + model.label.length * LINE_PITCH;
  const { entry } = model;
  if (entry?.kind === "value") fb.drawText(STOCK_FONTS.large, entry.text, 0, below);
  if (entry?.kind === "box") paintBox(fb, entry, below, model.cursor);
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
