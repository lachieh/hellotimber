// The stock text-input prompt (plan 18 D4): plan 14's text prompt made editable. Its label and
// box are the prompt's; the text is a multi-tap entry (`TextEntry`) drawn large in the box, the
// header shows the pen and the entry's mode. OK gives the text; C on the empty text goes back;
// * opens the symbol table (`text/input`: Send by set › Set 1 › Alphanumeric's Routing address).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { PromptModel } from "../display/widgets";
import { shownMode, type TextMode } from "../text/multitap";
import { MODE_SPRITES, openSymbols } from "./editor";
import type { Flow, Widget } from "./flow";
import { TextEntry } from "./text-entry";

export interface TextInputOptions {
  /** The label lines (`Routing address:`). */
  readonly label: readonly string[];
  /** The most characters the text holds. */
  readonly limit: number;
  /** Draw the characters left, top right (Add name's `16`); default none (Routing address). */
  readonly counter?: boolean;
  readonly text?: string;
  /** The entry's first mode (Routing address starts in ABC, `text/input` routing-00). */
  readonly mode?: TextMode;
  /** Default `OK`. */
  readonly softkey?: string;
  /** OK with the text. */
  readonly done: (text: string, flow: Flow) => void;
}

class TextInputWidget implements Widget {
  readonly #options: TextInputOptions;
  readonly #entry: TextEntry;

  constructor(options: TextInputOptions) {
    this.#options = options;
    this.#entry = new TextEntry({
      limit: options.limit,
      ...(options.text === undefined ? {} : { text: options.text }),
      ...(options.mode === undefined ? {} : { mode: options.mode }),
    });
  }

  render(): PromptModel {
    const { state, cursorShown } = this.#entry;
    const length = Array.from(state.text).length;
    return {
      kind: "prompt",
      icons: ["prompt/pen", MODE_SPRITES[shownMode(state)]],
      ...(this.#options.counter ? { counter: String(this.#options.limit - length) } : {}),
      label: this.#options.label,
      entry: {
        kind: "text",
        text: state.text,
        ...(state.pending === null ? { cursor: state.cursor } : {}),
      },
      cursor: cursorShown,
      softkey: this.#options.softkey ?? "OK",
    };
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    const request = this.#entry.keyDown(key);
    if (request === "empty-c") flow.back();
    if (request === "symbols") openSymbols(flow, this.#entry.control());
  }

  onKey(key: PhoneKey, flow: Flow): void {
    this.#entry.keyUp(key);
    if (key === "navi") this.#options.done(this.#entry.text, flow);
  }

  tick(dtMs: number): void {
    this.#entry.tick(dtMs);
  }
}

/** A text prompt whose text is typed with multi-tap (plan 18 D4). */
export function textInput(options: TextInputOptions): Widget {
  return new TextInputWidget(options);
}
