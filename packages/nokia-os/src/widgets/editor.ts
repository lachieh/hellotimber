// The stock text editor (plan 18 D4, S6): Write messages, Welcome note, Reply/Edit/Forward and
// later Chat. Its keys, holds and blink are a `TextEntry`'s (text-entry.ts); this module lays the
// text out and paints the editor's screen.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { EditorModel } from "../display/widgets";
import type { StockWidgetTimeline } from "../resources";
import {
  cursorLine,
  EDITOR_LINE_WIDTH,
  pendingSlot,
  textWidth,
  viewTop,
  wrapText,
} from "../text/layout";
import { shownMode, type TextMode, type TextState } from "../text/multitap";
import type { T9Context } from "../text/t9/editing";
import type { T9Display } from "../text/t9/engine";
import type { Flow, Widget } from "./flow";
import { symbolTable } from "./symbol-table";
import { HeldC } from "./held-c";
import { TextEntry, type EditorControl, type EntryRequest } from "./text-entry";

export type { EditorControl, T9EditorControl } from "./text-entry";

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
  /** The cursor's blink from the node's own recording (`TextEntryOptions.blink`). */
  readonly blink?: StockWidgetTimeline;
  /** Plan 18b: the T9 dictionary and user words while T9 is on (Dictionary English). */
  readonly t9?: () => T9Context | undefined;
  /** Plan 18b: the soft key `Spell` (a `?` shown): the Insert word prompt for the word. */
  readonly spell?: (flow: Flow, editor: EditorControl) => void;
}

/** Plan 18b: what the T9 editor shows beyond the text (absent: multi-tap). */
export interface EditorT9View {
  /** The composing word as shown, which ends at the cursor; undefined between words. */
  readonly composing?: T9Display;
}

/** Characters left and parts: one part up to 160, then 153 per part (`text/counter`). */
export function smsCounter(length: number, limit: number): string {
  const parts = length <= 160 ? 1 : Math.ceil(length / 153);
  return `${limit - length}/${parts}`;
}

/** The T9 header's mode text starts here (spec 1; the multi-tap header's at x 14). */
export const T9_MODE_X = 21;

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
 *
 * In T9 (`t9`, plan 18b): the T9 pen and the mode text from x 21 (the plain header in 123), the
 * composing word underlined under its letters' cells (the last one's blank column left out) on the
 * line's tenth row, only its typed letters (a user word's completion is not), and with `?` the mark after it, the soft
 * key Spell and no cursor (every `?` still shows none). A completion's untyped letters and the
 * `?` wrap as a word of their own (`t9/g-spell/16-prefix-star5`).
 */
export function editorModel(
  state: TextState,
  spec: Pick<EditorSpec, "counter" | "limit" | "layout" | "softkey">,
  previousTop: number,
  cursorShown: boolean,
  t9?: EditorT9View,
): { readonly model: EditorModel; readonly top: number } {
  const composing = t9?.composing;
  const question = composing?.question ?? false;
  const wordStart = state.cursor - (composing?.text.length ?? 0);
  const keyedEnd = wordStart + (composing?.keyed ?? 0);
  const shownText = question
    ? `${state.text.slice(0, state.cursor)}?${state.text.slice(state.cursor)}`
    : state.text;
  const breakAt =
    composing !== undefined && (question || composing.keyed < composing.text.length)
      ? keyedEnd
      : undefined;
  const wrap = (face: Face) =>
    wrapText(shownText, face.font, EDITOR_LINE_WIDTH, pendingSlot(state, face.font), breakAt);
  let face = spec.layout === "sms" ? SMS_FACE : WELCOME_LARGE;
  let lines = wrap(face);
  if (spec.layout === "welcome" && lines.length > WELCOME_LARGE.tops.length) {
    face = WELCOME_SMALL;
    lines = wrap(face);
  }
  const rows = face.tops.length;
  const top = viewTop(lines, state.cursor, rows, previousTop);
  const chars = Array.from(shownText);
  const window = lines.slice(top, top + rows);
  const shown = window.map((line, i) => ({
    text: chars.slice(line.start, line.end).join(""),
    top: face.tops[i]!,
  }));
  const line = cursorLine(lines, state.cursor);
  const before = chars.slice(lines[line]!.start, state.cursor).join("");
  const cursor =
    cursorShown && state.pending === null && !question
      ? {
          x: textWidth(face.font, before),
          top: face.tops[line - top]! - 1,
          height: face.cursorHeight,
        }
      : undefined;
  const underlines = window.flatMap((row, i) => {
    const from = Math.max(row.start, wordStart);
    const to = Math.min(row.end, keyedEnd);
    if (composing === undefined || from >= to) return [];
    const x = 1 + textWidth(face.font, chars.slice(row.start, from).join(""));
    // The letters' cells without the last one's blank column (`t9/punct-alone/09-p-star8`: `1`).
    const width = textWidth(face.font, chars.slice(from, to).join("")) - 1;
    return [{ x, y: face.tops[i]! + 8, width }];
  });
  const length = Array.from(state.text).length;
  const mode = t9 === undefined ? shownMode(state) : state.mode;
  return {
    top,
    model: {
      kind: "editor",
      icons:
        t9 === undefined || mode === "123"
          ? ["prompt/pen", MODE_SPRITES[mode]]
          : ["editor/t9-pen", { id: MODE_SPRITES[mode], x: T9_MODE_X }],
      counter:
        spec.counter === "sms" ? smsCounter(length, spec.limit) : String(spec.limit - length),
      font: face.font,
      lines: shown,
      ...(cursor === undefined ? {} : { cursor }),
      ...(underlines.length === 0 ? {} : { underlines }),
      softkey: question ? "Spell" : spec.softkey,
    },
  };
}

