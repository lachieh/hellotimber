// T9 dictionaries (plan 18b D3, D4): the generated word list parsed into words and weights, and
// the index the engine reads, built on first lookup. Pure: no I/O, no clock.
//
// A dictionary's source lists its words in descending frequency, one per line; a line `#<w>` sets
// the weight 2^(w/4) of the words after it (scripts/build-t9-dictionary.ts writes it from the open
// list). For a key sequence the index gives the words of exactly that many letters, best first
// (ties in list order), and the stems: the first letters of longer words whose keys begin with the
// sequence, ranked by the summed weight of the words they begin (ties: first occurrence), a stem
// that is also a word left out (docs/specs/t9-behaviour.md 3.1).
import { MULTITAP_KEYS, type TextKey } from "../keys";

/** Plan 18b: a T9 language dictionary (opaque; build it with `createT9Dictionary`). */
export interface T9Dictionary {
  readonly language: "english";
  /** Number of words. */
  readonly size: number;
}

/** The engine's view of a dictionary. */
export interface T9Index {
  /** Exact-length words for a key sequence, best first. */
  words(keys: string): readonly string[];
  /** Stems for a key sequence, best first (spec 3.1). */
  stems(keys: string): readonly string[];
}

/** Keys 2-9 by letter (spec 2); the apostrophe and full stop are key 1. */
const LETTER_KEYS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    (["2abc", "3def", "4ghi", "5jkl", "6mno", "7pqrs", "8tuv", "9wxyz"] as const).flatMap(
      ([key, ...letters]) => letters.map((letter) => [letter, key]),
    ),
  ),
  "'": "1",
  ".": "1",
};

/** Any other character: the key whose multi-tap cycle carries it (plan 18's table, spec 2). */
const CYCLE_KEYS: ReadonlyMap<string, string> = new Map(
  (Object.entries(MULTITAP_KEYS) as [TextKey, (typeof MULTITAP_KEYS)[TextKey]][])
    .filter(([key]) => key !== "0")
    .flatMap(([key, cycles]) => [...cycles.upper, ...cycles.lower].map((ch) => [ch, key])),
);

/**
 * The keys that spell `word`: letters to 2-9, the apostrophe and full stop to 1, any other
 * character to the key whose multi-tap cycle has it (a user word's `é`: 3). Undefined when a
 * character has no key (a space, most symbols).
 */
export function keysOf(word: string): string | undefined {
  let keys = "";
  for (const ch of word) {
    const key = LETTER_KEYS[ch.toLowerCase()] ?? CYCLE_KEYS.get(ch);
    if (key === undefined) return undefined;
    keys += key;
  }
  return keys;
}

const WORD = /^[a-z]+(?:'[a-z]+)?$/;
const WEIGHT = /^#(\d+)$/;

interface Trie {
  /** Ids of the words whose keys pass through this node, in list order. */
  readonly ids: number[];
  readonly next: Map<string, Trie>;
}

class Dictionary implements T9Dictionary {
  readonly language: "english";
  readonly size: number;
  readonly #words: readonly string[];
  readonly #weights: readonly number[];
  #root: Trie | undefined;
  readonly #lists = new Map<string, { words: string[]; stems: string[] }>();

  constructor(language: "english", words: readonly string[], weights: readonly number[]) {
    this.language = language;
    this.size = words.length;
    this.#words = words;
    this.#weights = weights;
  }

  /** The index, built on the first lookup. */
  get index(): T9Index {
    return {
      words: (keys) => this.#lookup(keys).words,
      stems: (keys) => this.#lookup(keys).stems,
    };
  }

  #trie(): Trie {
    if (this.#root !== undefined) return this.#root;
    const root: Trie = { ids: [], next: new Map() };
    this.#words.forEach((word, id) => {
      let node = root;
      for (const ch of word) {
        const key = LETTER_KEYS[ch]!;
        let child = node.next.get(key);
        if (child === undefined) node.next.set(key, (child = { ids: [], next: new Map() }));
        child.ids.push(id);
        node = child;
      }
    });
    this.#root = root;
    return root;
  }

  #lookup(keys: string): { words: string[]; stems: string[] } {
    const known = this.#lists.get(keys);
    if (known !== undefined) return known;
    let node: Trie | undefined = this.#trie();
    for (const key of keys) node = node?.next.get(key);
    const n = keys.length;
    const exact: number[] = [];
    const sums = new Map<string, { sum: number; first: number }>();
    for (const id of node?.ids ?? []) {
      const word = this.#words[id]!;
      if (word.length === n) {
        exact.push(id);
        continue;
      }
      const stem = word.slice(0, n);
      const entry = sums.get(stem);
      const weight = 2 ** (this.#weights[id]! / 4);
      if (entry === undefined) sums.set(stem, { sum: weight, first: id });
      else entry.sum += weight;
    }
    // Stable sorts: ties keep list order.
    exact.sort((a, b) => this.#weights[b]! - this.#weights[a]!);
    const words = exact.map((id) => this.#words[id]!);
    const stems = [...sums]
      .filter(([stem]) => !words.includes(stem))
      .sort(([, a], [, b]) => b.sum - a.sum || a.first - b.first)
      .map(([stem]) => stem);
    const lists = { words, stems };
    this.#lists.set(keys, lists);
    return lists;
  }
}

/**
 * Plan 18b: a dictionary from the generated format (D3): words in descending frequency, one per
 * line, `#<w>` lines setting the weight 2^(w/4) of the words after them. Throws on a malformed
 * line, naming it.
 */
export function createT9Dictionary(language: "english", source: string): T9Dictionary {
  const words: string[] = [];
  const weights: number[] = [];
  const lines = source.split("\n");
  let weight: number | undefined;
  lines.forEach((line, i) => {
    if (line === "" && i === lines.length - 1) return;
    const fail = (why: string): never => {
      throw new Error(`T9 dictionary line ${i + 1} ("${line}"): ${why}`);
    };
    const w = WEIGHT.exec(line);
    if (w !== null) {
      weight = Number(w[1]);
      return;
    }
    if (line.startsWith("#")) fail("a weight line is `#` and an integer");
    if (!WORD.test(line) || line.length > 32) fail("not a lower-case word");
    if (weight === undefined) fail("a word before the first weight line");
    words.push(line);
    weights.push(weight!);
  });
  return new Dictionary(language, words, weights);
}

/** The index of `dict` (built on its first lookup). */
export function t9Index(dict: T9Dictionary): T9Index {
  if (!(dict instanceof Dictionary)) {
    throw new Error("Not a T9 dictionary: build one with createT9Dictionary.");
  }
  return dict.index;
}
