import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../../resources";
import { SOFTKEY_TOP } from "../standby";

/**
 * Line tops by line count, measured: one line at 2 (`Replace old ID?`), two at 4/13 (`Are you` /
 * `sure?`), three at 2/12/22 (`Select maximum` / `volume for` / `ringing tone?`).
 */
const LINE_TOPS: Readonly<Record<number, readonly number[]>> = {
  1: [2],
  2: [4, 13],
  3: [2, 12, 22],
};

/** A confirm query (plan 14 widget catalogue). */
export interface ConfirmModel {
  readonly kind: "confirm";
  readonly lines: readonly string[];
  readonly softkey: string;
}

/** A confirm query: small-face lines from x 0 and its soft key (`OK`, `Yes`). */
export function paintConfirm(fb: Framebuffer, model: ConfirmModel): void {
  const tops = LINE_TOPS[model.lines.length];
  if (tops === undefined) {
    throw new Error(`Confirm query ${JSON.stringify(model.lines)}: no layout for its line count.`);
  }
  model.lines.forEach((line, i) => fb.drawText(STOCK_FONTS.small, line, 0, tops[i]!));
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
