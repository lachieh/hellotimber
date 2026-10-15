import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../../resources";
import { SOFTKEY_TOP } from "../standby";

/** The text sits below the bar, small face from x 0 (`tree/07-call-divert/7-6.leaf`). */
const TEXT_TOP = 18;
/** A second line 9 rows down (plan 18: `Sending` / `message`, `sms/send` frame 1). */
const LINE_PITCH = 9;

/** A progress note: `Requesting` or `Searching` under the animated hatched bar. */
export interface ProgressModel {
  readonly kind: "progress";
  /** One line, or (plan 18 `Sending message`) lines 9 rows apart. */
  readonly text: string | readonly string[];
  /** The bar's sprite for this step (`progress-1` … `progress-10`). */
  readonly bar: string;
  readonly softkey: string;
}

export function paintProgress(fb: Framebuffer, model: ProgressModel): void {
  const bar = WIDGET_SPRITES[model.bar];
  if (bar === undefined) throw new Error(`No stock widget sprite "${model.bar}".`);
  fb.blitBitmap(bar.bitmap, bar.x, bar.y);
  const lines = typeof model.text === "string" ? [model.text] : model.text;
  lines.forEach((line, i) => fb.drawText(STOCK_FONTS.small, line, 0, TEXT_TOP + i * LINE_PITCH));
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
