import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../resources";

/** Rows on screen; createStockPhone's `rowsWindow` and the widget lists use the same count. */
export const VISIBLE_ROWS = 3;
const BAND_TOP = 7;
const ROW_PITCH = 10;
const BAND_END = 78;
const TEXT_INSET = 2;
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
    const label = items[index]!;
    if (label.includes("\n") || textWidth(STOCK_FONTS.small, label) > BAND_END - textLeft) {
      throw new Error(`Row label "${label}" does not fit on one row (x ${textLeft}..77).`);
    }
    const top = BAND_TOP + row * ROW_PITCH;
    const inverted = index === selected;
    if (inverted) fb.fillRect(bandLeft, top, BAND_END - bandLeft, ROW_PITCH, 1);
    fb.drawText(STOCK_FONTS.small, label, textLeft, top + 1, { color: inverted ? 0 : 1 });
    if (marks !== undefined) {
      const mark = WIDGET_SPRITES[marks[index] ? "mark/on" : "mark/off"]!;
      fb.blitBitmap(mark.bitmap, MARK_LEFT, top + MARK_DROP);
    }
  }
}
