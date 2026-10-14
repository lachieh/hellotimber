import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../../resources";
import { SOFTKEY_TOP } from "../standby";

/** `Level:` in the small face at x 5, top 0 (`tree/08-games/8-1-2.leaf`). */
const LEVEL_LABEL = { text: "Level:", x: 5, top: 0 } as const;

/** A game's level bar: `Level:` and the bars as the virgin EEPROM shows them (P12). */
export interface LevelBarModel {
  readonly kind: "level-bar";
  /** The bars' sprite id (`level/8-1`). */
  readonly bars: string;
  readonly softkey: string;
}

export function paintLevelBar(fb: Framebuffer, model: LevelBarModel): void {
  fb.drawText(STOCK_FONTS.small, LEVEL_LABEL.text, LEVEL_LABEL.x, LEVEL_LABEL.top);
  const bars = WIDGET_SPRITES[model.bars];
  if (bars === undefined) throw new Error(`No stock widget sprite "${model.bars}".`);
  fb.blitBitmap(bars.bitmap, bars.x, bars.y);
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
