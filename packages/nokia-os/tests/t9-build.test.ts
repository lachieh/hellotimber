// Plan 18b Task 3: the T9 English dictionary build (scripts/build-t9-dictionary.ts) on an
// in-memory sample of the open list's format (word, space, count; descending count). The words
// and counts below are invented for the test.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  ENGLISH_SOURCE,
  formatDictionary,
  keepWord,
  selectWords,
  weightOf,
  writeDictionaryModule,
} from "../scripts/build-t9-dictionary.ts";

const SAMPLE = [
  "the 1048576",
  "of 1000000",
  "b 900000", // a single letter other than a and i
  "a 800000",
  "Into 700000", // upper case
  "i 600000",
  "don't 590000",
  "'tis 580000", // apostrophe first
  "dogs' 570000", // apostrophe last
  "rock'n'roll 560000", // two apostrophes
  "café 550000", // outside a-z
  "co-op 540000",
  "x86 530000",
  `${"a".repeat(33)} 520000`, // 33 letters
  `${"b".repeat(32)} 510000`, // 32 letters
  "home 65536",
  "good 65536",
  "gone 4096",
].join("\n");

describe("keepWord (D3 filter)", () => {
  it("keeps lower-case a-z words of 1-32 letters with at most one inner apostrophe", () => {
    for (const word of ["the", "a", "i", "don't", "b".repeat(32), "o'clock"]) {
      expect(keepWord(word), word).toBe(true);
    }
    for (const word of [
      "b",
      "z",
      "Into",
      "'tis",
      "dogs'",
      "rock'n'roll",
      "café",
      "co-op",
      "x86",
      "a".repeat(33),
      "",
      "'",
    ]) {
      expect(keepWord(word), word).toBe(false);
    }
  });
});

describe("selectWords", () => {
  it("takes the first N kept words in file order", () => {
    expect(selectWords(SAMPLE, 100).map((e) => e.word)).toEqual([
      "the",
      "of",
      "a",
      "i",
      "don't",
      "b".repeat(32),
      "home",
      "good",
      "gone",
    ]);
    expect(selectWords(SAMPLE, 3).map((e) => e.word)).toEqual(["the", "of", "a"]);
  });

  it("names a malformed line", () => {
    expect(() => selectWords("the 10\nof\n", 10)).toThrow(/line 2/);
    expect(() => selectWords("the 10\nof ten\n", 10)).toThrow(/line 2/);
  });

  it("rejects a list that is not in descending count order", () => {
    expect(() => selectWords("of 5\nthe 10\n", 10)).toThrow(/line 2/);
  });

  it("ignores a trailing newline", () => {
    expect(selectWords("the 10\n", 10)).toEqual([{ word: "the", count: 10 }]);
  });
});

describe("weightOf", () => {
  it("is floor(4 * log2(count))", () => {
    expect(weightOf(1)).toBe(0);
    expect(weightOf(2)).toBe(4);
    expect(weightOf(3)).toBe(6); // 4 * 1.585 = 6.34
    expect(weightOf(65536)).toBe(64);
    expect(weightOf(1048576)).toBe(80);
    expect(weightOf(1000000)).toBe(79); // 4 * 19.93 = 79.7
  });
});

describe("formatDictionary", () => {
  it("writes one word per line, a weight line only where the weight changes", () => {
    expect(formatDictionary(selectWords(SAMPLE, 100))).toBe(
      [
        "#80",
        "the",
        "#79",
        "of",
        "#78",
        "a",
        "#76",
        "i",
        "don't",
        "#75",
        "b".repeat(32),
        "#64",
        "home",
        "good",
        "#48",
        "gone",
      ].join("\n"),
    );
  });
});

describe("writeDictionaryModule", () => {
  const bytes = new TextEncoder().encode(SAMPLE);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  it("checks the source's SHA-256", () => {
    expect(() =>
      writeDictionaryModule(bytes, { ...ENGLISH_SOURCE, sha256: "0".repeat(64) }),
    ).toThrow(/SHA-256/);
  });

  it("writes a header with the provenance and one exported string, deterministically", () => {
    const source = { ...ENGLISH_SOURCE, sha256, limit: 100 };
    const module = writeDictionaryModule(bytes, source);
    expect(module).toBe(writeDictionaryModule(bytes, source));
    for (const fact of [
      ENGLISH_SOURCE.repository,
      ENGLISH_SOURCE.commit,
      ENGLISH_SOURCE.file,
      sha256,
      "MIT",
      "9 words",
    ]) {
      expect(module).toContain(fact);
    }
    expect(module).toContain(
      "export const ENGLISH_T9_WORDS = `#80\nthe\n#79\nof\n#78\na\n#76\ni\ndon't\n",
    );
  });
});

describe("the committed dictionary", () => {
  const generated = readFileSync(
    join(import.meta.dirname, "../src/text/t9/generated/english.ts"),
    "utf8",
  );

  it("records the pinned source (D2)", () => {
    expect(ENGLISH_SOURCE).toMatchObject({
      repository: "https://github.com/IlyaSemenov/wikipedia-word-frequency",
      file: "results/enwiki-2023-04-13.txt",
      commit: "798ea9062d6e5aed1fa87deeeda1cd99d5b37903",
      sha256: "e2071140a49a6c40c732bd68c36836ef13c0978233fb3d5e1b2a3c2d34faef59",
      limit: 30000,
    });
    expect(generated).toContain(ENGLISH_SOURCE.sha256);
    expect(generated).toContain("30000 words");
  });
});
