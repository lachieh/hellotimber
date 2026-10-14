import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../../resources";
import { SOFTKEY_TOP } from "../standby";

/** The text sits below the bar, small face from x 0 (`tree/07-call-divert/7-6.leaf`). */
const TEXT_TOP = 18;

/** A progress note: `Requesting` or `Searching` under the animated hatched bar. */
export interface ProgressModel {
  readonly kind: "progress";
  readonly text: string;
  /** The bar's sprite for this step (`progress-1` … `progress-10`). */
  readonly bar: string;
  readonly softkey: string;
}

export function paintProgress(fb: Framebuffer, model: ProgressModel): void {
  const bar = WIDGET_SPRITES[model.bar];
  if (bar === undefined) throw new Error(`No stock widget sprite "${model.bar}".`);
  fb.blitBitmap(bar.bitmap, bar.x, bar.y);
  fb.drawText(STOCK_FONTS.small, model.text, 0, TEXT_TOP);
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
