import { rowsWindowTop, type ScreenModel } from "@hellotimber/phone-core";
import type { Framebuffer, ScreenPainter } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../resources";
import { paintBoot } from "./boot";
import { paintCarousel } from "./carousel";
import { paintIndicator } from "./indicator";
import { paintPage } from "./list-pages";
import { paintRows, VISIBLE_ROWS } from "./list-rows";
import { paintRail } from "./rail";
import { paintStandby, SOFTKEY_TOP } from "./standby";
import { paintUnsupported } from "./unsupported";
import type { ScreenDisplay } from "./screen-display";

/**
 * A painter of ScreenModels as the stock v6.39 firmware draws them, with what `display` adds (a
 * firmware's own carousel graphics, its unnumbered menus). Use it as phone-screen's
 * `createScreenRenderer({ paint })`. It owns every pixel: it clears the framebuffer (which still
 * holds the previous frame) first. The stock firmware's is `paintStockScreen`
 * (src/firmware/display.ts).
 */
export const screenPainter =
  (display: ScreenDisplay = {}): ScreenPainter =>
  (fb, screen) => {
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
        paintCarousel(fb, screen, display);
        return;
      case "list":
        paintList(fb, screen, display);
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
 * items. Rows show the kernel's circular window (`windowTop`; a model without one is drawn as
 * entered, the selection on the top row). The indicator adds the selected item's menu number to
 * the level's own (`7-6`): a hidden entry's number is skipped (`itemOrders`), so the number can
 * differ from the position. While a shortcut digit is awaited (`typed`) or the level is
 * `entering` it adds none, and while a typed entry is opening there is no soft key (plan 14 D14).
 */
function paintList(
  fb: Framebuffer,
  screen: Extract<ScreenModel, { kind: "list" }>,
  display: ScreenDisplay,
): void {
  if (screen.presentation === "pages") {
    paintPage(fb, screen.items[screen.selected], screen.detail);
  } else {
    const windowTop =
      screen.windowTop ??
      rowsWindowTop(undefined, screen.selected, screen.items.length, VISIBLE_ROWS);
    paintRows(fb, screen.items, screen.selected, windowTop);
  }
  paintRail(fb, screen.selected, screen.items.length);
  const indicator = screen.menuIndicator;
  // Plan 30 Task 0 K: an unnumbered menu's level (v6.39's SIM services) draws no menu number.
  const top = indicator?.segments[0];
  if (indicator !== undefined && !(top !== undefined && display.unnumberedMenus?.includes(top))) {
    const number = screen.itemOrders?.[screen.selected] ?? screen.selected + 1;
    paintIndicator(
      fb,
      indicator.typed === undefined && !indicator.entering
        ? { ...indicator, segments: [...indicator.segments, number] }
        : indicator,
    );
  }
  if (!screen.opening) fb.drawTextCentered(STOCK_FONTS.small, screen.softkey, SOFTKEY_TOP);
}
