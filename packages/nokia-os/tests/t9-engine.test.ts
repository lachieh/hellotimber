// Plan 18b Task 4: the T9 engine against docs/specs/t9-behaviour.md, on the hand-made fixture
// dictionary (tests/support/t9-fixture.ts) and a few inline ones. Section numbers are the spec's.
import { describe, expect, it } from "vite-plus/test";
import { englishT9 } from "../src/text/t9/english";
import {
  createT9Dictionary,
  keysOf,
  t9Candidates,
  t9Delete,
  t9Display,
  t9FromWord,
  t9Index,
  t9Key,
  t9Matches,
  t9Star,
  t9Use,
  type T9Composing,
  type T9Dictionary,
  type T9Key,
} from "../src/text/t9";
import { T9_FIXTURE as DICT, T9_FIXTURE_WORDS } from "./support/t9-fixture.ts";

const NONE: readonly string[] = [];

/** Types `keys` from nothing (lower case unless `upper` says otherwise per key). */
function type(
  keys: string,
  user: readonly string[] = NONE,
  dict: T9Dictionary = DICT,
  upper: (i: number) => boolean = () => false,
): T9Composing | null {
  let state: T9Composing | null = null;
  Array.from(keys).forEach((key, i) => {
    state = t9Key(state, key as T9Key, upper(i), dict, user);
  });
  return state;
}

function typed(keys: string, user: readonly string[] = NONE, dict = DICT): T9Composing {
  const state = type(keys, user, dict);
  if (state === null) throw new Error(`no composing word for ${keys}`);
  return state;
}

/** `*` pressed `n` times. */
function star(state: T9Composing, n: number, user = NONE, dict = DICT): T9Composing {
  let s = state;
  for (let i = 0; i < n; i++) s = t9Star(s, dict, user);
  return s;
}

/** What the editor shows: the candidate, `?` when it is drawn. */
function shown(state: T9Composing | null, user = NONE, dict = DICT): string {
  if (state === null) return "(none)";
  const display = t9Display(state, dict, user);
  return display.question ? `${display.text}?` : display.text;
}

/** The displays of typing `keys` and pressing `*` `n` times. */
function cycle(keys: string, n: number, user = NONE, dict = DICT): string[] {
  let state = typed(keys, user, dict);
  const out = [shown(state, user, dict)];
  for (let i = 0; i < n; i++) {
    state = t9Star(state, dict, user);
    out.push(shown(state, user, dict));
  }
  return out;
}

describe("createT9Dictionary", () => {
  it("counts the words and names a malformed line", () => {
    expect(DICT).toMatchObject({ language: "english", size: T9_FIXTURE_WORDS.length });
    expect(() => createT9Dictionary("english", "the")).toThrow(/line 1/);
    expect(() => createT9Dictionary("english", "#10\nthe\nThe")).toThrow(/line 3/);
    expect(() => createT9Dictionary("english", "#10\nthe\n#x")).toThrow(/line 3/);
    expect(() => createT9Dictionary("english", "#10\nthe\n\nof")).toThrow(/line 3/);
    expect(createT9Dictionary("english", "#10\nthe\n").size).toBe(1);
  });

  it("indexes the shipped English dictionary in under 150 ms", () => {
    const start = performance.now();
    expect(t9Index(englishT9).words("4663")).toContain("good");
    expect(performance.now() - start).toBeLessThan(150);
    expect(englishT9.size).toBe(30000);
  });
});

describe("keysOf", () => {
  it("maps letters to 2-9 and the apostrophe and full stop to 1", () => {
    expect(keysOf("don't")).toBe("36618");
    expect(keysOf("Into.")).toBe("46861");
    expect(keysOf("wxyz")).toBe("9999");
  });

  it("maps other characters through the multi-tap table; none for a character no key types", () => {
    expect(keysOf("café")).toBe("2233");
    expect(keysOf("b4")).toBe("24");
    expect(keysOf("a b")).toBeUndefined();
    expect(keysOf("(")).toBeUndefined();
  });
});

describe("candidate lists (3.1, 3.3)", () => {
  it("lists words of exactly n letters by weight, ties in list order, then stems", () => {
    expect(t9Candidates(DICT, NONE, "4663")).toEqual(["good", "home", "gone", "hood", "inne"]);
    expect(t9Candidates(DICT, NONE, "46637")).toEqual(["inner", "homes"]);
  });

  it("ranks stems by the summed weight of the words they begin", () => {
    // `ga` begins one word of weight 2^10; `ha` three of 2^9 each.
    const dict = createT9Dictionary("english", "#40\ngab\n#36\nhab\nhac\nhad");
    expect(t9Candidates(dict, NONE, "42")).toEqual(["ha", "ga"]);
    // Equal sums keep the order of their first word.
    const tie = createT9Dictionary("english", "#40\nhab\ngab");
    expect(t9Candidates(tie, NONE, "42")).toEqual(["ha", "ga"]);
    expect(t9Candidates(DICT, NONE, "466")).toEqual(["goo", "hom", "gon", "hoo", "inn"]);
  });

  it("lists a stem that is also a word once, as the word", () => {
    expect(t9Candidates(DICT, NONE, "46")).toEqual(["in", "go", "ho"]);
  });

  it("has no list where no word follows", () => {
    expect(t9Candidates(DICT, NONE, "46639")).toBeNull();
  });

  it("considers at most 32 candidates", () => {
    const words = Array.from({ length: 40 }, (_, i) => {
      const letters = "pqrs";
      return letters[i % 4]! + letters[Math.floor(i / 4) % 4]! + letters[Math.floor(i / 16)]!;
    });
    const dict = createT9Dictionary("english", `#20\n${words.join("\n")}`);
    const list = t9Candidates(dict, NONE, "777")!;
    expect(list).toHaveLength(32);
    expect(list).toEqual(words.slice(0, 32));
  });
});

