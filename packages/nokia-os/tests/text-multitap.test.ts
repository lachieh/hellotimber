import { describe, expect, it } from "vite-plus/test";
import { TEXT_TIMINGS } from "../src/resources";
import { MULTITAP_KEYS, SYMBOLS, TYPEABLE } from "../src/text/keys";
import {
  emptyText,
  shownMode,
  textClear,
  textDelete,
  textHold,
  textInsert,
  textKey,
  textMove,
  textTick,
  type TextInputKey,
  type TextState,
} from "../src/text/multitap";

const LIMIT = 459;
const COMMIT = TEXT_TIMINGS.commitMs;

/** Presses `keys` 100 ms apart from `at`, each a separate tap (same keys cycle). */
function type(keys: string, state: TextState = emptyText(), at = 0, limit = LIMIT): TextState {
  let s = state;
  Array.from(keys).forEach((key, i) => {
    s = textKey(s, key as TextInputKey, at + i * 100, limit);
  });
  return s;
}

/** Types `keys`, then lets every pending character commit. */
function typed(keys: string, state: TextState = emptyText(), limit = LIMIT): TextState {
  return textTick(type(keys, state, 0, limit), 1_000_000);
}

/** Text typed as key runs, each committed before the next (`"44"` is H, `"2"` then `"22"` Ab). */
function words(...groups: string[]): TextState {
  let s = emptyText();
  let at = 0;
  for (const group of groups) {
    s = type(group, s, at);
    at += group.length * 100 + COMMIT + 10;
    s = textTick(s, at);
  }
  return s;
}

describe("multi-tap tables (plan 18 Task 0)", () => {
  it("has 149 typeable characters: every cycle and the 31 symbols", () => {
    expect(TYPEABLE.size).toBe(149);
    expect(SYMBOLS).toHaveLength(31);
    expect(MULTITAP_KEYS["1"].lower).toEqual([".", ",", "'", "?", "!", "-", "&", "1"]);
    expect(MULTITAP_KEYS["7"].lower.at(-1)).toBe("ß");
  });
});

describe("textKey", () => {
  it("cycles a key's characters while pending and wraps to the first", () => {
    let s = emptyText("ABC");
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      s = textKey(s, "2", i * 100, LIMIT);
      seen.push(s.text);
    }
    expect(seen).toEqual([...Array.from("ABC2ÄÀÁÂÃÆÇ"), "A"]);
    expect(s.pending).toEqual({ key: "2", index: 0, sinceMs: 1100 });
    expect(s.cursor).toBe(1);
  });

  it("types space then 0 on key 0", () => {
    expect(type("0").text).toBe(" ");
    expect(type("00").text).toBe("0");
  });

  it("commits the pending character when another key is pressed", () => {
    const s = type("23");
    expect(s.text).toBe("Ad");
    expect(s.pending).toMatchObject({ key: "3", index: 0 });
    expect(s.cursor).toBe(2);
  });

  it("commits the pending character after the commit time; the same key then starts anew", () => {
    let s = textKey(emptyText(), "2", 0, LIMIT);
    expect(textTick(s, COMMIT - 1).pending).not.toBeNull();
    s = textTick(s, COMMIT);
    expect(s.pending).toBeNull();
    expect(textKey(s, "2", COMMIT + 10, LIMIT).text).toBe("Aa");
    // Before the commit, the same key cycles (text/commit-gap 1400).
    expect(textKey(textKey(emptyText(), "2", 0, LIMIT), "2", COMMIT - 1, LIMIT).text).toBe("B");
  });

  it("uses sentence case: upper at the start and after . ? ! and a space, lower elsewhere", () => {
    expect(type("2").text).toBe("A");
    expect(type("22").text).toBe("B");
    expect(words("2", "22", "1", "0", "2").text).toBe("Ab. A"); // text/case-after after-dot-2
    expect(words("2", "22", "1111", "0", "2").text).toBe("Ab? A");
    expect(words("2", "22", "11111", "0", "2").text).toBe("Ab! A");
    expect(words("2", "22", "0", "2").text).toBe("Ab a");
  });

  it("uses the lower cycles mid-sentence: key 1 has 8 characters, key 7 ends with ß", () => {
    const base = words("2");
    expect(type("111111111", base, 100_000).text).toBe("A.");
    expect(type("7777777", base, 100_000).text).toBe("Aß");
    expect(type("11111111111").text).toBe("/");
  });

  it("ignores a new character at the limit but still cycles a pending last one", () => {
    const full = type("23", emptyText(), 0, 2);
    expect(full.text).toBe("Ad");
    expect(textKey(full, "3", 300, 2).text).toBe("Ae");
    // Another key commits the pending last character and types nothing (text/counter 460).
    expect(textKey(full, "4", 300, 2)).toMatchObject({ text: "Ad", cursor: 2, pending: null });
    // A full message with its last character committed ignores every key (text/hold-full).
    const committed = textTick(full, 10_000);
    expect(textKey(committed, "3", 20_000, 2)).toEqual(committed);
  });

  it("inserts at the cursor in the middle of the text", () => {
    let s = words("44", "33", "555", "555", "666"); // Hello
    s = textMove(textMove(textMove(s, "down"), "down"), "down");
    expect(s.cursor).toBe(2);
    s = type("99", s, 100_000);
    expect(s).toMatchObject({ text: "Hexllo", cursor: 3, pending: { key: "9", index: 1 } });
  });
});

