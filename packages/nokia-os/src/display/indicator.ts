import type { MenuIndicator } from "@hellotimber/phone-core";
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../resources";

/** The three dots shown while a shortcut digit is awaited (menu/01-phone-book.anim). */
const AWAITING_DOTS = [78, 80, 82] as const;
const AWAITING_DOTS_Y = 5;
/** While a digit is awaited the text's last cell ends where the dots begin (probe/shortcut-m1-2). */
const AWAITING_TEXT_END = AWAITING_DOTS[0];

/**
 * The menu number at the top right: levels joined by `-` in the digits font, right-aligned so
 * the last digit cell ends at the LCD's right edge (`2-1`: the 1's ink ends at x 81, a 2's at 82).
 * While a stock shortcut digit is awaited (`typed`) it shows the level's path, a dash and the
 * digits typed so far, then three dots (`1` and dots, `12-` and dots, `11-0` and dots, plan 14
 * D14); right after Menu (`awaitingFirst`) only the dots. After a plan 13 per-digit shortcut
 * (`awaitingNext` without `typed`) the segments are drawn without a mark (UNVERIFIED, D5).
 */
export function paintIndicator(fb: Framebuffer, indicator: MenuIndicator): void {
  if (indicator.awaitingFirst || indicator.typed !== undefined) {
    // With `awaitingFirst` the segments hold the carousel slot, which is not drawn.
    const { segments, typed = "" } = indicator;
    const text =
      indicator.awaitingFirst || segments.length === 0 ? typed : `${segments.join("-")}-${typed}`;
    fb.drawText(
      STOCK_FONTS.digits,
      text,
      AWAITING_TEXT_END - textWidth(STOCK_FONTS.digits, text),
      0,
    );
    for (const x of AWAITING_DOTS) fb.setPixel(x, AWAITING_DOTS_Y, 1);
    return;
  }
  const text = indicator.segments.join("-");
  fb.drawText(STOCK_FONTS.digits, text, fb.width - textWidth(STOCK_FONTS.digits, text), 0);
}
