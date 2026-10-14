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
  // probe/unset-down "01" ("Level 1" inverted): the small 1 likewise sits one column into its
  // cell (a 3-column space before it measures 4 without the bearing).
  { kind: "bearing", font: "small", char: "1", bearing: 1 },
  // tree/11-clock/11-3.leaf "b" (13.10.2026) and 11-2-2.leaf "b" (10:10): the large digits
  // sit in 8-column cells and 1 is drawn one column in, as in the digits and thin faces.
  { kind: "bearing", font: "large", char: "1", bearing: 1 },
  // tree/11-clock/11-2-2.leaf "b" (10:10): ':' sits one column into its 4-column cell (0 to
  // ':' measures 9 after an 8-column 0; ':' to 1 measures 4 with 1's bearing).
  { kind: "bearing", font: "large", char: ":", bearing: 1 },
  // menu/10-reminders, tree/04-call-register/4-4-4.choose "b" (Received), probe/progress-7-6-quit
  // "l" (Request): the leg of the large R fills its blank column, so R runs into a following e.
  // R's ink is 8 columns.
  { kind: "touch", font: "large", pair: "Re", width: 8 },
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
  // menu/11-clock.sub-1948 "02" "19:48": '8' ink is 4 columns, a full thin digit cell.
  { kind: "advance", font: "thin", char: "8", advance: 5 },
  // menu/05-tones.sub "02" "Level 1": 'l' ink is 1 column.
  { kind: "advance", font: "thin", char: "l", advance: 2 },
  // Plan 14 (Task 6): characters the menu-tree goldens show only at a word end; each cell is its
  // ink plus one blank column, as above (digits fill their tabular cells the same way).
  // tree/05-tones/5-1.options "10" "That's it!": '!' ink is 2 columns.
  { kind: "advance", font: "small", char: "!", advance: 3 },
  // tree/01-phone-book/1-8-1.options "01" "Name, number": ',' ink is 2 columns.
  { kind: "advance", font: "small", char: ",", advance: 3 },
  // tree/07-call-divert/7-3-4.options "02" ("10 seconds"): '0' ink is 5 columns, a digit cell.
  { kind: "advance", font: "small", char: "0", advance: 6 },
  // tree/05-tones/5-2-5.choose "b" "ringing tone?": '?' ink is 5 columns.
  { kind: "advance", font: "small", char: "?", advance: 6 },
  // tree/06-settings/6-2-1-4.choose "e" ("Избиране"): Cyrillic 'е' ink is 5 columns.
  { kind: "advance", font: "small", char: "е", advance: 6 },
  // tree/06-settings/6-2-1.options "01" ("Русский"): 'й' ink is 6 columns.
  { kind: "advance", font: "small", char: "й", advance: 7 },
  // tree/06-settings/6-2-1-3.choose "b" ("Есть!"): '!' ink is 2 columns.
  { kind: "advance", font: "large", char: "!", advance: 3 },
  // tree/01-phone-book/1-9.leaf "b" ("(empty)"): ')' ink is 3 columns, as '(' (4).
  { kind: "advance", font: "large", char: ")", advance: 4 },
  // tree/08-games/8-1-4.leaf "b" ("45"): '5' ink is 7 columns, a full large digit cell.
  { kind: "advance", font: "large", char: "5", advance: 8 },
  // tree/11-clock/11-3.leaf "b" ("13.10.2026"): '6' ink is 7 columns, a full large digit cell.
  { kind: "advance", font: "large", char: "6", advance: 8 },
  // tree/02-messages/2-2.leaf "c" ("in inbox"): 'x' ink is 6 columns.
  { kind: "advance", font: "large", char: "x", advance: 7 },
  // probe/games-instructions-8-2-4 "02" ("Use the # key to"): '#' ink is 5 columns.
  { kind: "advance", font: "thin", char: "#", advance: 6 },
  // tree/12-profiles/12-5-2.sub "09" ("(empty)"): ')' ink is 2 columns, as '(' (3).
  { kind: "advance", font: "thin", char: ")", advance: 3 },
  // probe/games-instructions-8-2-4 "03" ("the * key to move"): '*' ink is 5 columns.
  { kind: "advance", font: "thin", char: "*", advance: 6 },
  // tree/08-games/8-1-5.options "02" ("ÆG"): 'G' ink is 4 columns.
  { kind: "advance", font: "thin", char: "G", advance: 5 },
  // tree/08-games/8-1-5.options "01" ("ç"): 'ç' ink is 3 columns.
  { kind: "advance", font: "thin", char: "ç", advance: 4 },
  // tree/06-settings/6-2-1-3.choose "f" ("Русский"): 'й' ink is 4 columns.
  { kind: "advance", font: "thin", char: "й", advance: 5 },
];
