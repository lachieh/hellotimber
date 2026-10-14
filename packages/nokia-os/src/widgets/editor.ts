// The stock text editor (plan 18 D4, D5): Write messages, Welcome note, Reply/Edit/Forward and
// later Chat. Keys go through the multi-tap engine (src/text) on key-down, as the firmware acts
// (Task 0: a character, C, # in 123, ▲/▼ and * redraw ≈50 ms after key-down; a tapped # changes
// the case on release); holds are timed here with TEXT_TIMINGS, not the kernel's long press.
// The cursor blinks on a free-running TEXT_TIMINGS.blinkMs timer from the editor's start: keys
// and commits never restart it (`text/commit`, `text/hold-digit`, `text/delete-hold` all keep
// the phase they had).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { EditorModel } from "../display/widgets";
import { TEXT_TIMINGS } from "../resources";
import { isTextKey } from "../text/keys";
import {
  cursorLine,
  EDITOR_LINE_WIDTH,
  pendingSlot,
  textWidth,
  viewTop,
  wrapText,
} from "../text/layout";
import {
  emptyText,
  shownMode,
  textClear,
  textDelete,
  textHold,
  textInsert,
  textKey,
  textMove,
  textTick,
  type TextMode,
  type TextState,
} from "../text/multitap";
import type { Flow, Widget } from "./flow";

/** What an editor's Options and symbol table may do to it. */
export interface EditorControl {
  /** The text, the pending character committed. */
  readonly text: string;
  /** Erase: the text cleared. */
  clear(): void;
  /** `chars` inserted at the cursor (Insert symbol, Insert number). */
  insert(chars: string): void;
}

export interface EditorSpec {
  /** `sms`: characters left and the message parts (`459/1`); `count`: characters left (`36`). */
  readonly counter: "sms" | "count";
  /** The most characters the text holds (459 for SMS, 36 for the welcome note). */
  readonly limit: number;
  /** `sms`: small, three lines; `welcome`: large while two lines fit, else small (Task 0). */
  readonly layout: "sms" | "welcome";
  readonly softkey: string;
  /** The text to edit (Edit, Forward, the stored welcome note); default empty. */
  readonly text?: string;
  /** Default the end of `text`. */
  readonly cursor?: number;
  readonly mode?: TextMode;
  /** The soft key (Navi): the editor's Options. */
  readonly options: (flow: Flow, editor: EditorControl) => void;
  /** `*`, tapped or held: the symbol table (plan 18 Task 7). */
  readonly symbols?: (flow: Flow, editor: EditorControl) => void;
  /** C on the empty text: back to the screen below (default), or nothing. */
  readonly onEmptyC?: "back" | "inert";
}

/** Characters left and parts: one part up to 160, then 153 per part (`text/counter`). */
export function smsCounter(length: number, limit: number): string {
  const parts = length <= 160 ? 1 : Math.ceil(length / 153);
  return `${limit - length}/${parts}`;
}

/** The header's mode sprite (`prompt/abc` and `prompt/abc-lower` are the prompts', the same). */
export const MODE_SPRITES: Readonly<Record<TextMode, string>> = {
  Abc: "prompt/abc",
  abc: "prompt/abc-lower",
  ABC: "editor/mode-upper",
  "123": "editor/mode-123",
};

interface Face {
  readonly font: "small" | "large";
  readonly tops: readonly number[];
  readonly cursorHeight: number;
}

/** SMS text: small at tops 8/18/28; the cursor 10 rows from just above the line (S6). */
const SMS_FACE: Face = { font: "small", tops: [8, 18, 28], cursorHeight: 10 };
/** The welcome note while two large lines fit: tops 8/22, a 15-row cursor (`welcome/editor`). */
const WELCOME_LARGE: Face = { font: "large", tops: [8, 22], cursorHeight: 15 };
/** The welcome note in small: tops 8/17/26 (`welcome/face` 24-36). */
const WELCOME_SMALL: Face = { font: "small", tops: [8, 17, 26], cursorHeight: 10 };

/**
 * The editor's screen for `state` (a pure function of its inputs, so the painter tests build
 * it from replayed states): the text wrapped in the spec's face, the window from `top`, and the
 * cursor while `cursorShown` and nothing is pending. Returns the window's top for the next call.
 */
