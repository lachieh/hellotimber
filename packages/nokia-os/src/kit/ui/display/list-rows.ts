import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../resources";

/** Rows on screen; createStockPhone's `rowsWindow` and the widget lists use the same count. */
export const VISIBLE_ROWS = 3;
const BAND_TOP = 7;
const ROW_PITCH = 10;
const BAND_END = 78;
const TEXT_INSET = 2;
/** A plain row's label starts at this column and may take this many (x 2..77). */
export const ROW_TEXT_LEFT = TEXT_INSET;
export const ROW_TEXT_WIDTH = BAND_END - TEXT_INSET;
/**
 * A label ending in this is cut (plan 30 Task 0 K): its text, then `...` ending one column short
 * of the band's end, wherever the text stops (`Sixteen char ...`, `Twenty-four ...`).
 */
export const CUT_MARK = "…";
const CUT_DOTS = "...";
/** Multi-select rows: the mark at x 1..5, two rows below the row top; the band starts at x 8. */
const MARK_LEFT = 1;
const MARK_DROP = 2;
const MARKED_BAND_LEFT = 8;

export interface RowsOptions {
  /** Multi-select marks, one per item (☑ marked, ☐ not); the band and text move right. */
  readonly marks?: readonly boolean[];
}

/**
 * A rows list (Phone book, Games, option lists): three 10-row slots from y 7 showing the items
 * from `windowTop` on, circularly; the selected one is inverted on a band to x 77 with its text
 * 2 columns in. `selected` null draws no rows (an unset option list). Labels are single lines;
 * one wider than the band throws rather than wrap (D10).
 */
export function paintRows(
  fb: Framebuffer,
  items: readonly string[],
  selected: number | null,
  windowTop: number,
  options: RowsOptions = {},
): void {
  if (selected === null) return;
  const { marks } = options;
  const bandLeft = marks === undefined ? 0 : MARKED_BAND_LEFT;
  const textLeft = bandLeft + TEXT_INSET;
  const shown = Math.min(VISIBLE_ROWS, items.length);
  for (let row = 0; row < shown; row++) {
    const index = (windowTop + row) % items.length;
    const item = items[index]!;
    const cut = item.endsWith(CUT_MARK);
    const label = cut ? item.slice(0, -CUT_MARK.length) : item;
    const end = cut ? cutDotsX() : BAND_END;
    if (label.includes("\n") || textWidth(STOCK_FONTS.small, label) > end - textLeft) {
      throw new Error(`Row label "${label}" does not fit on one row (x ${textLeft}..${end - 1}).`);
    }
    const top = BAND_TOP + row * ROW_PITCH;
    const inverted = index === selected;
    const color = inverted ? 0 : 1;
    if (inverted) fb.fillRect(bandLeft, top, BAND_END - bandLeft, ROW_PITCH, 1);
    fb.drawText(STOCK_FONTS.small, label, textLeft, top + 1, { color });
    if (cut) fb.drawText(STOCK_FONTS.small, CUT_DOTS, cutDotsX(), top + 1, { color });
    if (marks !== undefined) {
      const mark = WIDGET_SPRITES[marks[index] ? "mark/on" : "mark/off"]!;
      fb.blitBitmap(mark.bitmap, MARK_LEFT, top + MARK_DROP);
    }
  }
}

/** Where a cut label's `...` starts: its cells end one column short of the band (x 68..76). */
export function cutDotsX(): number {
  return BAND_END - 1 - textWidth(STOCK_FONTS.small, CUT_DOTS);
}
