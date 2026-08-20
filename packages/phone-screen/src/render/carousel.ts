import type { ScreenModel } from "@hellotimber/phone-core";
import { FONT } from "../font/font";
import type { Framebuffer } from "../framebuffer";
import { menuIcon } from "../icons/menu-icons";
import { drawMenuIndicator, drawPositionRail, drawSoftkey, truncateToWidth } from "./layout";

export type CarouselScreen = Extract<ScreenModel, { kind: "menu-carousel" }>;

const LABEL_Y = 9;
const ICON_X = 34;
const ICON_Y = 18;

export function renderCarousel(fb: Framebuffer, screen: CarouselScreen): void {
  fb.clear(0);
  drawMenuIndicator(fb, screen.menuIndicator);
  fb.drawTextCentered(FONT, truncateToWidth(FONT, screen.label, 80), LABEL_Y);
  fb.blitBitmap(menuIcon(screen.iconId), ICON_X, ICON_Y);
  drawPositionRail(fb, screen.menuNumber - 1, screen.total);
  drawSoftkey(fb, "Select");
}
