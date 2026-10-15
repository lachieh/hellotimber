// Key 1 in T9 (docs/specs/t9-behaviour.md 7): the marks a word takes, and the punctuation list
// key 1 starts with no word before it.

/** The marks offered after a word, in order (spec 7: `into.`, `into,`, ... `into:`). */
export const T9_MARKS: readonly string[] = [".", ",", "-", "?", "!", "'", "@", ":"];

/** Key 1 with no composing word: the marks, then the digit (spec 7). */
export const T9_PUNCTUATION: readonly string[] = [...T9_MARKS, "1"];
