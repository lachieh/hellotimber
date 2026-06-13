import { FONT, textWidth } from "../font/font";
import type { Framebuffer } from "../framebuffer";

// Spec §2 display zones on the 84×48 LCD.
export const TITLE_Y = 0; // status/title row: y 0–7
export const CONTENT_TOP = 8; // content area: y 8–39
export const SOFTKEY_Y = 41; // softkey label: y 41–47
export const LINE_CHARS = 14; // 14 × 6px advance = 84px

/** Clamp to `max` chars, replacing the tail with '…' when too long. */
export function truncate(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  return `${chars.slice(0, max - 1).join("")}…`;
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

/**
 * Right-edge scroll/position indicator (spec §5): 1px track at x=83 over
 * the content area, 3px-wide thumb showing index/total.
 */
export function drawScrollIndicator(fb: Framebuffer, index: number, total: number): void {
  const trackTop = CONTENT_TOP;
  const trackH = 32; // y 8–39
  fb.fillRect(83, trackTop, 1, trackH, 1);
  const thumbH = Math.max(4, Math.floor(trackH / Math.max(1, total)));
  const maxOffset = trackH - thumbH;
  const offset = total <= 1 ? 0 : Math.round((index * maxOffset) / (total - 1));
  fb.fillRect(81, trackTop + offset, 3, thumbH, 1);
}
