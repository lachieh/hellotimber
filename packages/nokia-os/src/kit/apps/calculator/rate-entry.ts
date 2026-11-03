// The exchange-rate entry (plan 20 D7): its own cursor editor, not the calculator's entry. It
// opens on the shown rate with the cursor after it; the first digit or `#` replaces that value.
// Typed input stops at seven characters (`.` included) while a prefilled reciprocal may show
// nine. ▲ moves the cursor right and wraps from the end to the start, ▼ the reverse; digits and
// the one point insert at the cursor, C deletes the character before it.

/** Characters the entry takes as typed, the point included (Task 0: `1234567`, `1.12345`). */
export const RATE_TYPED_CHARACTERS = 7;

export type RateKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "#"
  | "*"
  | "c"
  | "up"
  | "down";

export interface RateEntry {
  readonly text: string;
  /** Characters before the cursor (0 … text.length). */
  readonly cursor: number;
  /** The shown rate, untouched: the first digit or `#` replaces it. */
  readonly prefilled: boolean;
}

export function openRateEntry(shown: string): RateEntry {
  return { text: shown, cursor: shown.length, prefilled: shown !== "" };
}

/** C held: the field empties. */
export function clearRateEntry(): RateEntry {
  return { text: "", cursor: 0, prefilled: false };
}

function insert(entry: RateEntry, ch: string): RateEntry {
  if (entry.prefilled) return { text: ch, cursor: 1, prefilled: false };
  if (entry.text.length >= RATE_TYPED_CHARACTERS) return entry;
  if (ch === "." && entry.text.includes(".")) return entry;
  const { text, cursor } = entry;
  return {
    text: text.slice(0, cursor) + ch + text.slice(cursor),
    cursor: cursor + 1,
    prefilled: false,
  };
}

/** A key on the entry, as it goes down; `*` does nothing (Task 0: `rate/keys/star`). */
export function pressRateKey(entry: RateEntry, key: RateKey): RateEntry {
  const { text, cursor } = entry;
  switch (key) {
    case "*":
      return entry;
    case "#":
      return insert(entry, ".");
    case "c":
      if (cursor === 0) return { ...entry, prefilled: false };
      return {
        text: text.slice(0, cursor - 1) + text.slice(cursor),
        cursor: cursor - 1,
        prefilled: false,
      };
    case "up":
      return { ...entry, cursor: cursor === text.length ? 0 : cursor + 1, prefilled: false };
    case "down":
      return { ...entry, cursor: cursor === 0 ? text.length : cursor - 1, prefilled: false };
    default:
      return insert(entry, key);
  }
}

/** The rate OK stores: an empty field or a lone point is zero. */
export function rateToSave(entry: RateEntry): string {
  return entry.text === "" || entry.text === "." ? "0" : entry.text;
}
