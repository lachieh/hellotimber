import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../../resources";
import { SYMBOLS } from "../../text/keys";
import { SOFTKEY_TOP } from "../standby";

/** The symbol table with cell `selected` highlighted (plan 18 S5, `text/symbols-down`). */
export interface SymbolsModel {
  readonly kind: "symbols";
  readonly selected: number;
  /** Opened from the T9 editor: its header, the T9 pen and the mode text 7 columns on (plan 18b). */
  readonly t9?: boolean;
}

/** The T9 header's mode text lies this far right of the multi-tap header's (`t9/g-star-free`). */
const T9_HEADER_SHIFT = 7;

/** Cells per row; rows of 11, 11 and 9. */
export const SYMBOL_COLUMNS = 11;
/** Cell k's 8x8 box: x 1 + 7 × column, y 7 + 10 × row (neighbouring boxes share a column). */
const CELL_PITCH_X = 7;
const CELL_PITCH_Y = 10;
const CELL_SIZE = 8;

function cell(k: number): { x: number; y: number } {
  return {
    x: 1 + CELL_PITCH_X * (k % SYMBOL_COLUMNS),
    y: 7 + CELL_PITCH_Y * Math.floor(k / SYMBOL_COLUMNS),
  };
}

/**
 * The header (the pen and the symbol mode text), every symbol in the thin face one column into
 * its box, the selected box solid with its symbol clear, and `Use`.
 */
export function paintSymbols(fb: Framebuffer, model: SymbolsModel): void {
  const pen = WIDGET_SPRITES[model.t9 ? "editor/t9-pen" : "prompt/pen"]!;
  fb.blitBitmap(pen.bitmap, pen.x, pen.y);
  const mode = WIDGET_SPRITES["editor/mode-symbols"]!;
  fb.blitBitmap(mode.bitmap, mode.x + (model.t9 ? T9_HEADER_SHIFT : 0), mode.y);
  SYMBOLS.forEach((symbol, k) => {
    if (k === model.selected) return;
    const { x, y } = cell(k);
    fb.drawText(STOCK_FONTS.thin, symbol, x + 1, y);
  });
  // The selected box is solid, its symbol clear; it covers the column it shares with the box
  // before it (`text/symbols-down` 01: € loses its last column under ¥'s box).
  const { x, y } = cell(model.selected);
  fb.fillRect(x, y, CELL_SIZE, CELL_SIZE, 1);
  fb.drawText(STOCK_FONTS.thin, SYMBOLS[model.selected]!, x + 1, y, { color: 0 });
  fb.drawTextCentered(STOCK_FONTS.small, "Use", SOFTKEY_TOP);
}
