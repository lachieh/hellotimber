import type { MenuIndicator } from "@hellotimber/phone-core";
import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../../resources";
import { paintIndicator } from "../indicator";
import { paintRows } from "../list-rows";
import { paintRail } from "../rail";
import { SOFTKEY_TOP } from "../standby";

/** A single-choice option list (plan 14 widget catalogue). */
export interface OptionsModel {
  readonly kind: "options";
  readonly items: readonly string[];
  /** The highlighted option; null = unset (virgin EEPROM): no rows are drawn. */
  readonly selected: number | null;
  /** Index of the option on the first row (the circular rows window, D3). */
  readonly windowTop: number;
  /** Complete, as drawn: `5-2-1`, `5-2-0` while unset, or the awaiting form. */
  readonly indicator: MenuIndicator;
  readonly softkey: string;
}

/**
 * An option list: the rows layout of a rows submenu with the current value highlighted (no radio
 * glyph), the rail, the indicator and the soft key (`OK`, `Quit` while unset). An unset list
 * shows no rows, the rail's bump at the top and the index `-0` (`tree/05-tones/5-2.options`).
 */
export function paintOptions(fb: Framebuffer, model: OptionsModel): void {
  paintRows(fb, model.items, model.selected, model.windowTop);
  paintRail(fb, model.selected ?? 0, model.items.length);
  paintIndicator(fb, model.indicator);
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
