// A hand-made T9 dictionary for the engine's tests (plan 18b Task 4): common English words with
// invented weights, in the generated format (`#<w>` weight lines, words after them). Each rule of
// docs/specs/t9-behaviour.md has a key sequence here that shows it; the comments name them. Not
// derived from any golden or firmware.
import { createT9Dictionary, type T9Dictionary } from "../../src/text/t9";

export const T9_FIXTURE_SOURCE = [
  "#60",
  "the", // 843: the, then the stem `tid` (two entries)
  "of",
  "#56",
  "and",
  "a", // key 2: `a` is a word, `c` and `b` stems
  "to",
  "#54",
  "in",
  "is",
  "it",
  "#52",
  "i",
  "that",
  "be",
  "#50",
  "can",
  "for",
  "on",
  "#48",
  "good", // 4663: good, home, gone (one weight: list order), hood, then the stem `inne`
  "home",
  "gone",
  "don't", // 36618: the contraction
  "#46",
  "don", // 366 + 1: the stem `don'` duplicates `don'`
  "not",
  "#44",
  "hood",
  "go",
  "come",
  "#40",
  "inner",
  "good's", // 46631: the stem `good'` after another word
  "#36",
  "hello", // 43556: one entry
  "#32",
  "tide",
  "homes", // its stem `home` is a word: listed once
  "#28",
  "bake",
  "cake",
  "#24",
  "very", // key 8's stem `v`
].join("\n");

export const T9_FIXTURE: T9Dictionary = createT9Dictionary("english", T9_FIXTURE_SOURCE);

/** The fixture's words, in list order. */
export const T9_FIXTURE_WORDS: readonly string[] = T9_FIXTURE_SOURCE.split("\n").filter(
  (line) => !line.startsWith("#"),
);
