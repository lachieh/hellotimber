// Plan 18b Task 5: the user dictionary (D7) and its place in the candidate lists (spec 11).
import { describe, expect, it } from "vite-plus/test";
import { createMemoryStorage, StockEeprom } from "../src/firmware/eeprom";
import { STOCK_RECORDS } from "../src/firmware/records";
import { t9Candidates } from "../src/text/t9";
import { addUserWord, T9_USER_BUDGET, T9_USER_RECORD, type T9UserState } from "../src/text/t9/user";
import { T9_FIXTURE as DICT } from "./support/t9-fixture.ts";

const EMPTY: T9UserState = { words: [] };

function added(...words: string[]): T9UserState {
  return words.reduce(addUserWord, EMPTY);
}

describe("T9_USER_RECORD (D7)", () => {
  it("is one of the phone's EEPROM records, empty when virgin", () => {
    expect(STOCK_RECORDS).toContain(T9_USER_RECORD);
    const eeprom = new StockEeprom(createMemoryStorage(), [T9_USER_RECORD]);
    expect(eeprom.read(T9_USER_RECORD)).toEqual(EMPTY);
  });

  it("stores version 1: the words in the order added, each with its case", () => {
    const storage = createMemoryStorage();
    new StockEeprom(storage, [T9_USER_RECORD]).write(T9_USER_RECORD, added("Hovo", "hotm"));
    expect(storage.getItem("nokia-os/t9-user")).toBe('{"version":1,"words":["Hovo","hotm"]}');
    expect(new StockEeprom(storage, [T9_USER_RECORD]).read(T9_USER_RECORD)).toEqual(
      added("Hovo", "hotm"),
    );
  });

  it("drops malformed entries and rejects a bad shape", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "nokia-os/t9-user",
      JSON.stringify({ version: 1, words: ["ok", 3, "", "two words", null, "fine"] }),
    );
    expect(new StockEeprom(storage, [T9_USER_RECORD]).read(T9_USER_RECORD)).toEqual(
      added("ok", "fine"),
    );
    storage.setItem("nokia-os/t9-user", JSON.stringify({ version: 1, words: "ok" }));
    expect(() => new StockEeprom(storage, [T9_USER_RECORD])).toThrow(/t9-user/);
  });

  it("is kept by Restore factory settings (D7, provisional)", () => {
    const eeprom = new StockEeprom(createMemoryStorage(), [T9_USER_RECORD]);
    eeprom.write(T9_USER_RECORD, added("Hovo"));
    eeprom.restoreFactory();
    expect(eeprom.read(T9_USER_RECORD)).toEqual(added("Hovo"));
  });
});

describe("addUserWord (D7)", () => {
  it("appends a new word and ignores one already present with the same case", () => {
    expect(added("Hovo", "hotm", "Hovo")).toEqual({ words: ["Hovo", "hotm"] });
    expect(added("Hovo", "hovo")).toEqual({ words: ["Hovo", "hovo"] });
  });

  it("keeps the words while their lengths plus one fit the budget, dropping the oldest", () => {
    expect(T9_USER_BUDGET).toBe(840);
    // 168 four-letter words cost 840: all kept; the 169th drops the first.
    const four = Array.from({ length: 169 }, (_, i) => `w${String(i).padStart(3, "0")}`);
    const full = added(...four.slice(0, 168));
    expect(full.words).toHaveLength(168);
    const over = addUserWord(full, four[168]!);
    expect(over.words).toHaveLength(168);
    expect(over.words[0]).toBe(four[1]);
    expect(over.words.at(-1)).toBe(four[168]);
    // An eight-letter word costs 9: 93 fit (837).
    const eight = Array.from({ length: 100 }, (_, i) => `word${String(i).padStart(4, "0")}`);
    expect(added(...eight).words).toEqual(eight.slice(7));
  });

  it("ignores an empty word", () => {
    expect(addUserWord(EMPTY, "")).toBe(EMPTY);
  });
});

describe("user words in the candidate lists (spec 11)", () => {
  it("puts an exact user word second, after the first built-in candidate", () => {
    // A user word a built-in candidate repeats takes second place (listed once).
    expect(t9Candidates(DICT, ["Hood"], "4663")).toEqual(["good", "Hood", "home", "gone", "inne"]);
    expect(t9Candidates(DICT, ["Inme"], "4663")).toEqual([
      "good",
      "Inme",
      "home",
      "gone",
      "hood",
      "inne",
    ]);
  });

  it("puts several exact user words oldest first", () => {
    expect(t9Candidates(DICT, ["Inme", "imme"], "4663")?.slice(0, 3)).toEqual([
      "good",
      "Inme",
      "imme",
    ]);
  });

  it("appends longer user words whose keys begin with the sequence, in full", () => {
    expect(t9Candidates(DICT, ["Goodbye"], "4663")).toEqual([
      "good",
      "home",
      "gone",
      "hood",
      "inne",
      "Goodbye",
    ]);
  });

  it("makes a user word alone on its sequence the whole list", () => {
    expect(t9Candidates(DICT, NONE_WORDS, "46637")).toEqual(["inner", "homes"]);
    expect(t9Candidates(DICT, ["Hovos"], "46867")).toEqual(["Hovos"]);
  });
});

const NONE_WORDS: readonly string[] = [];
