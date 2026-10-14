// The stock number entry (plan 18 D4, Task 0 N): plan 14's number prompt made editable
// (`text/number`: Write messages › Options › Send's `Phone number:`). Digits and # type at once
// on key-down; * cycles `* + p w`, pending until it commits like a multi-tap character; ▲ moves
// the cursor right and ▼ left, wrapping; C deletes, held C clears, C on the empty entry goes
// back. The counter shows the digits left of `limit`: a `+` takes none. The soft key is
// `Search` while the entry is empty (Search: `No phone numbers` in the virgin phone book) and
// `OK` once it holds a character. The cursor blinks as in the editor.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { PromptModel } from "../display/widgets";
import { TEXT_TIMINGS, WIDGET_TIMELINE_BY_NAME, WIDGET_TIMELINES } from "../resources";
import {
  textClear,
  textDelete,
  textInsert,
  textMove,
  textTick,
  type TextState,
} from "../text/multitap";
import type { Flow, Widget } from "./flow";
import { note } from "./note";

/** `*`'s dial characters in press order (`text/number` star-1..4). */
export const DIAL_CYCLE: readonly string[] = ["*", "+", "p", "w"];

/** The Send prompt's digits (`text/number` len-30: the counter reaches 0). */
export const NUMBER_LIMIT = 30;

const DIGITS = "0123456789";

export interface NumberEntryOptions {
  /** The label lines (`Phone number:`). */
  readonly label: readonly string[];
  /** Default NUMBER_LIMIT. */
  readonly limit?: number;
  /** The number to edit (a stored centre or voice mailbox number); default empty. */
  readonly number?: string;
  /** OK with the number. */
  readonly done: (number: string, flow: Flow) => void;
  /** Search on the empty entry; default the virgin phone book's `No phone numbers` note. */
  readonly search?: (flow: Flow) => void;
}

/** The characters an entry's counter counts (all but `+`). */
function counted(text: string): number {
  return Array.from(text).filter((char) => char !== "+").length;
}

/** The virgin phone book's answer to Search (`text/number-search-empty`). */
export function noPhoneNumbers(flow: Flow): void {
  const id = WIDGET_TIMELINE_BY_NAME["no-phone-numbers"];
  const timeline = id === undefined ? undefined : WIDGET_TIMELINES[id];
  if (timeline === undefined) throw new Error('No widget timeline "no-phone-numbers".');
  flow.push(note({ lines: ["No phone", "numbers"], timeline }));
}

class NumberEntryWidget implements Widget {
  readonly #options: NumberEntryOptions;
  readonly #limit: number;
  #state: TextState;
  #now = 0;
  /** Held C: when its deletion happened, until it clears or comes up. */
  #clearFrom: number | undefined;

  constructor(options: NumberEntryOptions) {
    this.#options = options;
    this.#limit = options.limit ?? NUMBER_LIMIT;
    const number = options.number ?? "";
    this.#state = {
      text: number,
      cursor: Array.from(number).length,
      mode: "123",
      pending: null,
      letters: "Abc",
    };
  }

  render(): PromptModel {
    const state = this.#state;
    const empty = state.text === "";
    return {
      kind: "prompt",
      icons: ["prompt/pen"],
      counter: String(this.#limit - counted(state.text)),
      label: this.#options.label,
      entry: {
        kind: "number",
        text: state.text,
        ...(state.pending === null ? { cursor: state.cursor } : {}),
      },
      cursor: Math.floor(this.#now / TEXT_TIMINGS.blinkMs) % 2 === 0,
      softkey: empty ? "Search" : "OK",
    };
  }

  /** `chars` typed at the cursor while the counter allows (`+` always). */
  #type(chars: string): void {
    const full = counted(this.#state.text) >= this.#limit && chars !== "+";
    if (!full) this.#state = textInsert(this.#state, chars, Number.POSITIVE_INFINITY);
  }

  #star(): void {
    const state = this.#state;
    const pending = state.pending;
    if (pending?.key === "*" && this.#now < pending.sinceMs + TEXT_TIMINGS.commitMs) {
      const index = (pending.index + 1) % DIAL_CYCLE.length;
      const chars = Array.from(state.text);
      chars[state.cursor - 1] = DIAL_CYCLE[index]!;
      this.#state = {
        ...state,
        text: chars.join(""),
        pending: { ...pending, index, sinceMs: this.#now },
      };
      return;
    }
    const before = state.text;
    this.#type("*");
    if (this.#state.text !== before) {
      this.#state = { ...this.#state, pending: { key: "*", index: 0, sinceMs: this.#now } };
    }
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    if (DIGITS.includes(key) || key === "#") {
      this.#state = textTick(this.#state, Number.POSITIVE_INFINITY);
      this.#type(key);
      return;
    }
    if (key === "*") this.#star();
    else if (key === "up" || key === "down") this.#state = textMove(this.#state, key);
    else if (key === "c") {
      if (this.#state.text === "") {
        flow.back();
        return;
      }
      this.#state = textDelete(this.#state);
      this.#clearFrom = this.#now;
    }
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (key === "c") this.#clearFrom = undefined;
    if (key !== "navi") return;
    const number = textTick(this.#state, Number.POSITIVE_INFINITY).text;
    if (number === "") (this.#options.search ?? noPhoneNumbers)(flow);
    else this.#options.done(number, flow);
  }

  tick(dtMs: number): void {
    this.#now += dtMs;
    const from = this.#clearFrom;
    if (from !== undefined && this.#now - from >= TEXT_TIMINGS.clearAfterDeleteMs) {
      this.#clearFrom = undefined;
      this.#state = textClear(this.#state);
    }
    this.#state = textTick(this.#state, this.#now);
  }
}

/** A number prompt whose number is typed (plan 18 D4). */
export function numberEntry(options: NumberEntryOptions): Widget {
  return new NumberEntryWidget(options);
}
