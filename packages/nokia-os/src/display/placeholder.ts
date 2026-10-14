import { Framebuffer, type Bitmap } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../resources";
import { paintDottedBorder } from "./unsupported";

/** Line pitch of a multi-line label, as on stock pages (tops 7/16/25). */
const LINE_PITCH = 9;

/**
 * The frame a not-yet-implemented leaf shows (D13): the dotted border the firmware never draws,
 * and the entry label in the small font, one centred line per firmware line break.
 */
export function placeholderFrame(label: string): Bitmap {
  const fb = new Framebuffer();
  paintDottedBorder(fb);
  const lines = label.split("\n");
  const top = Math.floor((fb.height - lines.length * LINE_PITCH) / 2);
  lines.forEach((line, i) => fb.drawTextCentered(STOCK_FONTS.small, line, top + i * LINE_PITCH));
  return { width: fb.width, height: fb.height, pixels: fb.pixels };
}
