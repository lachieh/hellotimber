// The stock text-input prompt (plan 18 D4): plan 14's text prompt made editable. Its label and
// box are the prompt's; the text is a multi-tap entry (`TextEntry`) drawn large in the box, the
// header shows the pen and the entry's mode. OK gives the text; C on the empty text goes back;
// * opens the symbol table (`text/input`: Send by set › Set 1 › Alphanumeric's Routing address).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { PromptModel } from "../display/widgets";
import type { StockWidgetTimeline } from "../resources";
import { shownMode, type TextMode, type TextState } from "../text/multitap";
import { MODE_SPRITES, openSymbols } from "./editor";
import type { Flow, Widget } from "./flow";
import { isTextKey } from "../text/keys";
import { HeldC } from "./held-c";
import { TextEntry } from "./text-entry";

export interface TextInputOptions {
  /** The label lines (`Routing address:`). */
  readonly label: readonly string[];
  /** The most characters the text holds. */
  readonly limit: number;
  /**
   * Draw the characters left, top right (Add name's `16`); default none (Routing address). A
   * function draws its text for the typed length (plan 18b: Insert word counts the message's
   * characters, `459/1`).
   */
  readonly counter?: boolean | ((length: number) => string);
  readonly text?: string;
  /** The entry's first mode (Routing address starts in ABC, `text/input` routing-00). */
  readonly mode?: TextMode;
  /** Default `OK`. */
  readonly softkey?: string;
  /**
   * Plan 19: a text wider than the large face's box drops to small-face lines (Add name's
   * `Name:`, `phone-book/add-limits`, `add-wide`).
   */
  readonly smallWhenWide?: boolean;
  /** Plan 19: no cursor (Search's `Name:`, S4). */
  readonly noCursor?: boolean;
  /** Plan 19: the cursor's blink from the node's own recording (plan 14 P9; Add name's 1-3). */
  readonly blink?: StockWidgetTimeline;
  /**
   * Plan 19: the header's mode changes when the next character is typed, not at a commit, and
   * returns to the start's when the text empties (the phone book's `Name:`: one letter keeps
   * `Abc`, `phone-book/search-c`; `An` shows `abc`).
   */
  readonly typedCase?: boolean;
  /** Plan 19: what the counter counts (a SIM name's `€` takes two bytes, `add/chars-euro`). */
  readonly counted?: (text: string) => number;
  /**
   * Plan 19: C on the empty text leaves at its down (the phone book's `Name:`: the level 82 ms
   * after the down while C is still held, `phone-book/search-prompt-hold-c`).
   */
  readonly leaveAtDown?: boolean;
  /** OK with the text. */
  readonly done: (text: string, flow: Flow) => void;
  /** Plan 17: a commit restarts the cursor's blink (Rename's prompt). */
  readonly restartBlinkOnCommit?: boolean;
  /**
   * Plan 21: a character key that changes the text, and the prompt's return to the top, restart
   * the cursor's blink, shown (Remind about: `reminders/text`, `add-choice-c`; C and a key past
   * the limit keep its phase, `add-c-text`, text-36).
   */
  readonly restartBlinkOnKey?: boolean;
}

function counterOf(
  counter: TextInputOptions["counter"],
  limit: number,
  length: number,
): { counter?: string } {
  if (typeof counter === "function") return { counter: counter(length) };
  return counter ? { counter: String(limit - length) } : {};
}

class TextInputWidget implements Widget {
  readonly #options: TextInputOptions;
  readonly #entry: TextEntry;
  readonly #emptyC = new HeldC();
  /** `typedCase`: the mode the header shows, and the state it was last updated from. */
  #shown: TextMode | undefined;
  #seen: TextState | undefined;

  constructor(options: TextInputOptions) {
    this.#options = options;
    this.#entry = new TextEntry({
      limit: options.limit,
      ...(options.text === undefined ? {} : { text: options.text }),
      ...(options.mode === undefined ? {} : { mode: options.mode }),
      ...(options.blink === undefined ? {} : { blink: options.blink }),
      ...(options.restartBlinkOnCommit ? { restartBlinkOnCommit: true } : {}),
    });
    if (options.typedCase) {
      this.#seen = this.#entry.state;
      this.#shown = shownMode(this.#seen);
    }
  }

  /**
   * `typedCase`: a character typed (or a symbol inserted, a pending one cycled or committed)
   * shows the mode it was typed in; a case change (`#` acts at its release) or the empty text
   * shows the entry's mode.
   */
  #updateShown(state: TextState): void {
    const seen = this.#seen;
    if (seen === undefined || seen === state) return;
    if (state.text === "" || state.mode !== seen.mode) this.#shown = shownMode(state);
    else if (Array.from(state.text).length >= Array.from(seen.text).length) {
      if (state.text !== seen.text || state.pending !== seen.pending) this.#shown = shownMode(seen);
    }
    this.#seen = state;
  }

  render(): PromptModel {
    const { state, cursorShown } = this.#entry;
    this.#updateShown(state);
    const length = this.#options.counted?.(state.text) ?? Array.from(state.text).length;
    return {
      kind: "prompt",
      icons: ["prompt/pen", MODE_SPRITES[this.#shown ?? shownMode(state)]],
      ...counterOf(this.#options.counter, this.#options.limit, length),
      label: this.#options.label,
      entry: {
        kind: "text",
        text: state.text,
        ...(state.pending === null ? { cursor: state.cursor } : {}),
        ...(this.#options.smallWhenWide ? { smallWhenWide: true as const } : {}),
      },
      cursor: cursorShown && this.#options.noCursor !== true,
      softkey: this.#options.softkey ?? "OK",
    };
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    const before = this.#entry.state;
    const request = this.#entry.keyDown(key);
    if (this.#options.restartBlinkOnKey && isTextKey(key) && this.#entry.state !== before) {
      this.#entry.restartBlink();
    }
    if (request === "empty-c" && this.#options.leaveAtDown) flow.back();
    else if (request === "empty-c") this.#emptyC.down();
    if (request === "symbols") openSymbols(flow, this.#entry.control());
  }

  onKey(key: PhoneKey, flow: Flow): void {
    this.#entry.keyUp(key);
    if (key === "navi") this.#options.done(this.#entry.text, flow);
    if (key === "c") this.#emptyC.up(flow);
  }

  reveal(): void {
    if (this.#options.restartBlinkOnKey) this.#entry.restartBlink();
  }

  tick(dtMs: number, flow: Flow): void {
    this.#entry.tick(dtMs);
    this.#emptyC.tick(dtMs, flow);
  }
}

/** A text prompt whose text is typed with multi-tap (plan 18 D4). */
export function textInput(options: TextInputOptions): Widget {
  return new TextInputWidget(options);
}
