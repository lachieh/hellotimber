// The stock multi-tap text entry (plan 18 D2, D5): pure functions from one entry state to the
// next. No clock: callers pass the time of each key (its first redraw, D5) and of each tick, as
// the Snake II engine's callers do. The widget decides when a key is a tap or a hold (`#` acts on
// its release, digits on their press; holds are timed with TEXT_TIMINGS) and calls `textKey` or
// `textHold`; every rule below cites the Task 0 capture it reproduces.
import type { PhoneKey } from "@hellotimber/phone-core";
import { TEXT_TIMINGS } from "../resources";
import { isTextKey, MULTITAP_KEYS, type TextKey } from "./keys";

/**
 * The entry mode: `Abc` is sentence case (upper at a sentence start, shown `abc` elsewhere),
 * `ABC` and `abc` fixed case, `123` digits.
 */
export type TextMode = "Abc" | "ABC" | "abc" | "123";

/** The keys `textKey` takes: the character keys and `#` (`*`, ▲/▼ and C have their own calls). */
export type TextInputKey = TextKey | "#";

export interface TextState {
  /** The text, including a pending character (at `cursor - 1`). */
  readonly text: string;
  /** 0..text.length; after the pending character while one is pending. */
  readonly cursor: number;
  readonly mode: TextMode;
  /** The character still cycling: its key, its index in the key's cycle, since when (ms). */
  readonly pending: {
    readonly key: PhoneKey;
    readonly index: number;
    readonly sinceMs: number;
  } | null;
  /** In 123: the letter mode a held # returns to (ABC stays ABC, the rest sentence case). */
  readonly letters?: "Abc" | "ABC";
}

/** An empty entry in `mode` (the editor starts in sentence case). */
export function emptyText(mode: TextMode = "Abc"): TextState {
  return mode === "123"
    ? { text: "", cursor: 0, mode, pending: null, letters: "Abc" }
    : { text: "", cursor: 0, mode, pending: null };
}

/**
 * The text before `at` ends a sentence: it is empty or blank, or ends with `.`, `?` or `!` and
 * any spaces (`text/case-after`; a letter typed straight after the mark is unverified).
 */
function sentenceStart(text: string, at: number): boolean {
  return /(^|[.?!]) *$/.test(text.slice(0, at));
}

/** Where the next character goes: the pending character's place, else the cursor. */
function slot(state: TextState): number {
  return state.pending === null ? state.cursor : state.cursor - 1;
}

/**
 * The mode the header shows: sentence case shows `Abc` at a sentence start and `abc` elsewhere
 * (`text/counter`, `text/hold-digit`: a pending letter at the start still shows Abc).
 */
export function shownMode(state: TextState): TextMode {
  if (state.mode !== "Abc") return state.mode;
  return sentenceStart(state.text, slot(state)) ? "Abc" : "abc";
}

/** The pending character committed. */
function commit(state: TextState): TextState {
  return state.pending === null ? state : { ...state, pending: null };
}

/** `chars` inserted at the cursor (as many as fit in `limit`), committed. */
export function textInsert(state: TextState, chars: string, limit: number): TextState {
  const s = commit(state);
  const room = Math.max(0, limit - s.text.length);
  const insert = Array.from(chars).slice(0, room).join("");
  return {
    ...s,
    text: s.text.slice(0, s.cursor) + insert + s.text.slice(s.cursor),
    cursor: s.cursor + insert.length,
  };
}

/** The key's cycle in the case the pending (or next) character takes. */
function cycleOf(state: TextState, key: TextKey): readonly string[] {
  const upper =
    state.mode === "ABC" || (state.mode === "Abc" && sentenceStart(state.text, slot(state)));
  return upper ? MULTITAP_KEYS[key].upper : MULTITAP_KEYS[key].lower;
}

/**
 * The # cycle: sentence case → ABC → abc → sentence case, skipping a mode that would show what
 * the current one shows (mid-sentence sentence case shows abc, so there # alternates abc and
 * ABC: `text/case-cycle-word`, `-space`; at a sentence start all three show: `-empty`).
 */
