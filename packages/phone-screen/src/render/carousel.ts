import type { ScreenModel } from "@hellotimber/phone-core";
import { FONT } from "../font/font";
import type { Framebuffer } from "../framebuffer";
import { menuIcon } from "../icons/menu-icons";
import { drawScrollIndicator, drawSoftkey, drawTextRight, LINE_CHARS, truncate } from "./layout";

type CarouselScreen = Extract<ScreenModel, { kind: "menu-carousel" }>;

const LABEL_Y = 9;
const ICON_X = 34; // (84 - 16) / 2
const ICON_Y = 18;

export function renderCarousel(fb: Framebuffer, screen: CarouselScreen): void {
  fb.clear(0);
  // Menu shortcut number top-right — verified 3310 behavior (spec §5).
  drawTextRight(fb, String(screen.menuNumber), 83, 0);
  fb.drawTextCentered(FONT, truncate(screen.label, LINE_CHARS), LABEL_Y);
  fb.blitBitmap(menuIcon(screen.iconId), ICON_X, ICON_Y);
  drawScrollIndicator(fb, screen.menuNumber - 1, screen.total);
  drawSoftkey(fb, "Select");
}
