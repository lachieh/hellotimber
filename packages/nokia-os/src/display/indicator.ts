import type { MenuIndicator } from "@hellotimber/phone-core";
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../resources";

/** The three dots shown while the first shortcut digit is awaited (menu/01-phone-book.anim). */
const FIRST_DIGIT_DOTS = [78, 80, 82] as const;
const FIRST_DIGIT_DOTS_Y = 5;

/**
 * The menu number at the top right: levels joined by `-` in the digits font, right-aligned so
 * the last digit cell ends at the LCD's right edge (`2-1`: the 1's ink ends at x 81, a 2's at 82).
 * After a digit has been typed (`awaitingNext`) the segments are drawn without a cursor
 * (UNVERIFIED, D5).
 */
export function paintIndicator(fb: Framebuffer, indicator: MenuIndicator): void {
  if (indicator.awaitingFirst) {
    for (const x of FIRST_DIGIT_DOTS) fb.setPixel(x, FIRST_DIGIT_DOTS_Y, 1);
    return;
  }
  const text = indicator.segments.join("-");
  fb.drawText(STOCK_FONTS.digits, text, fb.width - textWidth(STOCK_FONTS.digits, text), 0);
}
