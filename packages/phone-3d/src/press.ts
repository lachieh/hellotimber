/** A touch press must stay within this many CSS pixels of where it started. */
export const TOUCH_SLOP_PX = 10;
/** A touch press emits "down" once it has stayed this long within the slop. */
export const TOUCH_PRESS_DELAY_MS = 110;

/** One pointer's press on one key, fed the pointer's later events. */
export interface KeyPress {
  move(x: number, y: number): void;
  up(): void;
  cancel(): void;
}

/**
 * Decides what a pointer press on a key emits. Mouse and pen press at once.
 * A touch may be the start of a page scroll, so its "down" waits until the
 * finger has rested for TOUCH_PRESS_DELAY_MS or lifts; moving past
 * TOUCH_SLOP_PX or a pointercancel before then drops the press silently.
 * Once "down" is emitted, lifting or cancelling emits "up".
 */
export function startPress(
  pointerType: string,
  x: number,
  y: number,
  emit: (action: "down" | "up") => void,
): KeyPress {
  let state: "pending" | "down" | "done" = "pending";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const press = () => {
    if (state !== "pending") return;
    clearTimeout(timer);
    state = "down";
    emit("down");
  };
  const end = () => {
    clearTimeout(timer);
    if (state === "down") emit("up");
    state = "done";
  };

  if (pointerType === "touch") timer = setTimeout(press, TOUCH_PRESS_DELAY_MS);
  else press();

  return {
    move(mx, my) {
      if (state === "pending" && Math.hypot(mx - x, my - y) > TOUCH_SLOP_PX) end();
    },
    up() {
      press();
      end();
    },
    cancel: end,
  };
}
