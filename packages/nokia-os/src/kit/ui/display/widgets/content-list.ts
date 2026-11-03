// Plan 18c's lists of Templates and Smileys (2-5, 2-6, and the editors' Template and Insert
// smiley): the rows layout of a rows list, a template's icon left of the band, a text too wide cut
// before the `...` mark (`content/templates-list`, `content/smileys-list`).
import type { MenuIndicator } from "@hellotimber/phone-core";
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../../resources";
import { paintIndicator } from "../indicator";
import { VISIBLE_ROWS } from "../list-rows";
import { paintRail } from "../rail";
import { SOFTKEY_TOP } from "../standby";

const BAND_TOP = 7;
const ROW_PITCH = 10;
const BAND_END = 78;
/** With icons the band starts at x 8 and the text at x 10; without, at x 0 and x 2. */
const ICON_BAND_LEFT = 8;
const TEXT_INSET = 2;
/** The icon's column and drop below the row's top (`content/templates-list` 01). */
const ICON_LEFT = 1;
const ICON_DROP = 1;
/** The `...` mark: three periods from x 68 (ink at 68, 71, 74). */
const MORE_LEFT = 68;
const MORE = "...";

export interface ContentListModel {
  readonly kind: "content-list";
  /** Each row's text (`(empty)` for an empty slot). */
  readonly rows: readonly string[];
  /** Template rows carry the template icon left of the band; smiley rows none. */
  readonly icon?: string;
  readonly selected: number;
  /** The row on top of the circular window (D3). */
  readonly windowTop: number;
  readonly indicator: MenuIndicator;
  readonly softkey: string;
}

/**
 * `text` as one row shows it from `left`: whole when it ends before the `...` mark's column, else
 * its longest start that does, and the mark.
 */
export function rowText(
  text: string,
  left: number,
): { readonly text: string; readonly more: boolean } {
  const font = STOCK_FONTS.small;
  const room = MORE_LEFT - left;
  if (textWidth(font, text) <= BAND_END - TEXT_INSET - left) return { text, more: false };
  const chars = Array.from(text);
  let n = chars.length;
  while (n > 0 && textWidth(font, chars.slice(0, n).join("")) > room) n--;
  return { text: chars.slice(0, n).join(""), more: true };
}

export function paintContentList(fb: Framebuffer, model: ContentListModel): void {
  const { rows, selected, windowTop, icon } = model;
  const bandLeft = icon === undefined ? 0 : ICON_BAND_LEFT;
  const textLeft = bandLeft + TEXT_INSET;
  const sprite = icon === undefined ? undefined : WIDGET_SPRITES[icon];
  if (icon !== undefined && sprite === undefined)
    throw new Error(`No stock widget sprite "${icon}".`);
  const shown = Math.min(VISIBLE_ROWS, rows.length);
  for (let slot = 0; slot < shown; slot++) {
    const index = (windowTop + slot) % rows.length;
    const top = BAND_TOP + slot * ROW_PITCH;
    const inverted = index === selected;
    if (inverted) fb.fillRect(bandLeft, top, BAND_END - bandLeft, ROW_PITCH, 1);
    const { text, more } = rowText(rows[index]!, textLeft);
    const color = inverted ? 0 : 1;
    fb.drawText(STOCK_FONTS.small, text, textLeft, top + 1, { color });
    if (more) fb.drawText(STOCK_FONTS.small, MORE, MORE_LEFT, top + 1, { color });
    if (sprite !== undefined) fb.blitBitmap(sprite.bitmap, ICON_LEFT, top + ICON_DROP);
  }
  paintRail(fb, selected, rows.length);
  paintIndicator(fb, model.indicator);
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
