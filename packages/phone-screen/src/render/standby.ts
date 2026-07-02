import type { ScreenModel } from "@hellotimber/phone-core";
import { FONT } from "../font/font";
import type { Framebuffer } from "../framebuffer";
import { drawBatteryLevel, drawSignalLevel, ENVELOPE_ICON } from "../icons/status";
import { CONTENT_TOP, drawSoftkey, drawTextRight, truncate, wrapText } from "./layout";

type StandbyScreen = Extract<ScreenModel, { kind: "standby" }>;

/** The operator line renders in the body font like the real phone (spec §4;
 *  the v1 2x-scaled variant read far larger than the reference renders). */
const CARRIER_MAX_CHARS = 14;
const CARRIER_Y = 12;
const CLOCK_Y = 32; // best guess: lower-right, under the battery stack (spec §4)
const CLOCK_X_END = 79; // clear of the battery rungs at x 81–83

const NOTICE_ICON_X = 4; // clear of the signal rungs at x 0–2
const NOTICE_TEXT_X = 14; // 8px envelope + 2px gap
const NOTICE_WRAP_CHARS = 11; // (84 − 14) / 6px advance
const NOTICE_MAX_LINES = 3;
const CONTENT_H = 32; // content area y 8–39

export function renderStandby(fb: Framebuffer, screen: StandbyScreen): void {
  fb.clear(0);
  drawSignalLevel(fb, screen.signal);
  drawBatteryLevel(fb, screen.battery);
  if (screen.notice !== undefined) {
    // The notice takes over the content area (carrier and clock make way),
    // like the real phone's "1 message received" screen; the bars stay.
    const lines = wrapText(screen.notice.text, NOTICE_WRAP_CHARS).slice(0, NOTICE_MAX_LINES);
    const top = CONTENT_TOP + Math.floor((CONTENT_H - lines.length * 8) / 2);
    fb.blitBitmap(ENVELOPE_ICON, NOTICE_ICON_X, top + Math.floor((lines.length * 8 - 8) / 2));
    lines.forEach((line, i) => {
      fb.drawText(FONT, line, NOTICE_TEXT_X, top + i * 8);
    });
    drawSoftkey(fb, screen.notice.softkey);
    return;
  }
  fb.drawTextCentered(FONT, truncate(screen.carrier, CARRIER_MAX_CHARS), CARRIER_Y);
  if (screen.clock !== undefined) drawTextRight(fb, screen.clock, CLOCK_X_END, CLOCK_Y);
  drawSoftkey(fb, "Menu");
}
