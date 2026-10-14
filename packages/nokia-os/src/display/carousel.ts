import type { ScreenModel } from "@hellotimber/phone-core";
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, STOCK_MENU_ICONS } from "../resources";
import { paintIndicator } from "./indicator";
import { paintRail } from "./rail";
import { SOFTKEY_TOP } from "./standby";

const TITLE_TOP = 7;
/** The title is centred in x 0..77, the columns a rows band covers (measured on all 12 stills). */
const TITLE_WIDTH = 78;

/**
 * The main-menu carousel: the large title, the animated icon (frame `iconFrame`, else its
 * first frame), the rail placing the slot among `total`, the indicator and the softkey.
 */
export function paintCarousel(
  fb: Framebuffer,
  screen: Extract<ScreenModel, { kind: "menu-carousel" }>,
): void {
  const title = textWidth(STOCK_FONTS.large, screen.label);
  fb.drawText(STOCK_FONTS.large, screen.label, Math.floor((TITLE_WIDTH - title) / 2), TITLE_TOP);
  const icon = STOCK_MENU_ICONS[screen.iconId];
  if (icon === undefined) throw new Error(`No stock menu icon "${screen.iconId}".`);
  const frame = icon.frames[screen.iconFrame ?? 0];
  if (frame === undefined) {
    throw new Error(`No frame ${screen.iconFrame} for stock menu icon "${screen.iconId}".`);
  }
  fb.blitBitmap(frame, icon.x, icon.y);
  paintRail(fb, screen.menuNumber - 1, screen.total);
  paintIndicator(fb, screen.menuIndicator);
  fb.drawTextCentered(STOCK_FONTS.small, "Select", SOFTKEY_TOP);
}
