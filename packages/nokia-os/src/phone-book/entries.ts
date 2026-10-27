// The SIM phone book's order and search (plan 19 D6, Task 0 "Sort order", "Search and letters"):
// pure functions over SIM entries.
//
// The firmware's order: leading spaces are skipped; characters compare as space, then letters
// case-insensitively with accents folded to their letter, then digits, then every other
// character by its code; a name that is a prefix of another sorts equal to it; equal keys keep
// SIM order (`phone-book/view-sort`, `phone-book/edit-after`). Search and the list's letter keys land on the first name at
// or after the query, else the first name.
import type { StockContact } from "./sim-card";

/** One SIM phone book entry at its SIM location. */
export interface PhoneBookEntry extends StockContact {
  /** 1-based SIM location. */
  readonly location: number;
}

/**
 * Accented letters and the letter they sort as (Task 0's `sort` fixture verifies Ä Å à É Ñ Ö Ø
 * ü; the rest follow by analogy, UNVERIFIED).
 */
const FOLDS: Readonly<Record<string, string>> = Object.fromEntries(
  (
    [
      ["a", "àáâãäåæ"],
      ["c", "ç"],
      ["e", "èéêë"],
      ["g", "ğ"],
      ["i", "ìíîïı"],
      ["n", "ñ"],
      ["o", "òóôõöø"],
      ["s", "ß"],
      ["u", "ùúûü"],
    ] as const
  ).flatMap(([base, accents]) => Array.from(accents, (accent) => [accent, base])),
);

/** Character classes in sort order. */
const SPACE = 0;
const LETTER = 1;
const DIGIT = 2;
const OTHER = 3;

/** A character's sort weight: its class, then its value within the class. */
function weight(char: string): number {
  if (char === " ") return SPACE;
  const lower = char.toLowerCase();
  const letter = FOLDS[lower] ?? (char === "İ" ? "i" : lower);
  if (/^[a-z]$/.test(letter)) return LETTER * 0x110000 + letter.charCodeAt(0);
  if (/^[0-9]$/.test(char)) return DIGIT * 0x110000 + char.charCodeAt(0);
  return OTHER * 0x110000 + char.codePointAt(0)!;
}

/** The weights a name sorts by (leading spaces skipped). */
function sortKey(name: string): number[] {
  return Array.from(name.replace(/^ +/, ""), weight);
}

/**
 * The firmware's order of two names: negative, zero (equal keys) or positive. Only the shorter
 * name's length is compared: a prefix sorts equal to the longer name, and SIM order decides
 * (`phone-book/edit-after`: `annab` at `anna`'s location 2 comes before `Ånna` at 14 after
 * Edit › Replace, after it at location 24 after Edit › Add).
 */
export function compareNames(a: string, b: string): number {
  const x = sortKey(a);
  const y = sortKey(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i]! - y[i]!;
  }
  return 0;
}

/**
 * What an entry sorts and shows by: its name, or its number when it has none (`add/no-name`
 * shows the number; its place in the order is UNVERIFIED: nokia-os sorts it by that number).
 */
export function shownName(entry: StockContact): string {
  return entry.name === "" ? entry.number : entry.name;
}

/** The entries in the firmware's order (a copy); equal names keep SIM order. */
export function sortEntries(entries: readonly PhoneBookEntry[]): readonly PhoneBookEntry[] {
  return [...entries].sort(
    (a, b) => compareNames(shownName(a), shownName(b)) || a.location - b.location,
  );
}

/** Where Search or a letter key lands in a sorted list: the first name at or after `query`. */
export function searchIndex(sorted: readonly PhoneBookEntry[], query: string): number {
  const found = sorted.findIndex((entry) => compareNames(shownName(entry), query) >= 0);
  return found < 0 ? 0 : found;
}
