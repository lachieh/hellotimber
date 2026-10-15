import type { ScreenModel } from "@hellotimber/phone-core";
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STATUS_SPRITES, STOCK_FONTS, type StockSprite } from "../resources";
import { paintProfileStandby } from "./profiles";

/** Softkey labels are centred: x = floor((84 - advance width) / 2), top y 40. */
export const SOFTKEY_TOP = 40;
const CARRIER_TOP = 8;
/** The clock's last digit cell ends here, left of the battery ladder (its ink ends at x 76). */
const CLOCK_END = 78;

function paintSprites(fb: Framebuffer, sprites: readonly StockSprite[]): void {
  for (const { bitmap, x, y } of sprites) fb.blitBitmap(bitmap, x, y);
}

/**
 * Standby: signal ladder and antenna on the left, battery ladder and icon on the right, operator
 * centred, clock top right, `Menu`. Level n shows the bottom n bars (levels below 4 are
 * UNVERIFIED: the kernel always reports 4). While `leaving` (the 39 ms after Menu) the ladders
 * and icons are erased. Standby notices and indicators are not part of the stock OS yet.
 */
export function paintStandby(
  fb: Framebuffer,
  screen: Extract<ScreenModel, { kind: "standby" }>,
): void {
  if (!screen.leaving) {
    paintSprites(fb, STATUS_SPRITES.signalBars.slice(4 - screen.signal));
    paintSprites(fb, [STATUS_SPRITES.signalIcon]);
    paintSprites(fb, STATUS_SPRITES.batteryBars.slice(4 - screen.battery));
    paintSprites(fb, [STATUS_SPRITES.batteryIcon]);
  }
  fb.drawTextCentered(STOCK_FONTS.small, screen.carrier, CARRIER_TOP);
  paintProfileStandby(fb, screen);
  if (screen.clock !== undefined) {
    const x = CLOCK_END - textWidth(STOCK_FONTS.digits, screen.clock);
    fb.drawText(STOCK_FONTS.digits, screen.clock, x, 0);
  }
  fb.drawTextCentered(STOCK_FONTS.small, "Menu", SOFTKEY_TOP);
}