describe("single keys (3.4)", () => {
  it("lists the key's letters, ranked, then its digit", () => {
    expect(t9Candidates(DICT, NONE, "2")).toEqual(["a", "b", "c", "2"]);
    expect(t9Candidates(DICT, NONE, "8")).toEqual(["t", "v", "8"]);
    expect(t9Candidates(DICT, NONE, "9")).toEqual(["9"]);
  });

  it("never shows ? on a one-key list, and wraps", () => {
    expect(cycle("2", 4)).toEqual(["a", "b", "c", "2", "a"]);
  });
});

describe("the end of the list (4.2)", () => {
  it("shows ? on the last candidate * reaches, then wraps to the first", () => {
    expect(cycle("4663", 6)).toEqual(["good", "home", "gone", "hood", "inne?", "good", "home"]);
  });

  it("shows a one-entry list plainly, then with ? on every *", () => {
    expect(cycle("43556", 3)).toEqual(["hello", "hello?", "hello?", "hello?"]);
  });

  it("does not show ? on the last candidate when typing reaches it", () => {
    expect(shown(typed("843"))).toBe("the");
    expect(t9Display(star(typed("843"), 1), DICT, NONE)).toEqual({
      text: "tid",
      question: true,
      keyed: 3,
    });
  });
});

describe("keys that match nothing (6)", () => {
  it("ignores a second key that has no list, silently", () => {
    const one = typed("9");
    expect(t9Key(one, "5", false, DICT, NONE)).toBe(one);
    expect(shown(t9Key(one, "5", false, DICT, NONE))).toBe("9");
  });

  it("keeps the shown candidate with ? after two keys or more, and ignores letter keys", () => {
    const into = star(typed("4663"), 1); // home
    const nomatch = t9Key(into, "9", false, DICT, NONE)!;
    expect(nomatch).toMatchObject({ keys: "4663", index: 1, noMatch: true });
    expect(shown(nomatch)).toBe("home?");
    expect(t9Key(nomatch, "2", false, DICT, NONE)).toBe(nomatch);
    expect(t9Key(nomatch, "1", false, DICT, NONE)).toBe(nomatch);
  });

  it("* with three candidates or more: the second, as from the first", () => {
    let state = t9Key(typed("4663"), "9", false, DICT, NONE)!;
    const out: string[] = [];
    for (let i = 0; i < 6; i++) {
      state = t9Star(state, DICT, NONE);
      out.push(shown(state));
    }
    expect(out).toEqual(["home", "gone", "hood", "inne?", "good", "home"]);
  });

  it("* with two candidates: the first again with ?, then plain, then the cycle", () => {
    let state = t9Key(typed("843"), "9", false, DICT, NONE)!;
    expect(shown(state)).toBe("the?");
    const out: string[] = [];
    for (let i = 0; i < 4; i++) {
      state = t9Star(state, DICT, NONE);
      out.push(shown(state));
    }
    expect(out).toEqual(["the?", "the", "tid?", "the"]);
  });

  it("* with one candidate: it, with ?, every time", () => {
    let state = t9Key(typed("43556"), "2", false, DICT, NONE)!;
    const out = [shown(state)];
    for (let i = 0; i < 3; i++) {
      state = t9Star(state, DICT, NONE);
      out.push(shown(state));
    }
    expect(out).toEqual(["hello?", "hello?", "hello?", "hello?"]);
  });

  it("C removes the last kept key and shows the shorter sequence's first candidate", () => {
    const nomatch = t9Key(star(typed("4663"), 2), "9", false, DICT, NONE)!;
    const shorter = t9Delete(nomatch, DICT, NONE)!;
    expect(shorter).toMatchObject({ keys: "466", index: 0, noMatch: false, viaStar: false });
    expect(shown(shorter)).toBe("goo");
  });

  it("puts the 33rd letter key in the no-match state", () => {
    const long = "abcdefghijklmnopqrstuvwxyzabcdef";
    const dict = createT9Dictionary("english", `#10\n${long}`);
    const state = typed(keysOf(long)!, NONE, dict);
    expect(shown(state, NONE, dict)).toBe(long);
    const more = t9Key(state, "2", false, dict, NONE)!;
    expect(more.noMatch).toBe(true);
    expect(more.keys).toHaveLength(32);
  });
});

