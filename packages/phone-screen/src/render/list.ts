import type { ScreenModel } from "@hellotimber/phone-core";
import { MENU_INDICATOR_FONT } from "../font/clock";
import { FONT, textWidth } from "../font/font";
import type { Framebuffer } from "../framebuffer";
import {
  drawMenuIndicator,
  drawPositionRail,
  drawSoftkey,
  drawTitle,
  formatMenuIndicator,
  truncateToWidth,
} from "./layout";

type ListScreen = Extract<ScreenModel, { kind: "list" }>;
type ReaderScreen = Extract<ScreenModel, { kind: "reader" }>;

const ROW_YS = [9, 19, 29] as const;
const VISIBLE_ROWS = 3;
const LABEL_MAX_WIDTH = 76; // starts x=2, ends by x=77; x=78..80 is the rail gap

function windowTop(selected: number, count: number): number {
  return Math.min(Math.max(0, selected - 1), Math.max(0, count - VISIBLE_ROWS));
}

export function renderList(fb: Framebuffer, screen: ListScreen): void {
  fb.clear(0);
  if (screen.menuIndicator === undefined) drawTitle(fb, screen.title);
  else drawMenuIndicator(fb, screen.menuIndicator);

  const top = windowTop(screen.selected, screen.items.length);
  for (let row = 0; row < VISIBLE_ROWS; row++) {
    const index = top + row;
    const item = screen.items[index];
    if (item === undefined) break;
    const y = ROW_YS[row]!;
    const label = truncateToWidth(FONT, item, LABEL_MAX_WIDTH);
    if (index === screen.selected) {
      fb.fillRect(0, y - 1, 78, 10, 1);
      fb.drawText(FONT, label, 2, y, { color: 0 });
    } else {
      fb.drawText(FONT, label, 2, y);
    }
  }

  if (screen.menuIndicator !== undefined || screen.items.length > VISIBLE_ROWS) {
    drawPositionRail(fb, screen.selected, screen.items.length);
  }
  drawSoftkey(fb, screen.softkey);
}

export function renderReader(fb: Framebuffer, screen: ReaderScreen): void {
  fb.clear(0);
  if (screen.menuIndicator === undefined) {
    drawTitle(fb, screen.title);
  } else {
    const indicatorWidth = textWidth(
      MENU_INDICATOR_FONT,
      formatMenuIndicator(screen.menuIndicator),
    );
    const titleAreaWidth = Math.max(0, 83 - indicatorWidth);
    const title = truncateToWidth(FONT, screen.title, titleAreaWidth);
    fb.drawText(FONT, title, Math.floor((titleAreaWidth - textWidth(FONT, title)) / 2), 0);
    drawMenuIndicator(fb, screen.menuIndicator);
  }
  const visible = screen.lines.slice(screen.scrollTop, screen.scrollTop + VISIBLE_ROWS);
  visible.forEach((line, index) => {
    fb.drawText(FONT, truncateToWidth(FONT, line, 78), 1, ROW_YS[index]!);
  });
  if (screen.scrollTop > 0) fb.drawText(FONT, "▲", 79, ROW_YS[0]!);
  if (screen.scrollTop + VISIBLE_ROWS < screen.lines.length) {
    fb.drawText(FONT, "▼", 79, ROW_YS[2]!);
  }
  drawSoftkey(fb, "Back");
}
