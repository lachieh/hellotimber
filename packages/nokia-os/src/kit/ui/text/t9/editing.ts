// The editor's text in T9 mode (plan 18b D8): plan 18's `TextState` with the composing word
// (`t9`), which ends at the cursor and whose shown candidate is in the text. Pure functions from
// one state to the next; the widget (src/widgets/text-entry.ts) times the holds. Every rule cites
// docs/specs/t9-behaviour.md.
//
// The mode is explicit in T9 (spec 8): `Abc` makes the next letter upper case and becomes `abc`
// after it; `#` toggles `Abc`/`abc` at a word start and `abc`/`ABC` inside a composing word; a
// word ended with `0` leaves `Abc` at a sentence start, else `abc` (`ABC` lasts one word).
import type { TextKey } from "../keys";
import {
  sentenceStart,
  textClear,
  textDelete,
  textInsert,
  type TextMode,
  type TextState,
} from "../multitap";
import type { T9Dictionary } from "./dictionary";
import {
  t9Delete,
  t9Display,
  t9FromWord,
  t9Key,
  t9Star,
  t9Use,
  type T9Composing,
  type T9Display,
  type T9Key,
} from "./engine";

/** What T9 needs from the phone: the dictionary and the user's words (spec 11). */
export interface T9Context {
  readonly dictionary: T9Dictionary;
  readonly user: readonly string[];
}

/** The composing word as shown, or undefined between words. */
export function composingWord(state: TextState, ctx: T9Context): T9Display | undefined {
  return state.t9 ? t9Display(state.t9, ctx.dictionary, ctx.user) : undefined;
}

/** The composing word ended as shown (the `?` is not text). */
export function t9Commit(state: TextState): TextState {
  return state.t9 ? { ...state, t9: null } : state;
}

/** The mode between words: `Abc` at a sentence start, else `abc` (123 stays). */
function wordStart(state: TextState): TextState {
  if (state.mode === "123") return state;
  return { ...state, mode: sentenceStart(state.text, state.cursor) ? "Abc" : "abc" };
}

/** After a letter: `Abc` has been used (spec 8). */
function afterLetter(state: TextState): TextState {
  return state.mode === "Abc" ? { ...state, mode: "abc" } : state;
}

/**
 * The composing word replaced by `next`'s candidate (none: removed). Over `limit` the state is
 * unchanged (the key is ignored).
 */
function withComposing(
  state: TextState,
  next: T9Composing | null,
  ctx: T9Context,
  limit: number,
): TextState {
  const old = composingWord(state, ctx)?.text ?? "";
  const start = state.cursor - old.length;
  const text = next === null ? "" : t9Display(next, ctx.dictionary, ctx.user).text;
  if (state.text.length - old.length + text.length > limit) return state;
  return {
    ...state,
    text: state.text.slice(0, start) + text + state.text.slice(state.cursor),
    cursor: start + text.length,
    pending: null,
    t9: next,
  };
}

/** A composing word of key 1 only (a punctuation word, spec 7). */
function punctuationWord(composing: T9Composing): boolean {
  return /^1+$/.test(composing.keys);
}

/**
 * A letter key or key 1 (spec 5, 6, 7): adds to the composing word or starts one at the cursor
 * (typing in the middle starts a word of its own, spec 9). A letter after a punctuation word
 * starts a new word. In 123 the digit is typed.
 */
export function t9TypeKey(state: TextState, key: T9Key, ctx: T9Context, limit: number): TextState {
  if (state.mode === "123") return textInsert(t9Commit(state), key, limit);
  const s = state.t9 && key !== "1" && punctuationWord(state.t9) ? t9Commit(state) : state;
  const current = s.t9 ?? null;
  const upper = s.mode === "Abc" || s.mode === "ABC";
  const next = t9Key(current, key, upper, ctx.dictionary, ctx.user);
  if (next === null || next === current) return s;
  const typed = withComposing(s, next, ctx, limit);
  return typed === s ? s : afterLetter(typed);
}

/** `*` (spec 4.2, 6): the next candidate; nothing without a composing word (spec 5). */
export function t9StarKey(state: TextState, ctx: T9Context, limit: number): TextState {
  if (!state.t9) return state;
  return withComposing(state, t9Star(state.t9, ctx.dictionary, ctx.user), ctx, limit);
}

/** `0` (spec 5, 6): the word ended as shown, then a space; in 123 the digit. */
export function t9Space(state: TextState, limit: number): TextState {
  if (state.mode === "123") return textInsert(t9Commit(state), "0", limit);
  const spaced = textInsert(t9Commit(state), " ", limit);
  if (sentenceStart(spaced.text, spaced.cursor)) return { ...spaced, mode: "Abc" };
  return spaced.mode === "ABC" ? { ...spaced, mode: "abc" } : spaced;
}

/** A tapped `#` (spec 8): the two-state case toggle; in 123 it types `#` (plan 18). */
export function t9Hash(state: TextState, limit: number): TextState {
  if (state.mode === "123") return textInsert(t9Commit(state), "#", limit);
  if (state.t9) return { ...state, mode: state.mode === "ABC" ? "abc" : "ABC" };
  return { ...state, mode: state.mode === "Abc" ? "abc" : "Abc" };
}

/** A held `#` (spec 8): number mode, the word ended; held again, the mode it left. */
export function t9HoldHash(state: TextState): TextState {
  if (state.mode === "123") {
    const { letters = "Abc", ...rest } = state;
    return { ...rest, mode: letters };
  }
  const s = t9Commit(state);
  return { ...s, mode: "123", letters: s.mode as Exclude<TextMode, "123"> };
}

/**
 * A held digit key (spec 5), given the state before its press: the composing word ended, the
 * digit typed.
 */