function nextCase(state: TextState): TextMode {
  const order: readonly TextMode[] = ["Abc", "ABC", "abc"];
  const shown = shownMode(state);
  let mode = state.mode;
  for (let i = 0; i < order.length; i++) {
    mode = order[(order.indexOf(mode) + 1) % order.length]!;
    if (shownMode({ ...state, mode }) !== shown) return mode;
  }
  return mode;
}

/**
 * A tap of `key` at `nowMs`. A character key types its cycle's first character, pending, or
 * cycles the pending character of the same key before it commits; another key commits it first.
 * At `limit` a new character is ignored (the pending last one still cycles: `text/counter`
 * 459-469). `#` changes the case (in 123 it types `#`).
 */
export function textKey(
  state: TextState,
  key: TextInputKey,
  nowMs: number,
  limit: number,
): TextState {
  if (key === "#") {
    if (state.mode === "123") return textInsert(state, "#", limit);
    const s = commit(state);
    return { ...s, mode: nextCase(s) };
  }
  if (!isTextKey(key)) return state;
  if (state.mode === "123") return textInsert(state, key, limit);
  const pending = state.pending;
  if (pending !== null && pending.key === key && nowMs < pending.sinceMs + TEXT_TIMINGS.commitMs) {
    const cycle = cycleOf(state, key);
    const index = (pending.index + 1) % cycle.length;
    const at = state.cursor - 1;
    return {
      ...state,
      text: state.text.slice(0, at) + cycle[index]! + state.text.slice(state.cursor),
      pending: { key, index, sinceMs: nowMs },
    };
  }
  const s = commit(state);
  if (s.text.length >= limit) return s;
  const typed = textInsert(s, cycleOf(s, key)[0]!, limit);
  return { ...typed, pending: { key, index: 0, sinceMs: nowMs } };
}

/**
 * A hold of `key` reached at `nowMs`: # enters 123 (or leaves it, `text/hold-hash`, `-back`); a
 * digit key replaces its pending character with the digit and commits it (`text/hold-digit`;
 * the widget calls this at the commit when the key was held TEXT_TIMINGS.digitHoldMs), or
 * types the digit when nothing is pending. In 123 a held digit was typed on its press.
 */
export function textHold(
  state: TextState,
  key: TextInputKey,
  _nowMs: number,
  limit: number,
): TextState {
  if (key === "#") {
    const s = commit(state);
    if (s.mode === "123") {
      const { letters = "Abc", ...rest } = s;
      return { ...rest, mode: letters };
    }
    return { ...s, mode: "123", letters: s.mode === "ABC" ? "ABC" : "Abc" };
  }
  if (!isTextKey(key) || state.mode === "123") return state;
  const pending = state.pending;
  if (pending !== null && pending.key === key) {
    const at = state.cursor - 1;
    return {
      ...state,
      text: state.text.slice(0, at) + key + state.text.slice(state.cursor),
      pending: null,
    };
  }
  return textInsert(state, key, limit);
}

/** The pending character commits once TEXT_TIMINGS.commitMs passed since its key (`text/commit`). */
export function textTick(state: TextState, nowMs: number): TextState {
  const pending = state.pending;
  if (pending === null || nowMs < pending.sinceMs + TEXT_TIMINGS.commitMs) return state;
  return commit(state);
}

/** C: deletes the pending character, else the one left of the cursor (`text/delete`). */
export function textDelete(state: TextState): TextState {
  if (state.cursor === 0) return commit(state);
  return {
    ...state,
    text: state.text.slice(0, state.cursor - 1) + state.text.slice(state.cursor),
    cursor: state.cursor - 1,
    pending: null,
  };
}

/** Held C: the text cleared (`text/delete-hold`); the mode stays. */
export function textClear(state: TextState): TextState {
  return { ...state, text: "", cursor: 0, pending: null };
}

/**
 * ▲ moves the cursor right and ▼ left, each wrapping at the ends (`text/cursor-one`,
 * `-three`); a pending character commits first.
 */
export function textMove(state: TextState, key: "up" | "down"): TextState {
  const s = commit(state);
  const length = s.text.length;
  if (length === 0) return s;
  const cursor =
    key === "up"
      ? s.cursor === length
        ? 0
        : s.cursor + 1
      : s.cursor === 0
        ? length
        : s.cursor - 1;
  return { ...s, cursor };
}
