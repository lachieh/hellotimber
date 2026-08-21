import type { MenuIndicator } from "@hellotimber/phone-core";
import { MENU_INDICATOR_FONT } from "../font/clock";
import { FONT, textWidth } from "../font/font";
import type { PixelFont } from "../font/font";
import type { Framebuffer } from "../framebuffer";

// Spec §2 display zones on the 84×48 LCD.
export const TITLE_Y = 0; // status/title row: y 0–7
export const CONTENT_TOP = 8; // content area: y 8–39
export const SOFTKEY_Y = 41; // softkey label: y 41–47
export const LINE_CHARS = 14; // 14 × 6px advance = 84px

/** Clamp to `max` chars, replacing the tail with '…' when too long. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, max - 1).join("")}…`;
}

/** Truncate to a rendered pixel width, including the ellipsis advance. */
export function truncateToWidth(font: PixelFont, text: string, maxWidth: number): string {
  if (textWidth(font, text) <= maxWidth) return text;
  const ellipsis = "…";
  const ellipsisWidth = textWidth(font, ellipsis);
  let result = "";
  for (const character of text) {
    if (textWidth(font, result + character) + ellipsisWidth > maxWidth) break;
    result += character;
  }
  return result + ellipsis;
}

/** Greedy word-wrap at `width` chars; hard-breaks longer words; '\n' = paragraph. */
export function wrapText(text: string, width = LINE_CHARS): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      let w = word;
      while (w.length > width) {
        if (line !== "") {
          lines.push(line);
          line = "";
        }
        lines.push(w.slice(0, width));
        w = w.slice(width);
      }
      if (line === "") line = w;
      else if (line.length + 1 + w.length <= width) line = `${line} ${w}`;
      else {
        lines.push(line);
        line = w;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Centered title on the top row. */
export function drawTitle(fb: Framebuffer, title: string): void {
  fb.drawTextCentered(FONT, truncate(title, LINE_CHARS), TITLE_Y);
}

/**
 * The ONE NaviKey label, bottom-center. The 3310 has a single softkey —
 * never draw two labels (spec §4).
 */
export function drawSoftkey(fb: Framebuffer, label: string): void {
  fb.drawTextCentered(FONT, label, SOFTKEY_Y);
}

/** Right-aligned text: the string's last pixel column lands on `xEnd`. */
export function drawTextRight(fb: Framebuffer, text: string, xEnd: number, y: number): void {
  fb.drawText(FONT, text, xEnd - textWidth(FONT, text) + 1, y);
}

export function formatMenuIndicator(indicator: MenuIndicator): string {
  const parts = indicator.segments.map(String);
  if (indicator.awaitingNext && parts.length > 0) parts.push("_");
  return parts.join(" • ");
}

export function drawMenuIndicator(fb: Framebuffer, indicator: MenuIndicator): void {
  const text = formatMenuIndicator(indicator);
  fb.drawText(MENU_INDICATOR_FONT, text, 84 - textWidth(MENU_INDICATOR_FONT, text), 0);
}

/** Draw the rail, two connector pixels, and five-pixel outer bump. */
export function drawPositionRail(fb: Framebuffer, index: number, total: number): void {
  const trackTop = CONTENT_TOP;
  const trackH = 32; // y 8–39
  const bumpH = 7;
  const offset = Math.round((index * (trackH - bumpH)) / Math.max(1, total - 1));
  const bumpTop = trackTop + offset;
  fb.fillRect(81, trackTop, 1, trackH, 1);
  fb.fillRect(81, bumpTop + 1, 1, 5, 0);
  fb.setPixel(82, bumpTop, 1);
  fb.fillRect(83, bumpTop + 1, 1, 5, 1);
  fb.setPixel(82, bumpTop + 6, 1);
}
