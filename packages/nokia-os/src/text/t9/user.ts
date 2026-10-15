// The T9 user dictionary (plan 18b D7, spec 11): the words added with Insert word or Spell, in
// the order added, each with its case as typed, in one EEPROM record (plan 15 D2). It is written
// at once, so user words survive a power cycle (D7: a deliberate deviation from the emulator,
// Open question 5), and Restore factory settings keeps it (UNVERIFIED).
import type { EepromRecord } from "../../firmware/eeprom";

export interface T9UserState {
  /** Oldest first. */
  readonly words: readonly string[];
}

/** The store's byte budget: each word costs its length plus one (spec 11, fitted). */
export const T9_USER_BUDGET = 840;

const cost = (words: readonly string[]): number =>
  words.reduce((sum, word) => sum + Array.from(word).length + 1, 0);

/** A storable user word: non-empty, no spaces. */
function wordLike(value: unknown): value is string {
  return typeof value === "string" && value !== "" && !/\s/.test(value);
}

/**
 * `word` added (D7): a word already present (same letters and case) changes nothing; otherwise it
 * is appended and the oldest words are dropped until the budget holds.
 */
export function addUserWord(state: T9UserState, word: string): T9UserState {
  if (!wordLike(word) || state.words.includes(word)) return state;
  const words = [...state.words, word];
  while (words.length > 1 && cost(words) > T9_USER_BUDGET) words.shift();
  return { words };
}

export const T9_USER_RECORD: EepromRecord<T9UserState> = {
  name: "t9-user",
  version: 1,
  initial: () => ({ words: [] }),
  decode(data) {
    const words = (data as { words?: unknown }).words;
    if (!Array.isArray(words)) throw new Error("words must be a list.");
    return { words: words.filter(wordLike).reduce<T9UserState>(addUserWord, { words: [] }).words };
  },
  encode: (state) => ({ words: [...state.words] }),
};