describe("key 1 (7)", () => {
  it("alone: the punctuation list and 1, no ?", () => {
    expect(cycle("1", 9)).toEqual([".", ",", "-", "?", "!", "'", "@", ":", "1", "."]);
  });

  it("after a word: the word as shown with each mark, ? on the last when nothing follows", () => {
    expect(cycle("8431", 8)).toEqual([
      "the.",
      "the,",
      "the-",
      "the?",
      "the!",
      "the'",
      "the@",
      "the:?",
      "the.",
    ]);
  });

  it("after a word: the dictionary's entries after the marks, without duplicates", () => {
    // `home` shown, then 1: the stem `good'` follows the marks and is the last.
    const home = star(typed("4663"), 1);
    const state = t9Key(home, "1", false, DICT, NONE)!;
    expect(t9Candidates(DICT, NONE, state.keys, state.fixed)).toEqual([
      "home.",
      "home,",
      "home-",
      "home?",
      "home!",
      "home'",
      "home@",
      "home:",
      "good'",
    ]);
    expect(shown(star(state, 8))).toBe("good'?");
  });

  it("after a word: no ? when the dictionary's last entry was a duplicate", () => {
    // `don` then 1: the stem `don'` is the mark `'` again.
    const state = typed("3661");
    expect(t9Candidates(DICT, NONE, state.keys, state.fixed)).toHaveLength(8);
    const shownAll = [shown(state)];
    let s = state;
    for (let i = 0; i < 8; i++) {
      s = t9Star(s, DICT, NONE);
      shownAll.push(shown(s));
    }
    expect(shownAll).toEqual([
      "don.",
      "don,",
      "don-",
      "don?",
      "don!",
      "don'",
      "don@",
      "don:",
      "don.",
    ]);
  });

  it("then letters: contractions first, then the word joined by ' and by . (D10)", () => {
    const state = typed("36618");
    expect(shown(state)).toBe("don't");
    expect(t9Candidates(DICT, NONE, state.keys, state.fixed)).toEqual([
      "don't",
      "don'v",
      "don.t",
      "don.v",
    ]);
  });

  it("two presses of 1 cycle the last mark after the first", () => {
    const comma = star(typed("1"), 1);
    const twice = t9Key(comma, "1", false, DICT, NONE)!;
    expect(cycle("1", 0)).toEqual(["."]);
    expect([shown(twice), shown(star(twice, 1)), shown(star(twice, 2))]).toEqual([
      ",.",
      ",,",
      ",-",
    ]);
  });
});

describe("case (8)", () => {
  it("keeps each letter's case as typed for every candidate", () => {
    const upper = (i: number) => i === 0 || i === 3;
    const state = type("4663", NONE, DICT, upper)!;
    expect(shown(state)).toBe("GooD");
    expect(shown(t9Star(state, DICT, NONE))).toBe("HomE");
  });
});

describe("re-entry (9)", () => {
  it("makes a shown word the composing word again, on its own list", () => {
    const state = t9FromWord("Gone", DICT, NONE)!;
    expect(state).toMatchObject({ keys: "4663", index: 2, noMatch: false, viaStar: false });
    expect(shown(state)).toBe("Gone");
    expect(shown(t9Star(state, DICT, NONE))).toBe("Hood");
    expect(shown(t9Delete(state, DICT, NONE))).toBe("Goo");
  });

  it("re-enters words with marks", () => {
    expect(shown(t9FromWord("home,", DICT, NONE))).toBe("home,");
    expect(shown(t9FromWord("don't", DICT, NONE))).toBe("don't");
    expect(shown(t9FromWord("?", DICT, NONE))).toBe("?");
  });

  it("does not re-enter a word its lists lack", () => {
    expect(t9FromWord("xyzzy", DICT, NONE)).toBeNull();
    expect(t9FromWord("a(b", DICT, NONE)).toBeNull();
  });
});

describe("C (5)", () => {
  it("removes the last key; the only key removes the word", () => {
    const state = typed("4663");
    const shorter = t9Delete(state, DICT, NONE)!;
    expect(shown(shorter)).toBe("goo");
    expect(t9Delete(typed("4"), DICT, NONE)).toBeNull();
  });
});

describe("Matches (10.2)", () => {
  it("lists the candidates after the current one, the current last; Use shows the chosen", () => {
    const state = star(typed("4663"), 1);
    expect(t9Matches(state, DICT, NONE)).toEqual(["gone", "hood", "inne", "good", "home"]);
    const used = t9Use(state, 3, DICT, NONE);
    expect(used).toMatchObject({ index: 0, viaStar: false, noMatch: false });
    expect(shown(used)).toBe("good");
  });
});

describe("the fixture (property)", () => {
  it("reaches every word by its keys and at most 32 *", () => {
    for (const word of T9_FIXTURE_WORDS) {
      let state = typed(keysOf(word)!);
      let found = shown(state) === word;
      for (let i = 0; i < 32 && !found; i++) {
        state = t9Star(state, DICT, NONE);
        found = t9Display(state, DICT, NONE).text === word;
      }
      expect(found, word).toBe(true);
    }
  });
});
