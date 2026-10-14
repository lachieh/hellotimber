import type { ScreenPainter } from "@hellotimber/phone-screen";
import { paintBoot } from "./boot";
import { paintStandby } from "./standby";
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
    case "custom":
      fb.blitBitmap(screen.frame, 0, 0);
      return;
    // The carousel and lists are plan 13 Task 10; reader, editor and confirm are later plans.
    case "menu-carousel":
    case "list":
    case "reader":
    case "editor":
    case "confirm":
      paintUnsupported(fb, screen.kind.replace("-", " "));
      return;
  }
};
