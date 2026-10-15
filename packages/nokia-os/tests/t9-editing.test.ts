// Plan 18b Task 6: the editor's text in T9 mode (src/text/t9/editing.ts) on the fixture
// dictionary: `0`, `#`, holds, C across words, word stops, insertions (spec 5, 8, 9, 10.3).
import { describe, expect, it } from "vite-plus/test";
import { emptyText, type TextState } from "../src/text/multitap";
import {
  composingWord,
  t9ClearText,
  t9DeleteKey,
  t9Hash,
  t9HoldDigit,
  t9HoldHash,
  t9InsertText,
  t9MoveKey,
  t9ReplaceComposing,
  t9Space,
  t9StarKey,
  t9SwitchMode,
  t9TypeKey,
  wordAroundCursor,
  type T9Context,
} from "../src/text/t9/editing";
import type { T9Key } from "../src/text/t9";
import { T9_FIXTURE } from "./support/t9-fixture.ts";

const CTX: T9Context = { dictionary: T9_FIXTURE, user: [] };
const LIMIT = 459;

/** Keys as a T9 editor takes them: digits, `*`, `0`, `#`, `c`, `u`/`d` for ▲/▼. */
function keys(sequence: string, from: TextState = emptyText()): TextState {
  let s = from;
  for (const key of sequence) {
    if (key === "*") s = t9StarKey(s, CTX, LIMIT);
    else if (key === "0") s = t9Space(s, LIMIT);
    else if (key === "#") s = t9Hash(s, LIMIT);
    else if (key === "c") s = t9DeleteKey(s, CTX);
    else if (key === "u") s = t9MoveKey(s, "up", CTX);
    else if (key === "d") s = t9MoveKey(s, "down", CTX);
    else s = t9TypeKey(s, key as T9Key, CTX, LIMIT);
  }
  return s;
}

/** The text with the cursor as `|`, the composing word in brackets, the mode, the key count. */
function view(s: TextState): string {
  const { text, cursor } = s;
  const word = composingWord(s, CTX);
  if (word === undefined || !s.t9)
    return `${text.slice(0, cursor)}|${text.slice(cursor)} ${s.mode}`;
  const start = cursor - word.text.length;
  return `${text.slice(0, start)}[${text.slice(start, cursor)}]|${text.slice(cursor)} ${s.mode} ${s.t9.keys.length}`;
}

describe("0 (spec 5, 8)", () => {
  it("ends the word as shown and adds a space; a sentence starts after `.`", () => {
    expect(view(keys("4663*0"))).toBe("Home | abc");
    expect(view(keys("46630466310"))).toBe("Good good. | Abc");
    expect(view(keys("466304663*1*0"))).toBe("Good home, | abc");
  });

  it("commits the no-match word without its `?`", () => {
    expect(view(keys("466390"))).toBe("Good | abc");
  });
});

describe("# (spec 8)", () => {
  it("toggles Abc and abc at a word start, abc and ABC in a word, per letter", () => {
    expect(view(keys("#"))).toBe("| abc");
    expect(view(keys("##"))).toBe("| Abc");
    expect(view(keys("4#663"))).toBe("[GOOD]| ABC 4");
    expect(view(keys("46#63"))).toBe("[GoOD]| ABC 4");
    expect(view(keys("46#63*"))).toBe("[HoME]| ABC 4");
  });

  it("ABC lasts one word", () => {
    expect(view(keys("4#6630"))).toBe("GOOD | abc");
    expect(view(keys("4#66304663"))).toBe("GOOD [good]| abc 4");
  });

  it("types `#` in 123 (plan 18)", () => {
    expect(view(t9Hash(t9HoldHash(emptyText()), LIMIT))).toBe("#| 123");
  });
});

