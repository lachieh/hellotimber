import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../resources";

const VISIBLE_ROWS = 3;
const BAND_TOP = 7;
const ROW_PITCH = 10;
const BAND_WIDTH = 78;
const TEXT_LEFT = 2;

/**
 * A rows submenu (Phone book, Games, Reminders, Profiles): three 10-row slots from y 7, the
 * selected one inverted on a band x 0..77, text at x 2. Once scrolled, the selection is held on
 * the bottom row (window max(0, selected - 2)). Labels are single lines; one wider than the
 * band throws rather than wrap (D10).
 */
export function paintRows(fb: Framebuffer, items: readonly string[], selected: number): void {
  const first = Math.max(0, selected - (VISIBLE_ROWS - 1));
  items.slice(first, first + VISIBLE_ROWS).forEach((label, row) => {
    if (label.includes("\n") || textWidth(STOCK_FONTS.small, label) > BAND_WIDTH - TEXT_LEFT) {
      throw new Error(`Row label "${label}" does not fit on one row (x ${TEXT_LEFT}..77).`);
    }
    const top = BAND_TOP + row * ROW_PITCH;
    const inverted = first + row === selected;
    if (inverted) fb.fillRect(0, top, BAND_WIDTH, ROW_PITCH, 1);
    fb.drawText(STOCK_FONTS.small, label, TEXT_LEFT, top + 1, { color: inverted ? 0 : 1 });
  });
}
