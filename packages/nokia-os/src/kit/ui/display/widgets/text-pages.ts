import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../../resources";
import { SOFTKEY_TOP } from "../standby";

/** Thin-face lines from x 0 at tops 7/16/25 (`tree/08-games/8-1-6.leaf`). */
const TEXT_TOPS = [7, 16, 25] as const;

/** One page of a game's instructions. */
export interface TextPageModel {
  readonly kind: "text-page";
  readonly lines: readonly string[];
  readonly softkey: string;
}

export function paintTextPage(fb: Framebuffer, model: TextPageModel): void {
  if (model.lines.length > TEXT_TOPS.length) {
    throw new Error(`Text page ${JSON.stringify(model.lines)} has more than 3 lines.`);
  }
  model.lines.forEach((line, i) => fb.drawText(STOCK_FONTS.thin, line, 0, TEXT_TOPS[i]!));
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