describe("the # key", () => {
  const modes = (state: TextState, presses: number): string[] => {
    const out = [shownMode(state)];
    let s = state;
    for (let i = 0; i < presses; i++) {
      s = textKey(s, "#", 100 * i, LIMIT);
      out.push(shownMode(s));
    }
    return out;
  };

  it("cycles Abc, ABC, abc at a sentence start (text/case-cycle-empty, -sentence)", () => {
    expect(modes(emptyText(), 4)).toEqual(["Abc", "ABC", "abc", "Abc", "ABC"]);
    expect(modes(words("2", "22", "1", "0"), 3)).toEqual(["Abc", "ABC", "abc", "Abc"]);
  });

  it("alternates abc and ABC mid-sentence (text/case-cycle-word, -space)", () => {
    expect(modes(words("2", "22"), 4)).toEqual(["abc", "ABC", "abc", "ABC", "abc"]);
    expect(modes(words("2", "22", "0"), 4)).toEqual(["abc", "ABC", "abc", "ABC", "abc"]);
  });

  it("types in the chosen case", () => {
    const upper = textKey(emptyText(), "#", 0, LIMIT);
    expect(type("2", upper, 100).text).toBe("A");
    expect(type("2", textKey(upper, "#", 0, LIMIT), 100).text).toBe("a");
    expect(typed("22", typed("2", upper)).text).toBe("AB");
  });

  it("enters 123 when held and leaves it when held again (text/hold-hash, -back)", () => {
    const numbers = textHold(emptyText(), "#", 1010, LIMIT);
    expect(shownMode(numbers)).toBe("123");
    expect(type("23", numbers, 2000).text).toBe("23");
    // Tap # in 123 types it; a hold returns to letters.
    const hash = textKey(type("23", numbers, 2000), "#", 3000, LIMIT);
    expect(hash.text).toBe("23#");
    expect(shownMode(textHold(hash, "#", 4000, LIMIT))).toBe("abc");
  });

  it("returns from 123 to ABC, or to sentence case from Abc and abc (text/case-numeric-back-after)", () => {
    const back = (state: TextState): string =>
      shownMode(textHold(textHold(state, "#", 0, LIMIT), "#", 0, LIMIT));
    const upper = textKey(emptyText(), "#", 0, LIMIT);
    const lower = textKey(upper, "#", 0, LIMIT);
    expect([back(emptyText()), back(upper), back(lower)]).toEqual(["Abc", "ABC", "Abc"]);
  });
});

describe("held digits", () => {
  it("replace the pending letter with the digit and commit it (text/hold-digit)", () => {
    const pending = textKey(emptyText(), "2", 0, LIMIT);
    expect(textHold(pending, "2", 1475, LIMIT)).toMatchObject({
      text: "2",
      cursor: 1,
      pending: null,
    });
    expect(textHold(textKey(words("2"), "0", 0, LIMIT), "0", 1475, LIMIT).text).toBe("A0");
    expect(textHold(textKey(emptyText(), "1", 0, LIMIT), "1", 1475, LIMIT).text).toBe("1");
  });

  it("type the digit once in 123 (text/hold-numeric)", () => {
    const numbers = textHold(emptyText(), "#", 0, LIMIT);
    const s = textKey(numbers, "2", 0, LIMIT);
    expect(textHold(s, "2", 1475, LIMIT).text).toBe("2");
  });
});

describe("textMove", () => {
  const hello = words("44", "33", "555", "555", "666");

  it("moves right on ▲ and left on ▼, wrapping at either end", () => {
    expect(hello.cursor).toBe(5);
    expect(textMove(hello, "up").cursor).toBe(0);
    expect(textMove(textMove(hello, "up"), "up").cursor).toBe(1);
    expect(textMove(hello, "down").cursor).toBe(4);
    expect(textMove({ ...hello, cursor: 0 }, "down").cursor).toBe(5);
  });

  it("commits a pending character first", () => {
    expect(textMove(type("4433"), "down")).toMatchObject({ text: "He", cursor: 1, pending: null });
  });

  it("stays at 0 in an empty text", () => {
    expect(textMove(emptyText(), "up").cursor).toBe(0);
    expect(textMove(emptyText(), "down").cursor).toBe(0);
  });
});

describe("textDelete and textClear", () => {
  const hello = words("44", "33", "555", "555", "666");

  it("deletes a pending character, then left of the cursor (text/delete)", () => {
    const pending = type("666", words("44", "33", "555", "555"), 100_000);
    expect(textDelete(pending)).toMatchObject({ text: "Hell", cursor: 4, pending: null });
    expect(textDelete(hello)).toMatchObject({ text: "Hell", cursor: 4 });
    expect(textDelete({ ...hello, cursor: 2 })).toMatchObject({ text: "Hllo", cursor: 1 });
    expect(textDelete({ ...hello, cursor: 0 })).toMatchObject({ text: "Hello", cursor: 0 });
  });

  it("clears the text, keeping the mode", () => {
    const upper: TextState = { ...hello, mode: "ABC" };
    expect(textClear(upper)).toMatchObject({ text: "", cursor: 0, pending: null, mode: "ABC" });
  });
});

describe("textInsert", () => {
  it("inserts symbols and numbers at the cursor, committing a pending character", () => {
    expect(textInsert(type("2"), "€", LIMIT)).toMatchObject({
      text: "A€",
      cursor: 2,
      pending: null,
    });
    expect(textInsert({ ...words("44", "2"), cursor: 1 }, "0400", LIMIT)).toMatchObject({
      text: "H0400a",
      cursor: 5,
    });
  });

  it("stops at the limit", () => {
    expect(textInsert(typed("23", emptyText(), 3), "+-", 3).text).toBe("Ad+");
  });
});

describe("shownMode", () => {
  it("shows Abc while a letter is pending at a sentence start, abc after it commits", () => {
    expect(shownMode(type("2"))).toBe("Abc");
    expect(shownMode(typed("2"))).toBe("abc");
    expect(shownMode(words("2", "22", "1", "0"))).toBe("Abc");
  });
});
