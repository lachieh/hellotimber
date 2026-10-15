// Plan 21: the stopwatch's screen (plan21 stopwatch/*): `h:mm:ss.cc` in the large face, centred
// with its top at 15, and the soft key (`Start`, `Stop`, `Options`).
import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../../resources";
import { SOFTKEY_TOP } from "../standby";

export interface StopwatchModel {
  readonly kind: "stopwatch";
  readonly text: string;
  readonly softkey: string;
}

const TEXT_TOP = 15;

export function paintStopwatch(fb: Framebuffer, model: StopwatchModel): void {
  fb.drawTextCentered(STOCK_FONTS.large, model.text, TEXT_TOP);
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
