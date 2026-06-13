import type { ScreenModel } from "@hellotimber/phone-core";
import { FONT } from "../font/font";
import type { Framebuffer } from "../framebuffer";
import { drawBatteryLevel, drawSignalLevel } from "../icons/status";
import { drawSoftkey, drawTextRight, truncate } from "./layout";

type StandbyScreen = Extract<ScreenModel, { kind: "standby" }>;

/** Max carrier chars at 2x scale: 7 × 12px advance − 2 = 82px ≤ 84. */
const CARRIER_MAX_CHARS = 7;
const CARRIER_Y = 10;
const CLOCK_Y = 32; // best guess: lower-right, under the battery stack (spec §4)
const CLOCK_X_END = 79; // clear of the battery rungs at x 81–83

export function renderStandby(fb: Framebuffer, screen: StandbyScreen): void {
  fb.clear(0);
  drawSignalLevel(fb, screen.signal);
  drawBatteryLevel(fb, screen.battery);
  fb.drawTextCentered(FONT, truncate(screen.carrier, CARRIER_MAX_CHARS), CARRIER_Y, {
    scale: 2,
  });
  if (screen.clock !== undefined) drawTextRight(fb, screen.clock, CLOCK_X_END, CLOCK_Y);
  drawSoftkey(fb, "Menu");
}