class EditorWidget implements Widget {
  readonly #spec: EditorSpec;
  readonly #entry: TextEntry;
  #top = 0;
  readonly #emptyC = new HeldC();

  constructor(spec: EditorSpec) {
    this.#spec = spec;
    this.#entry = new TextEntry({
      limit: spec.limit,
      ...(spec.text === undefined ? {} : { text: spec.text }),
      ...(spec.cursor === undefined ? {} : { cursor: spec.cursor }),
      ...(spec.mode === undefined ? {} : { mode: spec.mode }),
      ...(spec.blink === undefined ? {} : { blink: spec.blink }),
      ...(spec.t9 === undefined ? {} : { t9: spec.t9 }),
    });
  }

  render(): EditorModel {
    const entry = this.#entry;
    const t9 = entry.context() === undefined ? undefined : { composing: entry.composing() };
    const { model, top } = editorModel(entry.state, this.#spec, this.#top, entry.cursorShown, t9);
    this.#top = top;
    return model;
  }

  #request(request: EntryRequest, flow: Flow): void {
    if (request === "empty-c" && (this.#spec.onEmptyC ?? "back") === "back") this.#emptyC.down();
    if (request === "symbols") {
      // A held `*` in T9 ends no word (none composes then, spec 5).
      (this.#spec.symbols ?? openSymbols)(flow, this.#entry.control());
    }
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    this.#request(this.#entry.keyDown(key), flow);
  }

  onKey(key: PhoneKey, flow: Flow): void {
    this.#entry.keyUp(key);
    if (key === "navi") {
      // `?` shown: the soft key is Spell (plan 18b, spec 4.2, 6).
      if (this.#entry.composing()?.question && this.#spec.spell !== undefined) {
        this.#spec.spell(flow, this.#entry.control());
        return;
      }
      // Options commits a pending character (`sms/inbox-option-reply-send`: the reply's A,
      // typed less than a commit before, is committed when the editor shows again).
      this.#entry.commit();
      this.#spec.options(flow, this.#entry.control());
    }
    if (key === "c") this.#emptyC.up(flow);
  }

  tick(dtMs: number, flow: Flow): void {
    this.#request(this.#entry.tick(dtMs), flow);
    this.#emptyC.tick(dtMs, flow);
  }
}

/** `*`'s default: the symbol table, Use inserting into the entry (plan 18 S5; T9: plan 18b). */
export function openSymbols(flow: Flow, editor: EditorControl): void {
  flow.push(symbolTable((symbol) => editor.insert(symbol), { t9: editor.t9 !== undefined }));
}

/** The stock text editor (plan 18 D4). */
export function editor(spec: EditorSpec): Widget {
  return new EditorWidget(spec);
}
