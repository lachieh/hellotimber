import type { ScreenModel } from "@hellotimber/phone-core";
import { CLOCK_FONT } from "../font/clock";
import { FONT, textWidth } from "../font/font";
import type { Framebuffer } from "../framebuffer";
import { drawBatteryLevel, drawSignalLevel, SMS_ICON, VOICEMAIL_ICON } from "../icons/status";
import { CONTENT_TOP, drawSoftkey, truncateToWidth, wrapText } from "./layout";

type StandbyScreen = Extract<ScreenModel, { kind: "standby" }>;

const CARRIER_MAX_WIDTH = 74; // x=5..78, clear of both side ladders
const CARRIER_Y = 8;
const CLOCK_X_END = 75;
const CLOCK_Y = 0;
const NOTIFICATION_X = 7;
const NOTIFICATION_GAP = 2;

const NOTICE_ICON_X = 6;
const NOTICE_TEXT_X = 16;
const NOTICE_WRAP_CHARS = 11;
const NOTICE_MAX_LINES = 3;
const CONTENT_H = 32;

export function renderStandby(fb: Framebuffer, screen: StandbyScreen): void {
  fb.clear(0);
  drawSignalLevel(fb, screen.signal);
  drawBatteryLevel(fb, screen.battery);
  if (screen.notice !== undefined) {
    const lines = wrapText(screen.notice.text, NOTICE_WRAP_CHARS).slice(0, NOTICE_MAX_LINES);
    const top = CONTENT_TOP + Math.floor((CONTENT_H - lines.length * 8) / 2);
    fb.blitBitmap(SMS_ICON, NOTICE_ICON_X, top + Math.floor((lines.length * 8 - 6) / 2));
    lines.forEach((line, index) => {
      fb.drawText(FONT, line, NOTICE_TEXT_X, top + index * 8);
    });
    drawSoftkey(fb, screen.notice.softkey);
    return;
  }

  let notificationX = NOTIFICATION_X;
  if (screen.indicators?.voicemail === true) {
    fb.blitBitmap(VOICEMAIL_ICON, notificationX, 0);
    notificationX += VOICEMAIL_ICON.width + NOTIFICATION_GAP;
  }
  if (screen.indicators?.message === true) fb.blitBitmap(SMS_ICON, notificationX, 0);

  fb.drawTextCentered(FONT, truncateToWidth(FONT, screen.carrier, CARRIER_MAX_WIDTH), CARRIER_Y);
  if (screen.clock !== undefined) {
    fb.drawText(
      CLOCK_FONT,
      screen.clock,
      CLOCK_X_END - textWidth(CLOCK_FONT, screen.clock) + 1,
      CLOCK_Y,
    );
  }
  drawSoftkey(fb, "Menu");
}
