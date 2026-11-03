import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../resources";

const LINE_TOPS = [7, 16, 25] as const;
/** Label lines start at x 0 and must end before the rail's gap at x 80. */
const PAGE_WIDTH = 80;
const VALUE_TOP = 29;
/** The value's last thin-font cell ends here (ink ends at x 76). */
const VALUE_END = 78;

/**
 * A pages submenu (Messages, Call register, Tones, Settings, Call divert, Clock): one item per
 * screen. The label's firmware lines (`\n`, D10) sit at tops 7/16/25 from x 0, and the item's
 * current value, if any, is right-aligned in the thin font at top 29. A line wider than the page
 * or a fourth line throws and names the label: the firmware never wraps.
 */
export function paintPage(fb: Framebuffer, label: string | undefined, detail?: string): void {
  if (label !== undefined) {
    const lines = label.split("\n");
    if (lines.length > LINE_TOPS.length) {
      throw new Error(
        `Page label ${JSON.stringify(label)} has ${lines.length} lines; a page holds 3.`,
      );
    }
    lines.forEach((line, i) => {
      const width = textWidth(STOCK_FONTS.small, line);
      if (width > PAGE_WIDTH) {
        throw new Error(
          `Page label ${JSON.stringify(label)}: line "${line}" is ${width} px wide; a page holds ${PAGE_WIDTH}.`,
        );
      }
      fb.drawText(STOCK_FONTS.small, line, 0, LINE_TOPS[i]!);
    });
  }
  if (detail !== undefined) {
    fb.drawText(
      STOCK_FONTS.thin,
      detail,
      VALUE_END - textWidth(STOCK_FONTS.thin, detail),
      VALUE_TOP,
    );
  }
}
