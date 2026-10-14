// Explicit resolutions for what the glyph harvester reports but cannot decide from the goldens
// alone (plan 13, Task 7). Each entry names the golden that justifies it.
//
// Advances for characters seen only at a word end follow the rule every in-word measurement
// obeys in all four fonts: a glyph's cell is its ink plus one blank column (the exceptions are
// the bearings below and the large R, whose leg fills its blank column).
import type { GlyphOverride } from "./harvest-glyphs.ts";

export const GLYPH_OVERRIDES: readonly GlyphOverride[] = [
  // menu/02-messages.sub "01" vs "02": `2-1` and `2-2` put the last digit in the same cell, but
  // 1's ink starts one column after 2's. Digits sit in 6-column cells; 1 is drawn one column in.
  { kind: "bearing", font: "digits", char: "1", bearing: 1 },
  // menu/11-clock.sub "03" (13.10.2026) and "02" (10:10): the thin 1 likewise sits one column
  // into a 5-column digit cell (`.` and `:` measure 3 before a 1 and 2 before a 2).
  { kind: "bearing", font: "thin", char: "1", bearing: 1 },
  // menu/10-reminders: the leg of the large R runs into the e with no blank column.
  {
    kind: "split",
    source: "menu/10-reminders 10-reminders",
    font: "large",
    text: "Reminders",
    at: [17],
  },
  // menu/12-profiles.sub "05" "(empty)": ')' ink is 3 columns.
  { kind: "advance", font: "small", char: ")", advance: 4 },
  // menu/01-phone-book.sub "02" "Service Nos.": '.' ink is 2 columns.
  { kind: "advance", font: "small", char: ".", advance: 3 },
  // menu/03-chat.sub "01" "Phone number:": ':' ink is 2 columns.
  { kind: "advance", font: "small", char: ":", advance: 3 },
  // standby/standby "Orange F": 'F' ink is 5 columns.
  { kind: "advance", font: "small", char: "F", advance: 6 },
  // menu/02-messages.sub "02" "Inbox": 'x' ink is 5 columns.
  { kind: "advance", font: "small", char: "x", advance: 6 },
  // menu/01-phone-book "Phone book": 'k' ink is 6 columns.
  { kind: "advance", font: "large", char: "k", advance: 7 },
  // menu/01-phone-book.sub "03" (`1-3`): '3' ink is 5 columns, a full digit cell.
  { kind: "advance", font: "digits", char: "3", advance: 6 },
  // menu/01-phone-book.sub "09" (`1-9`): '9' ink is 5 columns.
  { kind: "advance", font: "digits", char: "9", advance: 6 },
  // menu/11-clock.sub "03" "13.10.2026": '6' ink is 4 columns, a full thin digit cell.
  { kind: "advance", font: "thin", char: "6", advance: 5 },
  // menu/05-tones.sub "02" "Level 1": 'l' ink is 1 column.
  { kind: "advance", font: "thin", char: "l", advance: 2 },
];
