// The T9 engine (plan 18b D4): candidate lists and the composing word's state, as pure functions
// over a dictionary and the user's words. Every rule cites docs/specs/t9-behaviour.md; the editor
// (src/text/t9/editing.ts) puts the composing word into the text.
import { keysOf, t9Index, type T9Dictionary } from "./dictionary";
import { T9_MARKS, T9_PUNCTUATION } from "./punctuation";

/** A key that adds to the composing word: the letter keys and key 1. */
export type T9Key = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

/** The word T9 is still building at the cursor (spec 4.1). */
export interface T9Composing {
  /** The accepted keys, at most 32 (spec 3.2). */
  readonly keys: string;
  /** Per key: its letter is upper case, fixed when the key was pressed (spec 8). */
  readonly upper: readonly boolean[];
  /** The candidate shown. */
  readonly index: number;
  /** A letter key matched nothing: the shown candidate with `?` (spec 6). */
  readonly noMatch: boolean;
  /** The candidate was reached with `*` (spec 4.2: the `?` at the end of the list). */
  readonly viaStar: boolean;
  /**
   * The word as shown when key 1 was last pressed in it, with its case (spec 7: `into.`, the
   * word before an apostrophe); "" before any key 1.
   */
  readonly fixed: string;
}

export interface T9Display {
  /** The shown candidate with each letter's case. */
  readonly text: string;
  /** Draw `?` after it; the soft key is Spell (spec 4.2, 6). */
  readonly question: boolean;
  /** How many of its letters were typed (the rest completes a user word, spec 3.1). */
  readonly keyed: number;
}

/** A candidate list and the entry that shows `?` when `*` reaches it (null: none). */
interface T9List {
  readonly items: readonly string[];
  readonly question: number | null;
}

/** At most 32 keys per word and 32 candidates per list (spec 3.2). */
export const T9_MAX = 32;