describe("holds (spec 5, 8)", () => {
  it("held #: 123, the word ended; held again, the mode it left", () => {
    const number = t9HoldHash(keys("4663"));
    expect(view(number)).toBe("Good| 123");
    expect(view(keys("46", number))).toBe("Good46| 123");
    expect(view(keys("4663", t9HoldHash(keys("46", number))))).toBe("Good46[good]| abc 4");
  });

  it("a held digit: the word ended, the digit typed", () => {
    expect(view(t9HoldDigit(keys("4663"), "5", LIMIT))).toBe("Good5| abc");
    expect(view(t9HoldDigit(emptyText(), "0", LIMIT))).toBe("0| Abc");
  });
});

describe("C (spec 5, 6, 9)", () => {
  it("shortens the composing word; its only key removes it", () => {
    expect(view(keys("4663c"))).toBe("[Goo]| abc 3");
    expect(view(keys("4663cccc"))).toBe("| Abc");
  });

  it("re-enters the word before a deleted space", () => {
    expect(view(keys("4663*0c"))).toBe("[Home]| abc 4");
    expect(view(keys("4663*0c*"))).toBe("[Gone]| abc 4");
  });

  it("leaves a word its lists lack (typed elsewhere) as text", () => {
    const s = { ...emptyText(), text: "xyz ", cursor: 4 };
    expect(view(t9DeleteKey(s, CTX))).toBe("xyz| abc");
  });

  it("held: the text cleared, a sentence start's mode", () => {
    expect(view(t9ClearText(keys("46630466")))).toBe("| Abc");
  });
});

describe("word stops (spec 9)", () => {
  const twoWords = keys("4663046630"); // "Good good |"

  it("▼ goes back through word ends (composing) and starts, wrapping to the last word's end", () => {
    const stops: string[] = [];
    let s = keys("466304663"); // "Good [good]|"
    for (let i = 0; i < 6; i++) {
      s = t9MoveKey(s, "down", CTX);
      stops.push(view(s));
    }
    expect(stops).toEqual([
      "Good |good abc",
      "[Good]| good abc 4",
      "|Good good Abc",
      "Good [good]| abc 4",
      "Good |good abc",
      "[Good]| good abc 4",
    ]);
  });

  it("▲ goes on to the end of the text, then wraps to the start", () => {
    const stops: string[] = [];
    let s = keys("466304663");
    for (let i = 0; i < 6; i++) {
      s = t9MoveKey(s, "up", CTX);
      stops.push(view(s));
    }
    expect(stops).toEqual([
      "Good good| abc",
      "|Good good Abc",
      "[Good]| good abc 4",
      "Good |good abc",
      "Good [good]| abc 4",
      "Good good| abc",
    ]);
  });

  it("types a word of its own at a word start", () => {
    const start = t9MoveKey(t9MoveKey(twoWords, "down", CTX), "down", CTX);
    expect(view(start)).toBe("Good |good  abc");
    expect(view(keys("4", start))).toBe("Good [i]|good  abc 1");
    expect(view(keys("4*0", start))).toBe("Good g |good  abc");
  });
});

describe("insertions (spec 10.3)", () => {
  it("Insert word: the word ended, the text inserted, the mode of the place after it", () => {
    const s = t9InsertText(keys("4663"), "Hovo", LIMIT);
    expect(view(s)).toBe("GoodHovo| abc");
    expect(wordAroundCursor(s)).toBe("GoodHovo");
  });

  it("Spell: the composing word replaced", () => {
    const s = t9ReplaceComposing(keys("466304663"), "intos", CTX, LIMIT);
    expect(view(s)).toBe("Good intos| abc");
    expect(wordAroundCursor(s)).toBe("intos");
  });
});

describe("a Dictionary change", () => {
  it("ends the word; multi-tap takes sentence case, T9 the place's mode", () => {
    expect(view(t9SwitchMode(keys("4663"), false))).toBe("Good| Abc");
    expect(view(t9SwitchMode({ ...emptyText(), text: "Hi ", cursor: 3 }, true))).toBe("Hi | abc");
  });
});
