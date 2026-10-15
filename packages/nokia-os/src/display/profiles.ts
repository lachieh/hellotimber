// Plan 17's standby additions: the active profile's line under the operator and the silent icon
// (D5, D6), drawn by the stock standby painter.
import type { ScreenModel } from "@hellotimber/phone-core";
import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../resources";

/** The profile line: centred in the small face, top 18 (`profiles/activate-*`). */
export const PROFILE_LINE_TOP = 18;

/**
 * The profile line and the silent icon (top left, x 7..13, `profiles/icon`). Both stay while
 * Menu erases the ladders (`profiles/standby-menu`).
 */
export function paintProfileStandby(
  fb: Framebuffer,
  screen: Extract<ScreenModel, { kind: "standby" }>,
): void {
  if (screen.line !== undefined)
    fb.drawTextCentered(STOCK_FONTS.small, screen.line, PROFILE_LINE_TOP);
  if (screen.indicators?.silent) {
    const { bitmap, x, y } = WIDGET_SPRITES["profiles/silent"]!;
    fb.blitBitmap(bitmap, x, y);
  }
}
