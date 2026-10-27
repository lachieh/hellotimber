import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../../resources";
import { SOFTKEY_TOP } from "../standby";

/** Small-face lines from x 0 at tops 7/16/25 (`tree/01-phone-book/1-8-2.leaf`). */
const SCREEN_TOPS = [7, 16, 25] as const;

/** An info screen (Memory status): small lines, no rail, no indicator. */
export interface InfoScreenModel {
  readonly kind: "info-screen";
  readonly lines: readonly string[];
  readonly softkey: string;
  /** Plan 22: the large face at tops 7/21 (Time of call, `register/time-of-call` b). */
  readonly large?: true;
}

const LARGE_TOPS = [7, 21] as const;

export function paintInfoScreen(fb: Framebuffer, model: InfoScreenModel): void {
  if (model.large) {
    model.lines.forEach((line, i) => fb.drawText(STOCK_FONTS.large, line, 0, LARGE_TOPS[i]!));
    fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
    return;
  }
  if (model.lines.length > SCREEN_TOPS.length) {
    throw new Error(`Info screen ${JSON.stringify(model.lines)} has more than 3 lines.`);
  }
  model.lines.forEach((line, i) => fb.drawText(STOCK_FONTS.small, line, 0, SCREEN_TOPS[i]!));
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
