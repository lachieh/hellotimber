// The stock text editor (plan 18 D4, S6): Write messages, Welcome note, Reply/Edit/Forward and
// later Chat. Its keys, holds and blink are a `TextEntry`'s (text-entry.ts); this module lays the
// text out and paints the editor's screen.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { EditorModel } from "../display/widgets";
import {
  cursorLine,
  EDITOR_LINE_WIDTH,
  pendingSlot,
  textWidth,
  viewTop,
  wrapText,
} from "../text/layout";
import { shownMode, type TextMode, type TextState } from "../text/multitap";
import type { Flow, Widget } from "./flow";
import { symbolTable } from "./symbol-table";
import { TextEntry, type EditorControl } from "./text-entry";

export type { EditorControl } from "./text-entry";

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
  /** `*`, tapped or held: default the symbol table (`openSymbols`). */
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

class EditorWidget implements Widget {
  readonly #spec: EditorSpec;
  readonly #entry: TextEntry;
  #top = 0;

  constructor(spec: EditorSpec) {
    this.#spec = spec;
    this.#entry = new TextEntry({
      limit: spec.limit,
      ...(spec.text === undefined ? {} : { text: spec.text }),
      ...(spec.cursor === undefined ? {} : { cursor: spec.cursor }),
      ...(spec.mode === undefined ? {} : { mode: spec.mode }),
    });
  }

  render(): EditorModel {
    const entry = this.#entry;
    const { model, top } = editorModel(entry.state, this.#spec, this.#top, entry.cursorShown);
    this.#top = top;
    return model;
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    const request = this.#entry.keyDown(key);
    if (request === "empty-c" && (this.#spec.onEmptyC ?? "back") === "back") flow.back();
    if (request === "symbols") (this.#spec.symbols ?? openSymbols)(flow, this.#entry.control());
  }

  onKey(key: PhoneKey, flow: Flow): void {
    this.#entry.keyUp(key);
    if (key === "navi") this.#spec.options(flow, this.#entry.control());
  }

  tick(dtMs: number): void {
    this.#entry.tick(dtMs);
  }
}

/** `*`'s default: the symbol table, Use inserting into the entry (plan 18 S5). */
export function openSymbols(flow: Flow, editor: EditorControl): void {
  flow.push(symbolTable((symbol) => editor.insert(symbol)));
}

/** The stock text editor (plan 18 D4). */
export function editor(spec: EditorSpec): Widget {
  return new EditorWidget(spec);
}