export function t9HoldDigit(before: TextState, key: TextKey, limit: number): TextState {
  return textInsert(t9Commit(before), key, limit);
}

/** The word (no spaces) that ends at the cursor, when the cursor is at a word's end. */
function wordBeforeCursor(state: TextState): string | undefined {
  const { text, cursor } = state;
  if (cursor === 0 || text[cursor - 1] === " ") return undefined;
  if (cursor < text.length && text[cursor] !== " ") return undefined;
  const start = text.lastIndexOf(" ", cursor - 1) + 1;
  return text.slice(start, cursor);
}

/** The word at the cursor's end made the composing word again, when its lists have it. */
function reenter(state: TextState, ctx: T9Context): TextState | undefined {
  if (state.mode === "123") return undefined;
  const word = wordBeforeCursor(state);
  const composing = word === undefined ? null : t9FromWord(word, ctx.dictionary, ctx.user);
  if (composing === null) return undefined;
  return { ...state, t9: composing, mode: state.mode === "ABC" ? "ABC" : "abc" };
}

/**
 * `C` (spec 5, 6, 9): the composing word's last key (the word gone with its only key); between
 * words the character left of the cursor, and a word the cursor then ends becomes the composing
 * word again.
 */
export function t9DeleteKey(state: TextState, ctx: T9Context): TextState {
  if (state.t9) {
    const next = t9Delete(state.t9, ctx.dictionary, ctx.user);
    const s = withComposing(state, next, ctx, Number.POSITIVE_INFINITY);
    if (next === null) return wordStart(s);
    return s.mode === "Abc" ? { ...s, mode: "abc" } : s;
  }
  if (state.cursor === 0) return state;
  const deleted = textDelete(state);
  return reenter(deleted, ctx) ?? wordStart(deleted);
}

/** Held `C`: the text cleared (plan 18), the mode back to a sentence start's. */
export function t9ClearText(state: TextState): TextState {
  return wordStart({ ...textClear(state), t9: null });
}

/** A word stop (spec 9): a word's start or end, or the end of the text. */
interface Stop {
  readonly at: number;
  readonly end: boolean;
}

function stopsOf(text: string): Stop[] {
  const stops: Stop[] = [];
  for (const match of text.matchAll(/[^ ]+/g)) {
    stops.push({ at: match.index, end: false }, { at: match.index + match[0].length, end: true });
  }
  stops.push({ at: text.length, end: false });
  return stops;
}

/**
 * ▲/▼ (spec 9): the word ended, then the next (▲) or previous (▼) word stop: each word's start
 * and end, then the end of the text; ▲ wraps from the last stop to the first, ▼ from the first to
 * the last word's end. At a word's end that word composes again.
 */
export function t9MoveKey(state: TextState, key: "up" | "down", ctx: T9Context): TextState {
  const s = t9Commit(state);
  if (s.text.length === 0) return s;
  const stops = stopsOf(s.text);
  const last = stops.length - 1;
  const composing = state.t9 !== undefined && state.t9 !== null;
  const current = composing
    ? stops.findIndex((stop) => stop.end && stop.at === s.cursor)
    : s.cursor === s.text.length
      ? last
      : stops.findIndex((stop) => !stop.end && stop.at === s.cursor);
  let next: number;
  if (current < 0) {
    // Elsewhere in a word: the nearest stop in the key's direction.
    next = key === "up" ? stops.findIndex((stop) => stop.at > s.cursor) : -1;
    if (key === "down") for (let i = 0; i < last; i++) if (stops[i]!.at < s.cursor) next = i;
    if (next < 0) next = key === "up" ? last : 0;
  } else if (key === "up") next = current === last ? 0 : current + 1;
  else next = current === 0 ? last - 1 : current - 1;
  if (next < 0) return s;
  const stop = stops[next]!;
  const moved: TextState = { ...s, cursor: stop.at };
  if (stop.end && next !== last) return reenter(moved, ctx) ?? wordStart(moved);
  return wordStart(moved);
}

/** `chars` inserted at the cursor (Insert symbol, Insert number, Insert word), the word ended. */
export function t9InsertText(state: TextState, chars: string, limit: number): TextState {
  return wordStart(textInsert(t9Commit(state), chars, limit));
}

/** Spell's OK (spec 10.3): `chars` in place of the composing word. */
export function t9ReplaceComposing(
  state: TextState,
  chars: string,
  ctx: T9Context,
  limit: number,
): TextState {
  return t9InsertText(withComposing(state, null, ctx, limit), chars, limit);
}

/** The whole word around the cursor (spec 10.3: the stored user word). */
export function wordAroundCursor(state: TextState): string {
  const { text, cursor } = state;
  const start = text.lastIndexOf(" ", cursor - 1) + 1;
  const space = text.indexOf(" ", cursor);
  return text.slice(start, space < 0 ? text.length : space);
}

/** Matches › Use (spec 10.2): candidate `match` of the Matches list shown, still composing. */
export function t9UseMatch(
  state: TextState,
  match: number,
  ctx: T9Context,
  limit: number,
): TextState {
  if (!state.t9) return state;
  return withComposing(state, t9Use(state.t9, match, ctx.dictionary, ctx.user), ctx, limit);
}

/**
 * The mode carried over a Dictionary change: into T9 the explicit mode of the cursor's place;
 * into multi-tap sentence case (plan 18's `Abc` shows `abc` mid-sentence). `ABC` and 123 stay.
 */
export function t9SwitchMode(state: TextState, t9: boolean): TextState {
  const s = t9Commit(state);
  if (s.mode === "ABC" || s.mode === "123") return s;
  return t9 ? wordStart(s) : { ...s, mode: "Abc" };
}
