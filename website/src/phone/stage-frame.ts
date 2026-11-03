/** Phones and narrow windows: the phone fills 95% of the screen's limiting side (desk.css). */
export const MOBILE = "(max-width: 899px)";

/**
 * The phone's canvas overscans its stage by this much each way, centred on it (styles.css
 * `.phone-fill`), so the phone leaping and pitching out of the desk isn't cut off at the stage's
 * edges. The phone is framed smaller in proportion, so on screen it keeps its size.
 */
export const OVERSCAN = 1.6;

/** How much of the stage's limiting side the phone spans: desktop (desk.css `--d01-stage`), mobile. */
const DESK_SPAN = 0.87;
const MOBILE_SPAN = 0.95;

/** The `fit` for the stage and sketch in the overscanned canvas. */
export const DESK_FIT = DESK_SPAN / OVERSCAN;
export const MOBILE_FIT = MOBILE_SPAN / OVERSCAN;
