// The phone book's timings that no single golden fixes (plan 19 Task 0's medians over several
// captures; one of each is imported). The notes' timelines are generated
// (`WIDGET_TIMELINE_BY_NAME`, scripts/resource-inputs/19-phone-book.ts).
import type { SoundProgram } from "../sound/program";

/**
 * Standby ▲/▼ show standby with the ladders erased this long before their target (16 presses
 * in `plan19/standby/`: 22-37 ms, median 23; `phone-book/standby-delay` is one).
 */
export const STANDBY_KEY_DELAY_MS = 23;

/**
 * `Sending b'card` lasts at least this long before `Business card sent` (six sends in
 * `plan19/bcard/`: 3237.4-3358.5 ms, median 3240; the synthetic cell's link time, plan 18 D10's
 * policy; UNVERIFIED on a live network).
 */
export const BCARD_LINK_MS = 3240;

/**
 * Assign tone's `No tone` preview: a 1750 Hz tone for 339 ms on the tone generator's word 0x9104
 * (`sound/phone-book/tone-preview-no-tone`, 999-1338 ms after ▲), at the list's preview delay.
 */
export const NO_TONE_PREVIEW: SoundProgram = {
  id: "phone-book/no-tone",
  steps: [{ ms: 339, tone: { hz: 1750, volume: 0x9104 } }],
};
