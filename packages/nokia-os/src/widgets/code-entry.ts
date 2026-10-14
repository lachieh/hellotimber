// The stock security-code entry (plan 15 D7, Task 0 A2/A5): the code prompt's first screen with
// a masked entry. Digits append (10 at most), C deletes the last and C held 1 s clears all; C on
// the empty entry goes back in a menu and does nothing at the boot gate. OK submits.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { PromptModel } from "../display/widgets";
import { CODE_ENTRY_MAX_DIGITS, type StockSecurity } from "../firmware/security";
import type { StockWidgetTimeline } from "../resources";
import { WIDGET_TIMELINE_BY_NAME, WIDGET_TIMELINES } from "../resources";
import type { Flow, Widget } from "./flow";
import { note, type NoteSound } from "./note";

/**
 * The note a wrong security code shows (`probe/code-wrong-*` image h; `Code\nerror` in the
 * firmware's string table), then the empty prompt.
 */
export const CODE_ERROR = { lines: ["Code", "error"], timeline: "code-error" } as const;

/** C held this long clears the whole entry (A2/A5: `hold c 1000ms`). */
export const CLEAR_HOLD_MS = 1000;

const DIGITS: readonly PhoneKey[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export interface MaskedEntryOptions {
  /** The prompt's label (tree lines: `Security` / `code:`, `Enter new` / `security code:`). */
  readonly lines: readonly string[];
  readonly softkey: string;
  /** C on the empty entry: back (menus, default) or nothing (the boot gate, A2). */
  readonly onEmptyC?: "back" | "inert";
  /** OK with the digits typed; `clear()` empties the entry. */
  readonly submit: (digits: string, flow: Flow, clear: () => void) => void;
}

class MaskedEntryWidget implements Widget {
  readonly #options: MaskedEntryOptions;
  #digits = "";
  /** How long C has been held, while it is down; undefined when it is up or already used. */
  #heldMs: number | undefined;

  constructor(options: MaskedEntryOptions) {
    this.#options = options;
  }

  render(): PromptModel {
    return {
      kind: "prompt",
      icons: ["prompt/pen"],
      label: this.#options.lines,
      entry: { kind: "mask", digits: this.#digits.length },
      cursor: false,
      softkey: this.#options.softkey,
    };
  }

  onKeyDown(key: PhoneKey): void {
    if (key === "c") this.#heldMs = 0;
  }

  tick(dtMs: number): void {
    if (this.#heldMs === undefined) return;
    this.#heldMs += dtMs;
    if (this.#heldMs < CLEAR_HOLD_MS) return;
    this.#digits = "";
    this.#heldMs = undefined;
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (DIGITS.includes(key)) {
      if (this.#digits.length < CODE_ENTRY_MAX_DIGITS) this.#digits += key;
      return;
    }
    if (key === "c") {
      // A 1 s hold has already cleared the entry with this C.
      const used = this.#heldMs === undefined;
      this.#heldMs = undefined;
      if (used) return;
      if (this.#digits.length > 0) this.#digits = this.#digits.slice(0, -1);
      else if ((this.#options.onEmptyC ?? "back") === "back") flow.back();
      return;
    }
    if (key === "navi") {
      this.#options.submit(this.#digits, flow, () => {
        this.#digits = "";
      });
    }
  }
}

/** A masked digit entry with the code prompt's layout (Change security code's new codes). */
export function maskedEntry(options: MaskedEntryOptions): Widget {
  return new MaskedEntryWidget(options);
}

/** The `Code error` note's captured timeline (`probe/code-wrong-6-4`: 2904 ms, then back). */
export function codeErrorTimeline(): StockWidgetTimeline {
  const id = WIDGET_TIMELINE_BY_NAME[CODE_ERROR.timeline];
  const found = id === undefined ? undefined : WIDGET_TIMELINES[id];
  if (found === undefined) throw new Error(`No widget timeline "${CODE_ERROR.timeline}".`);
  return found;
}

/** `Code error`, then the screen below (the empty prompt, B), with its warning tone (D12). */
export function codeError(
  timeline: StockWidgetTimeline = codeErrorTimeline(),
  sound?: NoteSound,
): Widget {
  return note({ lines: CODE_ERROR.lines, timeline, ...(sound === undefined ? {} : { sound }) });
}

export interface CodeEntryOptions {
  readonly lines: readonly string[];
  readonly softkey: string;
  readonly security: StockSecurity;
  /** What an accepted code opens (it replaces the entry, or the flow leaves). */
  readonly accepted: (flow: Flow) => void;
  readonly onEmptyC?: "back" | "inert";
  /** The `Code error` timeline (default the in-menu one; the boot gate has its own, plan 15 Task 8). */
  readonly error?: StockWidgetTimeline;
  /** Plan 16: `Code error`'s warning tone. */
  readonly sound?: NoteSound;
}

/**
 * The security-code entry of every security-code leaf (D7): OK verifies the entry; a wrong code
 * shows `Code error` and returns to the empty prompt (A4), an accepted one calls `accepted`.
 */
export function codeEntry(options: CodeEntryOptions): Widget {
  const error = options.error ?? codeErrorTimeline();
  return maskedEntry({
    lines: options.lines,
    softkey: options.softkey,
    ...(options.onEmptyC === undefined ? {} : { onEmptyC: options.onEmptyC }),
    submit(digits, flow, clear) {
      if (options.security.verify(digits)) {
        options.accepted(flow);
        return;
      }
      clear();
      flow.push(codeError(error, options.sound));
    },
  });
}