/** `items` without later case-insensitive repeats. */
function unique(items: readonly string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The words and stems for `keys`, then the user's (spec 3.1, 11): exact user words after the
 * first built-in candidate, oldest first; longer user words whose keys begin with `keys` last.
 */
function matches(dict: T9Dictionary, user: readonly string[], keys: string): string[] {
  const index = t9Index(dict);
  const built = [...index.words(keys), ...index.stems(keys)];
  const userKeys = user.map((word) => keysOf(word));
  const exact = user.filter((_, i) => userKeys[i] === keys);
  const longer = user.filter((_, i) => {
    const k = userKeys[i];
    return k !== undefined && k.length > keys.length && k.startsWith(keys);
  });
  return unique([...built.slice(0, 1), ...exact, ...built.slice(1), ...longer]);
}

function listOf(
  dict: T9Dictionary,
  user: readonly string[],
  keys: string,
  fixed: string,
): T9List | null {
  if (keys.length === 0 || keys.length > T9_MAX) return null;
  // Key 1 alone, or pressed again after marks: the punctuation list (spec 7), a one-key list.
  if (/^1+$/.test(keys))
    return { items: T9_PUNCTUATION.map((mark) => fixed + mark), question: null };
  if (fixed === "") {
    const items = matches(dict, user, keys);
    // A one-key list ends with the key's digit and never shows `?` (spec 3.4, 4.2).
    if (keys.length === 1)
      return { items: unique([...items, keys]).slice(0, T9_MAX), question: null };
    if (items.length === 0) return null;
    const capped = items.slice(0, T9_MAX);
    return { items: capped, question: capped.length - 1 };
  }
  const rest = keys.slice(fixed.length);
  if (rest === "1") {
    // The word with each mark, then the dictionary's entries; the `?` is the last entry's
    // before repeats are dropped, so none when that one repeats (spec 7).
    const all = [...T9_MARKS.map((mark) => fixed + mark), ...matches(dict, user, keys)];
    const items = unique(all).slice(0, T9_MAX);
    const last = all[all.length - 1]!.toLowerCase();
    const at = items.findIndex((item) => item.toLowerCase() === last);
    const firstAt = all.findIndex((item) => item.toLowerCase() === last);
    return { items, question: firstAt === all.length - 1 && at >= 0 ? at : null };
  }
  // Letters after the mark: the dictionary's entries with it, then the word before the mark
  // joined by `'` and by `.` to each candidate of the keys after it (spec 7, D10).
  const tail = matches(dict, user, rest.slice(1));
  const items = unique([
    ...matches(dict, user, keys),
    ...tail.map((word) => `${fixed}'${word}`),
    ...tail.map((word) => `${fixed}.${word}`),
  ]).slice(0, T9_MAX);
  return items.length === 0 ? null : { items, question: items.length - 1 };
}

/** The candidate list for `keys` (after the shown word `fixed` and key 1); null when none. */
export function t9Candidates(
  dict: T9Dictionary,
  user: readonly string[],
  keys: string,
  fixed = "",
): readonly string[] | null {
  return listOf(dict, user, keys, fixed)?.items ?? null;
}

/** `word` with the letters `upper` marks in upper case (a user word keeps its own, spec 8). */
function withCase(word: string, upper: readonly boolean[]): string {
  return Array.from(word, (ch, i) => {
    if (!upper[i]) return ch;
    const up = ch.toUpperCase();
    return up.length === 1 ? up : ch;
  }).join("");
}

function listFor(state: T9Composing, dict: T9Dictionary, user: readonly string[]): T9List {
  const list = listOf(dict, user, state.keys, state.fixed);
  if (list === null) throw new Error(`No T9 list for keys ${state.keys}.`);
  return list;
}

/** What the editor shows for `state`. */
export function t9Display(
  state: T9Composing,
  dict: T9Dictionary,
  user: readonly string[],
): T9Display {
  const list = listFor(state, dict, user);
  const text = withCase(list.items[state.index]!, state.upper);
  return {
    text,
    question: state.noMatch || (state.viaStar && state.index === list.question),
    keyed: Math.min(state.keys.length, Array.from(text).length),
  };
}

/**
 * A letter key or key 1 (`upper`: its letter is upper case). With no composing word it starts
 * one (null when the key has no list). In the no-match state the key is ignored (the same state
 * back); a second key with no list is dropped silently; after two keys or more, or at the 33rd
 * key, the state becomes no-match (spec 6).
 */
export function t9Key(
  state: T9Composing | null,
  key: T9Key,
  upper: boolean,
  dict: T9Dictionary,
  user: readonly string[],
): T9Composing | null {
  if (state === null) {
    if (listOf(dict, user, key, "") === null) return null;
    return { keys: key, upper: [upper], index: 0, noMatch: false, viaStar: false, fixed: "" };
  }
  if (state.noMatch) return state;
  const fixed = key === "1" ? t9Display(state, dict, user).text : state.fixed;
  const keys = state.keys + key;
  const list = keys.length > T9_MAX ? null : listOf(dict, user, keys, fixed);
  if (list === null) {
    if (state.keys.length === 1) return state;
    return { ...state, noMatch: true, viaStar: false };
  }
  return { keys, upper: [...state.upper, upper], index: 0, noMatch: false, viaStar: false, fixed };
}

/**
 * `*`: the next candidate, wrapping; a one-entry list stays (with `?`). In the no-match state
 * (spec 6): three candidates or more go on to the next; two show the same with `?`, then plain;
 * one shows it with `?`.
 */
export function t9Star(
  state: T9Composing,
  dict: T9Dictionary,
  user: readonly string[],
): T9Composing {
  const n = listFor(state, dict, user).items.length;
  if (state.noMatch) {
    if (state.viaStar) return { ...state, noMatch: false, viaStar: false };
    if (n === 2) return { ...state, viaStar: true };
    if (n === 1) return { ...state, noMatch: false, viaStar: true };
    return { ...state, noMatch: false, viaStar: true, index: (state.index + 1) % n };
  }
  if (n === 1) return { ...state, viaStar: true };
  return { ...state, index: (state.index + 1) % n, viaStar: true };
}

/** C: the last key removed, the shorter sequence's first candidate; null when none is left. */
export function t9Delete(
  state: T9Composing,
  dict: T9Dictionary,
  user: readonly string[],
): T9Composing | null {
  if (state.keys.length <= 1) return null;
  const keys = state.keys.slice(0, -1);
  const fixed = keys.length > state.fixed.length ? state.fixed : "";
  if (listOf(dict, user, keys, fixed) === null) return null;
  return {
    keys,
    upper: state.upper.slice(0, -1),
    index: 0,
    noMatch: false,
    viaStar: false,
    fixed,
  };
}

/**
 * `word` as the composing word again (spec 9: C across a space, ▲/▼ to a word's end): its keys,
 * its case, the candidate it is. Null when its lists do not have it (a word typed in multi-tap,
 * a character no key types).
 */
export function t9FromWord(
  word: string,
  dict: T9Dictionary,
  user: readonly string[],
): T9Composing | null {
  const chars = Array.from(word);
  const keys = keysOf(word);
  if (chars.length === 0 || keys === undefined || keys.length > T9_MAX) return null;
  const lastMark = keys.lastIndexOf("1");
  const fixed = /^1+$/.test(keys)
    ? chars.slice(0, -1).join("")
    : lastMark > 0
      ? chars.slice(0, lastMark).join("")
      : "";
  const list = listOf(dict, user, keys, fixed);
  if (list === null) return null;
  const upper = chars.map((ch) => ch !== ch.toLowerCase());
  const index = list.items.findIndex((item) => withCase(item, upper) === word);
  if (index < 0) return null;
  return { keys, upper, index, noMatch: false, viaStar: false, fixed };
}

/** Options › Matches (spec 10.2): the candidates after the shown one, wrapping; it is last. */
export function t9Matches(
  state: T9Composing,
  dict: T9Dictionary,
  user: readonly string[],
): readonly string[] {
  const { items } = listFor(state, dict, user);
  return items.map((_, k) => withCase(items[(state.index + 1 + k) % items.length]!, state.upper));
}

/** Matches › Use: entry `match` of `t9Matches` shown, plainly (spec 10.2). */
export function t9Use(
  state: T9Composing,
  match: number,
  dict: T9Dictionary,
  user: readonly string[],
): T9Composing {
  const n = listFor(state, dict, user).items.length;
  return { ...state, index: (state.index + 1 + match) % n, noMatch: false, viaStar: false };
}
