// A firmware's painter and describer (plan 32 Phase 0): the kit's, with what the firmware draws
// beyond its screen models (`Firmware.display`: its own carousel graphics, SIM services' unnumbered
// level). `paintStockScreen` and `describeStockScreen` are the stock v6.39 firmware's.
import type { ScreenModel } from "@hellotimber/phone-core";
import type { ScreenPainter } from "@hellotimber/phone-screen";
import { describeScreen } from "@hellotimber/nokia-kit/ui/display/describe";
import { screenPainter } from "@hellotimber/nokia-kit/ui/display/paint";
import type { Firmware } from "./firmware";
import { STOCK_FIRMWARE } from "./stock";

/** Paints the screens of a phone running `firmware`. */
export function firmwarePainter(firmware: Firmware): ScreenPainter {
  return screenPainter(firmware.display);
}

/** Describes a screen of a phone running `firmware` (plan 30 D11). */
export function describeFirmwareScreen(firmware: Firmware, screen: ScreenModel): string {
  return describeScreen(screen, firmware.display);
}

/**
 * Paints a ScreenModel the way the stock v6.39 firmware draws it. Use it as phone-screen's
 * `createScreenRenderer({ paint: paintStockScreen })`.
 */
export const paintStockScreen: ScreenPainter = firmwarePainter(STOCK_FIRMWARE);

/**
 * Plan 30 D11: a plain-text description of `screen` (any snapshot's screen of a stock phone), for
 * accessibility mirrors and headless QA. Never empty.
 */
export function describeStockScreen(screen: ScreenModel): string {
  return describeFirmwareScreen(STOCK_FIRMWARE, screen);
}
