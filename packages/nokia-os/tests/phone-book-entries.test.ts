// Plan 19 Task 5: the firmware's name order and search (D6), against Task 0's captures.
import { describe, expect, it } from "vite-plus/test";
import { PHONE_BOOK_SIMS } from "../scripts/capture-sets/19-phone-book.ts";
import {
  compareNames,
  searchIndex,
  sortEntries,
  type PhoneBookEntry,
} from "../src/phone-book/entries";

/** A fixture's entries by location, as the SIM holds them. */
function entriesOf(sim: keyof typeof PHONE_BOOK_SIMS): PhoneBookEntry[] {
  return (PHONE_BOOK_SIMS[sim].phoneBook?.entries ?? []).flatMap((contact, i) =>
    contact === null ? [] : [{ ...contact, location: i + 1 }],
  );
}

const names = (entries: readonly PhoneBookEntry[]): string[] => entries.map((e) => e.name);

describe("sortEntries (Task 0: views/*, sort/*)", () => {
  it("orders the content SIM as the list shows it (phone-book/view-large)", () => {
    expect(names(sortEntries(entriesOf("content")))).toEqual([
      "Abcdefghijklmnop",
      "anna",
      "Ånna",
      "Ben",
      "Bob",
      "Carl",
      "Dave",
      "Eve",
      "Frank",
      "Gina",
      "Harry",
      "Hash",
      "Intl",
      "Ivy",
      "Jack",
      "Lisa Ann Wilson",
      "Long",
      "Pause",
      "Star",
      "Wwwwwwwwwwwwwwww",
      "zed",
      "Zed",
      "1st",
    ]);
  });

  it("orders the sort SIM's corner cases as the list shows them (phone-book/view-sort)", () => {
    const sorted = sortEntries(entriesOf("sort"));
    expect(names(sorted)).toEqual([
      "A b",
      "A c",
      "Ab",
      "Äb",
      "Ab ",
      "Ånna",
      "Anna",
      "anna",
      "Åsa",
      "Ava",
      "Azz",
      "A1",
      "Ben",
      "ben",
      "Ben",
      "Émile",
      "Eve",
      " Lead",
      "Ñu",
      "Nu",
      "Öla",
      "Ola",
      "Øle",
      "ü",
      "Zed",
      "zed",
      "Zoe",
      "1st",
      "9",
      "-dash",
      ".dot",
      "_u",
    ]);
    // Equal names keep SIM order: Ben (21) and Ben (23) around ben (22).
    expect(sorted.filter((e) => e.name.toLowerCase() === "ben").map((e) => e.location)).toEqual([
      21, 22, 23,
    ]);
  });

  it("returns a sorted copy, not the input", () => {
    const entries = entriesOf("two").reverse();
    const sorted = sortEntries(entries);
    expect(names(sorted)).toEqual(["A", "B"]);
    expect(names(entries)).toEqual(["B", "A"]);
  });
});

describe("compareNames", () => {
  it.each([
    ["anna", "Anna", 0],
    ["Ånna", "anna", 0],
    ["Äb", "ab", 0],
    ["Émile", "emile", 0],
    ["Ñu", "nu", 0],
    ["Øle", "ole", 0],
    ["ü", "u", 0],
    [" Lead", "Lead", 0],
    ["A b", "Ab", -1],
    ["Ab", "Ab ", 0],
    ["Azz", "A1", -1],
    ["Zoe", "1st", -1],
    ["9", "-dash", -1],
    ["-dash", ".dot", -1],
    [".dot", "_u", -1],
    // A prefix sorts equal (SIM order decides: phone-book/edit-after).
    ["an", "anna", 0],
    ["annab", "Ånna", 0],
  ] as const)("compares %j with %j as %i", (a, b, sign) => {
    expect(Math.sign(compareNames(a, b))).toBe(sign);
    expect(Math.sign(compareNames(b, a))).toBe(-sign || 0);
  });
});

describe("searchIndex (Task 0: search/*, letters/*, sort/search-*)", () => {
  const content = sortEntries(entriesOf("content"));
  const sort = sortEntries(entriesOf("sort"));
  it.each([
    ["A", "Abcdefghijklmnop"],
    ["An", "anna"],
    ["AN", "anna"],
    ["aN", "anna"],
    ["Ä", "Abcdefghijklmnop"],
    ["B", "Ben"],
    ["Bo", "Bob"],
    ["Bz", "Carl"],
    ["C", "Carl"],
    ["Ca", "Carl"],
    ["D", "Dave"],
    ["Gi", "Gina"],
    ["I", "Intl"],
    ["Ja", "Jack"],
    ["K", "Lisa Ann Wilson"],
    ["L", "Lisa Ann Wilson"],
    ["Le", "Lisa Ann Wilson"],
    ["M", "Pause"],
    ["Q", "Star"],
    ["T", "Wwwwwwwwwwwwwwww"],
    ["W", "Wwwwwwwwwwwwwwww"],
    ["X", "zed"],
    ["Z", "zed"],
    ["Zz", "1st"],
    ["1", "1st"],
    ["2", "Abcdefghijklmnop"],
    ["9", "Abcdefghijklmnop"],
    ["£", "Abcdefghijklmnop"],
    [" ", "Abcdefghijklmnop"],
    ["", "Abcdefghijklmnop"],
  ])("finds %j on the content SIM at %j", (query, name) => {
    expect(content[searchIndex(content, query)]!.name).toBe(name);
  });

  it.each([
    ["a", "A b"],
    ["an", "Ånna"],
    ["Ä", "A b"],
    ["b", "Ben"],
    ["o", "Öla"],
    ["z", "Zed"],
    ["1", "1st"],
    [" ", "A b"],
  ])("finds %j on the sort SIM at %j", (query, name) => {
    expect(sort[searchIndex(sort, query)]!.name).toBe(name);
  });

  it("is 0 on an empty list", () => {
    expect(searchIndex([], "A")).toBe(0);
  });
});
