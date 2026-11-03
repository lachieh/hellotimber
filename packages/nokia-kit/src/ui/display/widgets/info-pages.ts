import type { MenuIndicator } from "@hellotimber/phone-core";
import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../../resources";
import { paintIndicator } from "../indicator";
import { paintPage } from "../list-pages";
import { paintRail } from "../rail";
import { SOFTKEY_TOP } from "../standby";

/** One page of an info-pages list (Show call duration, Score IDs). */
export interface InfoPageModel {
  readonly kind: "info-page";
  /** Firmware lines joined with `\n`. */
  readonly label: string;
  readonly value?: string;
  readonly index: number;
  readonly count: number;
  readonly indicator: MenuIndicator;
  readonly softkey: string;
}

/** An info page: the page layout of a pages submenu (value in the thin face), rail, indicator. */
export function paintInfoPage(fb: Framebuffer, model: InfoPageModel): void {
  paintPage(fb, model.label, model.value);
  paintRail(fb, model.index, model.count);
  paintIndicator(fb, model.indicator);
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
