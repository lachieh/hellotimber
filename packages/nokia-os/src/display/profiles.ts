// Plan 17's standby additions: the active profile's line under the operator and the silent icon
// (D5, D6), drawn by the stock standby painter.
import type { ScreenModel } from "@hellotimber/phone-core";
import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../resources";
import { paintStandby } from "./standby";

/** The profile line: centred in the small face, top 18 (`profiles/activate-*`). */
export const PROFILE_LINE_TOP = 18;

/**
 * The profile line and the silent icon (top left, x 7..13, `profiles/icon`). Both stay while
 * Menu erases the ladders (`profiles/standby-menu`). A plan 18 notice replaces the line (its lines
 * cover top 18), and the message envelope, drawn at the silent icon's place, hides the icon (no
 * capture shows both: UNVERIFIED).
 */
export function paintProfileStandby(
  fb: Framebuffer,
  screen: Extract<ScreenModel, { kind: "standby" }>,
): void {
  if (screen.line !== undefined && screen.notice === undefined)
    fb.drawTextCentered(STOCK_FONTS.small, screen.line, PROFILE_LINE_TOP);
  if (screen.indicators?.silent === true && screen.indicators.message !== true) {
    const { bitmap, x, y } = WIDGET_SPRITES["profiles/silent"]!;
    fb.blitBitmap(bitmap, x, y);
  }
}

/**
 * Standby as the power key's list draws it around itself (D7): on its key-down with the ladders
 * and the signal and battery icons erased (`leaving`, the operator, clock, line and silent icon
 * kept: `profiles/power-*-list`), and on its C with the operator and the line not yet drawn
 * (`returning`: `profiles/power-*-c`).
 */
export interface StandbyFrameModel {
  readonly kind: "standby-frame";
  readonly screen: Extract<ScreenModel, { kind: "standby" }>;
  readonly frame: "leaving" | "returning";
}

export function paintStandbyFrame(fb: Framebuffer, model: StandbyFrameModel): void {
  const { line: _line, ...screen } = model.screen;
  paintStandby(
    fb,
    model.frame === "leaving" ? { ...model.screen, leaving: true } : { ...screen, carrier: "" },
  );
}
