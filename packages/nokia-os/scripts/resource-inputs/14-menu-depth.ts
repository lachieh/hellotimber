import type { ResourceDeclarations, SpriteCrop } from "../resource-declarations.ts";
import { TREE_TEXT_RUNS } from "../generated/tree-text-runs.ts";
type Rect = Pick<SpriteCrop, "x0" | "x1" | "y0" | "y1">;

/** Note icons: the union of the tick, `!` and octagon boxes; note text never reaches it. */
const NOTE_ICON: Rect = { x0: 63, x1: 83, y0: 1, y1: 23 };
const TOP_SCORE: Rect = { x0: 64, x1: 82, y0: 0, y1: 22 };
/** The hatched progress bar. */
const PROGRESS_BAR: Rect = { x0: 0, x1: 83, y0: 7, y1: 14 };
const FULL: Rect = { x0: 0, x1: 83, y0: 0, y1: 47 };

/** One sprite per image, ids `<id>-1`, `<id>-2`, … in the order given. */
function frames(
  id: string,
  group: string,
  golden: string,
  images: readonly string[],
  rect: Rect,
): SpriteCrop[] {
  return images.map((image, i) => ({ id: `${id}-${i + 1}`, group, golden, image, ...rect }));
}

export const resources: ResourceDeclarations = {
  textRuns: {
    ...TREE_TEXT_RUNS,
    "probe/wrap-small-profiles-down": {
      ...TREE_TEXT_RUNS["probe/wrap-small-profiles-down"],
      "06": [
        ...TREE_TEXT_RUNS["probe/wrap-small-profiles-down"]["06"]!,
        { font: "small", text: "\uE000\uE000", top: 18, left: 2, right: 11 },
      ],
    },
    "tree/12-profiles/12-6-2.sub": {
      ...TREE_TEXT_RUNS["tree/12-profiles/12-6-2.sub"],
      "09": [
        ...TREE_TEXT_RUNS["tree/12-profiles/12-6-2.sub"]["09"]!,
        { font: "thin", text: "\uE000\uE000", top: 29, left: 68, right: 77 },
      ],
    },
  },
  glyphOverrides: [
    // tree/11-clock/11-3.leaf "b" (13.10.2026) and 11-2-2.leaf "b" (10:10): the large digits
    // sit in 8-column cells and 1 is drawn one column in, as in the digits and thin faces.
    { kind: "bearing", font: "large", char: "1", bearing: 1 },
    // tree/11-clock/11-2-2.leaf "b" (10:10): ':' sits one column into its 4-column cell (0 to
    // ':' measures 9 after an 8-column 0; ':' to 1 measures 4 with 1's bearing).
    { kind: "bearing", font: "large", char: ":", bearing: 1 },
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
  ],
  spriteBatches: [
    {
      order: 10,
      entries: [
        // Confirmation tick in three steps: dotted box, half tick, full tick (Type of view › Name list).
        {
          id: "note/tick-box",
          group: "note-icon",
          golden: "tree/01-phone-book/1-8-1-1.choose",
          image: "c",
          ...NOTE_ICON,
        },
        {
          id: "note/tick-half",
          group: "note-icon",
          golden: "tree/01-phone-book/1-8-1-1.choose",
          image: "d",
          ...NOTE_ICON,
        },
        {
          id: "note/tick",
          group: "note-icon",
          golden: "tree/01-phone-book/1-8-1-1.choose",
          image: "e",
          ...NOTE_ICON,
        },
        // Information: a dotted `!` (Service Nos. › No phone numbers).
        {
          id: "note/info",
          group: "note-icon",
          golden: "tree/01-phone-book/1-2.leaf",
          image: "c",
          ...NOTE_ICON,
        },
        // Error: an octagon (Show call costs › Clear counters › Not allowed).
        {
          id: "note/error",
          group: "note-icon",
          golden: "tree/04-call-register/4-6-3.choose",
          image: "b",
          ...NOTE_ICON,
        },
        // Top score's animation (Snake II › Top score), 11 frames.
        ...frames(
          "top-score",
          "top-score",
          "tree/08-games/8-1-4.leaf",
          ["b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"],
          TOP_SCORE,
        ),
        // The progress bar's 10 frames (Cancel all diverts › Requesting).
        ...frames(
          "progress",
          "progress-bar",
          "tree/07-call-divert/7-6.leaf",
          ["b", "c", "d", "e", "f", "g", "h", "i", "j", "k"],
          PROGRESS_BAR,
        ),
        // Prompt mode icons: the pen of every prompt, `Abc` beside it on text prompts (Search › Name:),
        // the phone book on Speed dials (Key 2:).
        {
          id: "prompt/pen",
          group: "prompt-icon",
          golden: "tree/01-phone-book/1-1.leaf",
          image: "b",
          x0: 1,
          x1: 9,
          y0: 0,
          y1: 5,
        },
        {
          id: "prompt/abc",
          group: "prompt-icon",
          golden: "tree/01-phone-book/1-1.leaf",
          image: "b",
          x0: 14,
          x1: 29,
          y0: 0,
          y1: 5,
        },
        // The lower-case `abc` of a name being edited (Profiles › Silent › Rename).
        {
          id: "prompt/abc-lower",
          group: "prompt-icon",
          golden: "tree/12-profiles/12-2-2-10.leaf",
          image: "b",
          x0: 14,
          x1: 29,
          y0: 0,
          y1: 5,
        },
        {
          id: "prompt/phone-book",
          group: "prompt-icon",
          golden: "tree/01-phone-book/1-9.leaf",
          image: "b",
          x0: 1,
          x1: 16,
          y0: 0,
          y1: 5,
        },
        // Multi-select marks at x 1..5 in the first and third rows (Info service › Languages: All
        // marked, Norsk not).
        {
          id: "mark/on",
          group: "mark",
          golden: "tree/02-messages/2-8-5.options",
          image: "01",
          x0: 1,
          x1: 5,
          y0: 9,
          y1: 13,
        },
        {
          id: "mark/off",
          group: "mark",
          golden: "tree/02-messages/2-8-5.options",
          image: "01",
          x0: 1,
          x1: 5,
          y0: 29,
          y1: 33,
        },
        // Level bars as the virgin EEPROM shows them, per game (Pairs II's two modes share one).
        {
          id: "level/8-1",
          group: "level-bar",
          golden: "tree/08-games/8-1-2.leaf",
          image: "b",
          x0: 5,
          x1: 74,
          y0: 13,
          y1: 36,
        },
        {
          id: "level/8-3",
          group: "level-bar",
          golden: "tree/08-games/8-3-2.leaf",
          image: "b",
          x0: 5,
          x1: 42,
          y0: 22,
          y1: 36,
        },
        {
          id: "level/8-4",
          group: "level-bar",
          golden: "tree/08-games/8-4-1-2.leaf",
          image: "b",
          x0: 5,
          x1: 58,
          y0: 18,
          y1: 36,
        },
      ],
    },
    {
      order: 30,
      entries: [
        // Game splashes, full frame (P12). Pairs II's image d is a 16 ms partial draw, not a frame.
        ...frames(
          "splash/8-1",
          "splash-8-1",
          "probe/games-splash-8-1",
          ["b", "c", "d", "e", "f"],
          FULL,
        ),
        ...frames(
          "splash/8-2",
          "splash-8-2",
          "probe/games-splash-8-2",
          ["b", "c", "d", "e", "f", "g", "h", "i", "j"],
          FULL,
        ),
        ...frames(
          "splash/8-3",
          "splash-8-3",
          "probe/games-splash-8-3",
          ["b", "c", "d", "e", "f", "g"],
          FULL,
        ),
        ...frames(
          "splash/8-4",
          "splash-8-4",
          "probe/games-splash-8-4",
          ["b", "c", "e", "f", "g", "h", "i", "j", "k"],
          FULL,
        ),
      ],
    },
  ],
  timelineGroups: {
    note: ["note-icon", "top-score"],
    progress: ["progress-bar"],
    prompt: [],
    "splash-8-1": ["splash-8-1"],
    "splash-8-2": ["splash-8-2"],
    "splash-8-3": ["splash-8-3"],
    "splash-8-4": ["splash-8-4"],
  },
  timelineBatches: [
    {
      order: 10,
      entries: [
        { golden: "probe/games-splash-8-1", kind: "splash-8-1", node: "8-1" },
        { golden: "probe/games-splash-8-2", kind: "splash-8-2", node: "8-2" },
        { golden: "probe/games-splash-8-3", kind: "splash-8-3", node: "8-3" },
        { golden: "probe/games-splash-8-4", kind: "splash-8-4", node: "8-4" },
        // P7: Requesting for 10 s on Cancel all diverts. The emulator is deterministic, so this is the
        // 7-6 leaf recording (5.6 s) continued; its bar steps replace the leaf's for node 7-6.
        { golden: "probe/progress-7-6-quit", kind: "progress", node: "7-6" },
        // P7: Quit on Requesting after 10 s, then standby.
        { golden: "probe/progress-7-6-quit", kind: "note", name: "request-not-confirmed" },
        // P8: Ringing volume › Level 5 › OK on the query.
        { golden: "probe/confirm-5-2-5-ok", kind: "note", name: "level-5-done" },
        // P8: Reminders › Erase › All › Yes.
        { golden: "probe/confirm-10-3-2-yes", kind: "note", name: "reminder-memory-empty" },
      ],
    },
    {
      order: 30,
      entries: [
        // P5: Menu 1 8, then standby.
        { golden: "probe/shortcut-m1-8", kind: "note", name: "invalid-shortcut" },
      ],
    },
  ],
};
