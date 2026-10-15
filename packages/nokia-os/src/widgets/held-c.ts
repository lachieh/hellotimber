// C on a plan 18 screen that C leaves (an empty editor or text input, a message list, a message's
// pages): back to the screen below as it comes up (`text/delete-empty`: the page 13 ms after the
// up), or, held for the kernel's long press, standby. The firmware leaves at the down and its
// menu's long press goes on to standby (the captures' `hold c` from an empty editor, a list); a
// kernel application cannot hand a held key to the menu (phone-core), so the screen times it.
import { LONG_PRESS_MS } from "@hellotimber/phone-core";
import type { Flow } from "./flow";

export class HeldC {
  #heldMs: number | undefined;

  /** C went down where C leaves. */
  down(): void {
    this.#heldMs = 0;
  }

  up(flow: Flow): void {
    if (this.#heldMs === undefined) return;
    this.#heldMs = undefined;
    flow.back();
  }

  tick(dtMs: number, flow: Flow): void {
    if (this.#heldMs === undefined) return;
    this.#heldMs += dtMs;
    if (this.#heldMs < LONG_PRESS_MS) return;
    this.#heldMs = undefined;
    flow.standby();
  }
}
