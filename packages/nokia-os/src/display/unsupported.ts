import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../resources";

/**
 * A 1-pixel dotted border (lit where x + y is even). The firmware never draws one, so it marks
 * screens this package does not reproduce yet.
 */
export function paintDottedBorder(fb: Framebuffer): void {
  for (let x = 0; x < fb.width; x++) {
    for (const y of [0, fb.height - 1]) if ((x + y) % 2 === 0) fb.setPixel(x, y, 1);
  }
  for (let y = 0; y < fb.height; y++) {
    for (const x of [0, fb.width - 1]) if ((x + y) % 2 === 0) fb.setPixel(x, y, 1);
  }
}

/** Marker for ScreenModel kinds the stock OS does not use yet: dotted border plus the kind name. */
export function paintUnsupported(fb: Framebuffer, name: string): void {
  paintDottedBorder(fb);
  fb.drawTextCentered(STOCK_FONTS.small, name, 20);
}
