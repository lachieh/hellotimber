import type { ScreenModel } from "@hellotimber/phone-core";
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, STOCK_MENU_ICONS } from "../resources";
import { paintIndicator } from "./indicator";
import { paintRail } from "./rail";
import { SOFTKEY_TOP } from "./standby";
import { SIM_SERVICES_NUMBER, SIM_SERVICES_ORDER, SIM_SERVICES_SLUG } from "../sim/slot";

const TITLE_TOP = 7;
/** The title is centred in x 0..77, the columns a rows band covers (measured on all 12 stills). */
export const CAROUSEL_TITLE_WIDTH = 78;
const TITLE_WIDTH = CAROUSEL_TITLE_WIDTH;

/**
 * The main-menu carousel: the large title, the animated icon (frame `iconFrame`, else its
 * first frame), the rail placing the slot among `total`, the indicator and the softkey (hidden
 * while a typed entry is opening).
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
  paintIndicator(fb, simServicesNumbered(screen));
  // While a typed entry is opening there is no soft key (plan 14 D14).
  if (!screen.opening) fb.drawTextCentered(STOCK_FONTS.small, "Select", SOFTKEY_TOP);
}

/**
 * The slot's indicator; SIM services' (plan 30, the 13th slot) reads 14: v6.39 numbers it 14 and
 * has no 13 (Task 0 K).
 */
function simServicesNumbered(
  screen: Extract<ScreenModel, { kind: "menu-carousel" }>,
): Extract<ScreenModel, { kind: "menu-carousel" }>["menuIndicator"] {
  const indicator = screen.menuIndicator;
  if (screen.iconId !== SIM_SERVICES_SLUG || indicator.segments[0] !== SIM_SERVICES_ORDER) {
    return indicator;
  }
  return { ...indicator, segments: [SIM_SERVICES_NUMBER, ...indicator.segments.slice(1)] };
}
