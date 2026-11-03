// Plan 18c: the Service command editor's `Requesting` (`service-command/send`): plan 14's
// progress note with standby's clock top right.
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../../resources";
import { paintProgress } from "./progress";

/** Standby's clock ends here (src/ui/display/standby.ts `CLOCK_END`). */
const CLOCK_END = 78;

export interface ServiceRequestModel {
  readonly kind: "service-request";
  readonly text: string;
  readonly bar: string;
  readonly softkey: string;
  /** The host's clock, if any. */
  readonly clock?: string;
}

export function paintServiceRequest(fb: Framebuffer, model: ServiceRequestModel): void {
  paintProgress(fb, { kind: "progress", text: model.text, bar: model.bar, softkey: model.softkey });
  if (model.clock === undefined) return;
  fb.drawText(
    STOCK_FONTS.digits,
    model.clock,
    CLOCK_END - textWidth(STOCK_FONTS.digits, model.clock),
    0,
  );
}
