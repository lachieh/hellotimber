// Plan 21 D10: what standby draws for the clock: the 12-hour mark after the time (am high, pm
// low) and the indicators left of it (stopwatch, countdown, alarm), measured on the plan21
// standby stills.
import type { ScreenModel } from "@hellotimber/phone-core";
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../resources";

/** The clock's last digit cell ends here (display/standby.ts). */
const CLOCK_END = 78;
/** A 12-hour clock's digits end this far left of CLOCK_END; the mark fills the gap. */
const MARK_WIDTH = 4;
/** Without a clock the indicators end here (plan21 restore/screens before-standby: the alarm at x 70-75). */
const NO_CLOCK_END = 76;
/** The indicators end this far left of the clock's first cell. */
const CLOCK_GAP = 5;
/** Between two indicators. */
const ICON_GAP = 3;

/** The clock's text and mark: `01:07 pm` → `01:07` and the pm mark. */
export function splitClock(clock: string): { digits: string; mark?: "am" | "pm" } {
  const match = /^(.*) (am|pm)$/.exec(clock);
  return match === null ? { digits: clock } : { digits: match[1]!, mark: match[2] as "am" | "pm" };
}

/** The x of the clock's first cell (where its digits start). */
export function clockLeft(clock: string): number {
  const { digits, mark } = splitClock(clock);
  return CLOCK_END - (mark === undefined ? 0 : MARK_WIDTH) - textWidth(STOCK_FONTS.digits, digits);
}

export function paintClock(fb: Framebuffer, clock: string): void {
  const { digits, mark } = splitClock(clock);
  fb.drawText(STOCK_FONTS.digits, digits, clockLeft(clock), 0);
  if (mark !== undefined) {
    const sprite = WIDGET_SPRITES[`clock/${mark}`]!;
    fb.blitBitmap(sprite.bitmap, sprite.x, sprite.y);
  }
}

/** The stopwatch, countdown and alarm indicators, right to left from the clock. */
export function paintClockIndicators(
  fb: Framebuffer,
  screen: Extract<ScreenModel, { kind: "standby" }>,
): void {
  const flags = screen.indicators;
  if (flags === undefined) return;
  let right = screen.clock === undefined ? NO_CLOCK_END : clockLeft(screen.clock) - CLOCK_GAP;
  for (const [flag, id] of [
    ["alarm", "clock/alarm"],
    ["timer", "clock/timer"],
    ["stopwatch", "clock/stopwatch"],
  ] as const) {
    if (!flags[flag]) continue;
    const sprite = WIDGET_SPRITES[id]!;
    const x = right - sprite.bitmap.width;
    fb.blitBitmap(sprite.bitmap, x, 0);
    right = x - ICON_GAP;
  }
}