export function editorModel(
  state: TextState,
  spec: Pick<EditorSpec, "counter" | "limit" | "layout" | "softkey">,
  previousTop: number,
  cursorShown: boolean,
): { readonly model: EditorModel; readonly top: number } {
  const wrap = (face: Face) =>
    wrapText(state.text, face.font, EDITOR_LINE_WIDTH, pendingSlot(state, face.font));
  let face = spec.layout === "sms" ? SMS_FACE : WELCOME_LARGE;
  let lines = wrap(face);
  if (spec.layout === "welcome" && lines.length > WELCOME_LARGE.tops.length) {
    face = WELCOME_SMALL;
    lines = wrap(face);
  }
  const rows = face.tops.length;
  const top = viewTop(lines, state.cursor, rows, previousTop);
  const chars = Array.from(state.text);
  const shown = lines.slice(top, top + rows).map((line, i) => ({
    text: chars.slice(line.start, line.end).join(""),
    top: face.tops[i]!,
  }));
  const line = cursorLine(lines, state.cursor);
  const before = chars.slice(lines[line]!.start, state.cursor).join("");
  const cursor =
    cursorShown && state.pending === null
      ? {
          x: textWidth(face.font, before),
          top: face.tops[line - top]! - 1,
          height: face.cursorHeight,
        }
      : undefined;
  const length = chars.length;
  return {
    top,
    model: {
      kind: "editor",
      icons: ["prompt/pen", MODE_SPRITES[shownMode(state)]],
      counter:
        spec.counter === "sms" ? smsCounter(length, spec.limit) : String(spec.limit - length),
      font: face.font,
      lines: shown,
      ...(cursor === undefined ? {} : { cursor }),
      softkey: spec.softkey,
    },
  };
}

/** A key held down: when, and when it came up (undefined while it is down). */
interface Held {
  readonly key: PhoneKey;
  readonly downAt: number;
  upAt?: number;
  /** Its hold has acted (123 entered, the text cleared). */
  fired: boolean;
}

class EditorWidget implements Widget {
  readonly #spec: EditorSpec;
  #state: TextState;
  #now = 0;
  #top = 0;
  /** The last character key pressed, for a held digit at its commit. */
  #digit: Held | undefined;
  #hash: Held | undefined;
  /** C held after a deletion: when that deletion happened. */
  #clear: Held | undefined;

  constructor(spec: EditorSpec) {
    this.#spec = spec;
    const text = spec.text ?? "";
    this.#state = {
      ...emptyText(spec.mode ?? "Abc"),
      text,
      cursor: spec.cursor ?? Array.from(text).length,
    };
  }

  #control(): EditorControl {
    return {
      text: textTick(this.#state, Number.POSITIVE_INFINITY).text,
      clear: () => {
        this.#state = textClear(this.#state);
      },
      insert: (chars) => {
        this.#state = textInsert(this.#state, chars, this.#spec.limit);
      },
    };
  }

  render(): EditorModel {
    const cursorShown = Math.floor(this.#now / TEXT_TIMINGS.blinkMs) % 2 === 0;
    const { model, top } = editorModel(this.#state, this.#spec, this.#top, cursorShown);
    this.#top = top;
    return model;
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    const limit = this.#spec.limit;
    if (isTextKey(key)) {
      this.#state = textKey(this.#state, key, this.#now, limit);
      this.#digit = { key, downAt: this.#now, fired: false };
      return;
    }
    switch (key) {
      case "#":
        this.#hash = { key, downAt: this.#now, fired: false };
        if (this.#state.mode === "123") this.#state = textKey(this.#state, "#", this.#now, limit);
        return;
      case "*":
        this.#spec.symbols?.(flow, this.#control());
        return;
      case "up":
      case "down":
        this.#state = textMove(this.#state, key);
        return;
      case "c":
        if (this.#state.text === "") {
          if ((this.#spec.onEmptyC ?? "back") === "back") flow.back();
          return;
        }
        this.#state = textDelete(this.#state);
        this.#clear = { key, downAt: this.#now, fired: false };
        return;
      default:
        return;
    }
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (this.#digit?.key === key && this.#digit.upAt === undefined) this.#digit.upAt = this.#now;
    if (key === "#") {
      const hash = this.#hash;
      this.#hash = undefined;
      if (hash !== undefined && !hash.fired && this.#state.mode !== "123") {
        this.#state = textKey(this.#state, "#", this.#now, this.#spec.limit);
      }
      return;
    }
    if (key === "c") this.#clear = undefined;
    if (key === "navi") this.#spec.options(flow, this.#control());
  }

  tick(dtMs: number): void {
    this.#now += dtMs;
    const now = this.#now;
    const hash = this.#hash;
    if (hash !== undefined && !hash.fired && now - hash.downAt >= TEXT_TIMINGS.numberModeHoldMs) {
      hash.fired = true;
      this.#state = textHold(this.#state, "#", now, this.#spec.limit);
    }
    const clear = this.#clear;
    if (
      clear !== undefined &&
      !clear.fired &&
      now - clear.downAt >= TEXT_TIMINGS.clearAfterDeleteMs
    ) {
      clear.fired = true;
      this.#state = textClear(this.#state);
    }
    const pending = this.#state.pending;
    if (pending === null || now < pending.sinceMs + TEXT_TIMINGS.commitMs) return;
    const digit = this.#digit;
    const held =
      digit !== undefined && digit.key === pending.key && digit.downAt === pending.sinceMs
        ? (digit.upAt ?? now) - digit.downAt
        : 0;
    this.#state =
      isTextKey(pending.key) && held >= TEXT_TIMINGS.digitHoldMs
        ? textHold(this.#state, pending.key, now, this.#spec.limit)
        : textTick(this.#state, now);
  }
}

/** The stock text editor (plan 18 D4). */
export function editor(spec: EditorSpec): Widget {
  return new EditorWidget(spec);
}
