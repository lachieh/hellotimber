import type { ScreenModel } from "@hellotimber/phone-core";
import type { Framebuffer, ScreenPainter } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../resources";
import { paintBoot } from "./boot";
import { paintCarousel } from "./carousel";
import { paintIndicator } from "./indicator";
import { paintPage } from "./list-pages";
import { paintRows } from "./list-rows";
import { paintRail } from "./rail";
import { paintStandby, SOFTKEY_TOP } from "./standby";
import { paintUnsupported } from "./unsupported";

/**
 * Paints a ScreenModel the way the stock v6.39 firmware draws it. Use it as phone-screen's
 * `createScreenRenderer({ paint: paintStockScreen })`. It owns every pixel: it clears the
 * framebuffer (which still holds the previous frame) first.
 */
export const paintStockScreen: ScreenPainter = (fb, screen) => {
  fb.clear();
  switch (screen.kind) {
    case "off":
      return;
    case "boot":
      paintBoot(fb, screen);
      return;
    case "standby":
      paintStandby(fb, screen);
      return;
    case "menu-carousel":
      paintCarousel(fb, screen);
      return;
    case "list":
      paintList(fb, screen);
      return;
    case "custom":
      fb.blitBitmap(screen.frame, 0, 0);
      return;
    // Reader, editor and confirm screens arrive with the plans that use them.
    case "reader":
    case "editor":
    case "confirm":
      paintUnsupported(fb, screen.kind);
      return;
  }
};

/**
 * A submenu level in either presentation, with the rail placing the selection among the visible
 * items. The indicator adds the selected item's menu number to the level's own (`7-6`): a
 * hidden entry's number is skipped (`itemOrders`), so the number can differ from the position.
 */
function paintList(fb: Framebuffer, screen: Extract<ScreenModel, { kind: "list" }>): void {
  if (screen.presentation === "pages") {
    paintPage(fb, screen.items[screen.selected], screen.detail);
  } else {
    paintRows(fb, screen.items, screen.selected);
  }
  paintRail(fb, screen.selected, screen.items.length);
  if (screen.menuIndicator !== undefined) {
    const number = screen.itemOrders?.[screen.selected] ?? screen.selected + 1;
    paintIndicator(fb, {
      ...screen.menuIndicator,
      segments: [...screen.menuIndicator.segments, number],
    });
  }
  fb.drawTextCentered(STOCK_FONTS.small, screen.softkey, SOFTKEY_TOP);
}
