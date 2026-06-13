/**
 * Traditional multi-tap text entry (Nokia 3310 spec §6) as pure functions.
 * No timers — callers pass time in; state updates are immutable.
 */

export type MultitapMode = "abc" | "Abc" | "123";

export type MultitapKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

export interface MultitapState {
  text: string;
  /** Insertion point, 0..text.length. */
  cursor: number;
  mode: MultitapMode;
  /** Letter being cycled at cursor-1, awaiting commit. */
  pending: { key: MultitapKey; index: number; deadline: number } | null;
}

export const MULTITAP_TIMEOUT_MS = 1000;

/** Letters per key; '1' cycles punctuation; '0' is handled as space. */
const TABLE: Partial<Record<MultitapKey, string>> = {
  "1": ".,'?!\"1-()@/:_",
  "2": "abc2",
  "3": "def3",
  "4": "ghi4",
  "5": "jkl5",
  "6": "mno6",
  "7": "pqrs7",
  "8": "tuv8",
  "9": "wxyz9",
};

export function createMultitap(): MultitapState {
  return { text: "", cursor: 0, mode: "Abc", pending: null };
}

function applyCase(ch: string, mode: MultitapMode): string {
  return mode === "Abc" ? ch.toUpperCase() : ch;
}

function insertAt(s: MultitapState, ch: string): MultitapState {
  const text = s.text.slice(0, s.cursor) + ch + s.text.slice(s.cursor);
  return { ...s, text, cursor: s.cursor + ch.length, pending: null };
}

/** Commit the pending letter. Sentence case: Abc downshifts to abc after one commit. */
export function commitPending(s: MultitapState): MultitapState {
  if (s.pending === null) return s;
  const mode: MultitapMode = s.mode === "Abc" ? "abc" : s.mode;
  return { ...s, pending: null, mode };
}

/** Advance time; commits the pending letter once its 1s deadline passes. */
export function tickMultitap(s: MultitapState, nowMs: number): MultitapState {
  if (s.pending !== null && nowMs >= s.pending.deadline) return commitPending(s);
  return s;
}

/** Short press of a digit key. */
export function pressDigit(s: MultitapState, key: MultitapKey, nowMs: number): MultitapState {
  if (s.mode === "123") return insertAt(commitPending(s), key);
  if (key === "0") return insertAt(commitPending(s), " "); // verified: 0 = space
  const chars = TABLE[key]!;
  if (s.pending !== null && s.pending.key === key) {
    // Cycle: replace the letter at cursor-1 with the next one.
    const index = (s.pending.index + 1) % chars.length;
    const ch = applyCase(chars[index]!, s.mode);
    const text = s.text.slice(0, s.cursor - 1) + ch + s.text.slice(s.cursor);
    return { ...s, text, pending: { key, index, deadline: nowMs + MULTITAP_TIMEOUT_MS } };
  }
  const base = commitPending(s);
  const ch = applyCase(chars[0]!, base.mode);
  const text = base.text.slice(0, base.cursor) + ch + base.text.slice(base.cursor);
  return {
    ...base,
    text,
    cursor: base.cursor + 1,
    pending: { key, index: 0, deadline: nowMs + MULTITAP_TIMEOUT_MS },
  };
}

/** Press-and-hold a digit: insert the number itself; hold-0 toggles 123 mode. */
export function holdDigit(s: MultitapState, key: MultitapKey): MultitapState {
  if (key === "0") {
    const base = commitPending(s);
    return { ...base, mode: base.mode === "123" ? "abc" : "123" };
  }
  return insertAt(commitPending(s), key);
}

/** Short '#': switch upper/lower case (verified); no-op in 123 mode. */
export function pressHash(s: MultitapState): MultitapState {
  const base = commitPending(s);
  if (base.mode === "123") return base;
  return { ...base, mode: base.mode === "abc" ? "Abc" : "abc" };
}

/** 'C': delete the character left of the cursor. */
export function deleteLeft(s: MultitapState): MultitapState {
  const base = commitPending(s);
  if (base.cursor === 0) return base;
  return {
    ...base,
    text: base.text.slice(0, base.cursor - 1) + base.text.slice(base.cursor),
    cursor: base.cursor - 1,
  };
}

/** Hold-'C': clear all text. */
export function clearAll(s: MultitapState): MultitapState {
  return { ...s, text: "", cursor: 0, pending: null };
}

/** Scroll keys move the cursor: ▲ = left, ▼ = right (verified, manual §6). */
export function moveCursor(s: MultitapState, dir: -1 | 1): MultitapState {
  const base = commitPending(s);
  const cursor = Math.min(base.text.length, Math.max(0, base.cursor + dir));
  return { ...base, cursor };
}
