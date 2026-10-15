// The phone book's timings that no single golden fixes (plan 19 Task 0's medians over several
// captures; one of each is imported). The notes' timelines are generated
// (`WIDGET_TIMELINE_BY_NAME`, scripts/resource-inputs/19-phone-book.ts).

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
