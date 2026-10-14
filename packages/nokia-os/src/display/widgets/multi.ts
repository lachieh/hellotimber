import type { MenuIndicator } from "@hellotimber/phone-core";
import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../../resources";
import { paintIndicator } from "../indicator";
import { paintRows } from "../list-rows";
import { paintRail } from "../rail";
import { SOFTKEY_TOP } from "../standby";

/** A multi-select option list (Info service › Language). */
export interface MultiModel {
  readonly kind: "multi";
  readonly items: readonly string[];
  readonly marks: readonly boolean[];
  readonly selected: number;
  readonly windowTop: number;
  readonly indicator: MenuIndicator;
  /** `Unmark` on a marked row, `Mark` otherwise. */
  readonly softkey: string;
}

/**
 * Multi-select rows: a ☑ (filled) or ☐ (dotted) mark at x 1..5 on every row, the band from x 8
 * and the text from x 10 (`tree/02-messages/2-8-5.options`), with the rail and indicator.
 */
export function paintMulti(fb: Framebuffer, model: MultiModel): void {
  paintRows(fb, model.items, model.selected, model.windowTop, { marks: model.marks });
  paintRail(fb, model.selected, model.items.length);
  paintIndicator(fb, model.indicator);
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
