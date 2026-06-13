import type { ScreenModel } from "@hellotimber/phone-core";
import { FONT } from "../font/font";
import type { Framebuffer } from "../framebuffer";
import { drawScrollIndicator, drawSoftkey, drawTitle, truncate } from "./layout";

type ListScreen = Extract<ScreenModel, { kind: "list" }>;
type ReaderScreen = Extract<ScreenModel, { kind: "reader" }>;

/** Three content rows: text at y 9/19/29, selection bars at y−1 … y+7. */
const ROW_YS = [9, 19, 29] as const;
const VISIBLE_ROWS = 3;
const ROW_CHARS = 13; // leaves x 81–83 free for the scroll indicator

/** First visible index: keep the selection on the middle row when possible. */
function windowTop(selected: number, count: number): number {
  return Math.min(Math.max(0, selected - 1), Math.max(0, count - VISIBLE_ROWS));
}

export function renderList(fb: Framebuffer, screen: ListScreen): void {
  fb.clear(0);
  drawTitle(fb, screen.title);
  const top = windowTop(screen.selected, screen.items.length);
  for (let row = 0; row < VISIBLE_ROWS; row++) {
    const index = top + row;
    const item = screen.items[index];
    if (item === undefined) break;
    const y = ROW_YS[row]!;
    const label = truncate(item, ROW_CHARS);
    if (index === screen.selected) {
      fb.fillRect(0, y - 1, fb.width, 9, 1); // inverted-video selection bar
      fb.drawText(FONT, label, 2, y, { color: 0 });
    } else {
      fb.drawText(FONT, label, 2, y);
    }
  }
  if (screen.items.length > VISIBLE_ROWS) {
    drawScrollIndicator(fb, screen.selected, screen.items.length);
  }
  drawSoftkey(fb, screen.softkey);
}

export function renderReader(fb: Framebuffer, screen: ReaderScreen): void {
  fb.clear(0);
  drawTitle(fb, screen.title);
  const visible = screen.lines.slice(screen.scrollTop, screen.scrollTop + VISIBLE_ROWS);
  visible.forEach((line, i) => {
    fb.drawText(FONT, truncate(line, ROW_CHARS), 1, ROW_YS[i]!);
  });
  if (screen.scrollTop > 0) fb.drawText(FONT, "▲", 79, ROW_YS[0]!);
  if (screen.scrollTop + VISIBLE_ROWS < screen.lines.length) {
    fb.drawText(FONT, "▼", 79, ROW_YS[2]!);
  }
  drawSoftkey(fb, "Back");
}
