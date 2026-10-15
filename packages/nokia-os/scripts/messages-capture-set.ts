// Text entry, Welcome note and SMS goldens (plan 18 "Golden pipeline additions"): an explicit
// table over plan 18 Task 0's recaptures (`captures/6.39/plan18/`) and plan 15's Welcome note
// captures (`captures/6.39/plan15/welcome/`), plus the glyph sheets built from Task 0's
// manifests.
//
// Every fixture is asserted (Task 12: each has its scenario in tests/support/messages.ts) but the
// ones a later plan implements (`MESSAGES_LATER`). Reads captures only through the injected
// `MessagesCaptureIo`, so tests run it on synthetic recordings. Paths are relative to
// `$REF/captures/6.39`. Pure: imports only sibling scripts.
import type { CaptureSetEntry } from "./capture-set.ts";
import type { GoldenStatus } from "./golden-format.ts";
import { firstChangedFrame, type RecordingFrame } from "./tree-capture-set.ts";

// ---------------------------------------------------------------- io

/** One shot of a Task 0 glyph sheet (`plan18/glyphs/<face>/manifest.json`; fields used). */
export interface GlyphShot {
  readonly file: string;
  readonly face: string;
  /** The character typed (small, large) or the header specimen's label (digits). */
  readonly char: string;
  /** `multitap` (typed with a key) or `symbols` (Use in the symbol table). */
  readonly source?: string;
  readonly mode?: string;
  readonly key?: string;
  readonly press?: number;
  /** A symbol shot whose character a multi-tap shot of the same sheet already shows. */
  readonly dup_of?: string;
}

export interface MessagesCaptureIo {
  /** The frames of `<dir>/timings.csv`, or undefined when the recording is missing. */
  recording(dir: string): readonly RecordingFrame[] | undefined;
  /** The `NN.png` names (without `.png`) in a shot directory, sorted; undefined when missing. */
  scrollImages(dir: string): readonly string[] | undefined;
  /** The glyph sheet manifest of `plan18/glyphs/<face>/`, or undefined when missing. */
  manifest(face: GlyphFace): readonly GlyphShot[] | undefined;
}

export type GlyphFace = "small" | "large" | "digits";

export class MessagesCaptureError extends Error {
  constructor(where: string, message: string) {
    super(`${where}: ${message}`);
    this.name = "MessagesCaptureError";
  }
}

/**
 * Fixtures whose screens a later plan implements, by that plan (plan 18 Task 11): Inbox's Chat
 * (`Chat name:`, plan 18c); Use number's call screen and the received notice's ▲, ▼, digit and #
 * (the call register, the phone book and standby number entry: plan 22, which also needs the
 * kernel to route a notice's keys, D12).
 */
export const MESSAGES_LATER: Readonly<Record<string, string>> = {
  "sms/inbox-option-chat": "18c",
  "sms/inbox-option-use-number": "22",
  "sms/inbox-option-use-number-odd": "22",
  "sms/outbox-use-number-found": "22",
  "sms/notice-up": "22",
  "sms/notice-down": "22",
  "sms/notice-digit": "22",
  "sms/notice-hash": "22",
};

/** Asserted (plan 18 Task 12: each has its scenario), unless a later plan implements it. */
function statusOf(id: string): GoldenStatus {
  const later = MESSAGES_LATER[id];
  return later === undefined ? "asserted" : `pending:${later}`;
}

const BASE = "plan18";

// ---------------------------------------------------------------- the key cycles

/**
 * Task 0's multi-tap cycles, upper (= sentence start) and lower, by key: the number of presses
 * before the cycle repeats (plan 18 "Complete multi-tap cycles"). `text/keys/<k>/<mode>/` holds
 * two cycles and the first press of a third.
 */
export const CYCLE_LENGTHS: Readonly<Record<"upper" | "lower", Readonly<Record<string, number>>>> =
  {
    upper: { "1": 11, "2": 11, "3": 8, "4": 10, "5": 5, "6": 10, "7": 6, "8": 8, "9": 5, "0": 2 },
    lower: { "1": 8, "2": 11, "3": 8, "4": 10, "5": 5, "6": 10, "7": 7, "8": 8, "9": 5, "0": 2 },
  };

// ---------------------------------------------------------------- table

/** A still of named shots under one directory (file stems, in capture order). */
interface ShotsRow {
  readonly id: string;
  readonly dir: string;
  readonly shots: readonly string[];
  readonly note: string;
}

/** A still of every `NN.png` in a directory, the first `keep` of them (the rest omitted). */
interface ScrollRow {
  readonly id: string;
  readonly dir: string;
  readonly keep?: number;
  readonly omittedReason?: string;
  readonly note: string;
}

/** A recording (whole, or frames 0..`to`; the rest omitted with `cutReason`). */
export interface RecordingRow {
  readonly id: string;
  readonly dir: string;
  readonly to?: number;
  readonly cutReason?: string;
  readonly note: string;
}

const range = (from: number, to: number, pad = 2): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i).padStart(pad, "0"));

const SHOTS: readonly ShotsRow[] = [
  // ------------------------------------------------ text entry
  {
    id: "text/editor",
    dir: "text",
    shots: ["editor-multitap", "editor-reopened", "dictionary-list-off"],
    note: "The empty multi-tap editor after Dictionary off; reopened after C held; Options › Dictionary on Dictionary off.",
  },
  {
    id: "text/key-modes",
    dir: "text/keys",
    shots: ["mode-sentence", "mode-upper", "mode-lower"],
    note: "The empty editor in Abc (sentence case), ABC and abc: the header's mode text.",
  },
  {
    id: "text/commit-gap",
    dir: "text/commit-gap",
    shots: ["1400", "1400-settled", "1450", "1450-settled"],
    note: "Key 2 then key 2 again after a 1400 ms and a 1450 ms key gap (each shot then settled): 1400 cycles to B; 1450 starts a new character (Aa). The raw gap includes key scan and redraw latency.",
  },
  {
    id: "text/commit-other",
    dir: "text",
    shots: ["commit-other"],
    note: "Key 2 then key 3 at once: the pending A commits and D starts (Ad; D in lower case after the sentence start).",
  },
  {
    id: "text/case-after",
    dir: "text/case",
    shots: [
      "after-dot",
      "after-dot-2",
      "after-question",
      "after-question-2",
      "after-exclaim",
      "after-exclaim-2",
    ],
    note: "Ab then . ? ! and a space: the next letter is upper case again (sentence case).",
  },
  {
    id: "text/case-numeric-back-after",
    dir: "text/case-cycle",
    shots: ["sentence-numeric-back-after", "upper-numeric-back-after", "lower-numeric-back-after"],
    note: "After # held into 123 and held again from Abc, ABC and abc: ABC is kept; abc returns to Abc at the empty editor.",
  },
  {
    id: "text/hold-digit-after",
    dir: "text/hold-2",
    shots: ["sentence-after", "lower-after"],
    note: "Key 2 held in Abc and abc, settled: the digit 2.",
  },
  {
    id: "text/hold-star-after",
    dir: "text/hold-star",
    shots: ["sentence-after"],
    note: "* held in the editor, settled: the symbol table.",
  },
  {
    id: "text/hold-hash-back-after",
    dir: "text",
    shots: ["hold-hash-back-2"],
    note: "# held twice from 123 with text 23: back to letters, then # tapped (the text keeps 23#).",
  },
  {
    id: "text/holds-full-before",
    dir: "text/holds-extended",
    shots: ["full-committed-before", "numeric-empty-hash"],
    note: "A full 459-character message with its last character committed; the empty editor in 123 after #.",
  },
  {
    id: "text/symbols",
    dir: "text/symbols",
    shots: ["00", "after-pending", "use-first-before", "use-middle-before", "use-last-before"],
    note: "The symbol table from the empty editor (first cell selected); from a pending character; before Use on the first, a middle and the last cell.",
  },
  {
    id: "text/cursor-one",
    dir: "text/cursor/one",
    shots: [
      "end",
      ...range(1, 7, 1).map((n) => `up-${n}`),
      ...range(1, 7, 1).map((n) => `down-${n}`),
      "middle",
      "middle-typed-pending",
      "middle-typed",
      "middle-c",
    ],
    note: "Hello typed (4 4 · 3 3 · 5 5 5 · 5 5 5 · 6 6 6), then ▲ ×7 and ▼ ×7 (one shot each; ▲ moves right and wraps), ▼ ×3 to the middle, 9 9 typed there (pending, then committed), C.",
  },
  {
    id: "text/cursor-three",
    dir: "text/cursor/three",
    shots: [
      "end",
      "up-01",
      "up-02",
      "up-11",
      "up-12",
      "up-13",
      "up-23",
      "up-24",
      "up-25",
      "up-37",
      "up-38",
      "down-01",
      "down-02",
      "down-13",
      "down-14",
      "down-26",
      "down-27",
      "down-38",
      "down-39",
      "down-40",
      "middle",
      "middle-typed",
    ],
    note: "Adgjm adgjm ×6 then b (three lines; keys 2 3 4 5 6 0 ×6, 2 2), then ▲ ×40 and ▼ ×40 (a shot per key; these are the starts, the line changes and the wraps), ▼ ×12 to the middle, 9 9 typed there.",
  },
  {
    id: "text/delete",
    dir: "text/delete",
    shots: ["00", "c-pending", "c-1", "c-2"],
    note: "Hello with o pending: C deletes the pending o, then the committed l and l (C deletes left of the cursor).",
  },
  {
    id: "text/wrap-words",
    dir: "text/wrap/words",
    shots: ["01", "05", "13", "14", "15", "27", "28", "29", "42", "43", "44", "58", "59", "60"],
    note: "Words of 3-7 letters typed one key per shot (a space after each word): the word that does not fit moves to the next line; the third line full, the view scrolls by one line.",
  },
  {
    id: "text/wrap-long-word",
    dir: "text/wrap/long-word",
    shots: ["13", "14", "26", "27", "32", "33", "34"],
    note: "A word longer than a line, one key per shot: it breaks at the line end, then a space and a new word.",
  },
  {
    id: "text/counter",
    dir: "text/counter",
    shots: [
      "001",
      "150",
      "151",
      "152",
      "153",
      "159",
      "160",
      "161",
      "162",
      "305",
      "306",
      "307",
      "308",
      "457",
      "458",
      "459",
      "460",
      "461",
      "469",
      "470-settled",
    ],
    note: "Keys 2-9 alternating (a space every ninth): the shot named after the characters typed. Counter part changes at 161 (298/2) and 307 (152/3); 0/3 at 459; further keys change only a pending last character.",
  },
  {
    id: "text/number",
    dir: "text/number",
    shots: [
      "00",
      ...range(1, 10).map((n) => `digits-${n}`),
      "len-11",
      "len-12",
      "len-13",
      "len-14",
      "len-19",
      "len-20",
      "len-21",
      "len-22",
      "len-26",
      "len-27",
      "len-28",
      "len-29",
      "len-30",
      "len-31",
      "len-32",
      "12345",
      ...range(1, 6, 1).map((n) => `up-${n}`),
      "down-1",
      "down-2",
      "c",
      "after-moves-9",
      "star-1",
      "star-2",
      "star-3",
      "star-4",
      "star-after-settle",
      "hash",
      "hash-2",
    ],
    note: "Write messages › Options › Send's Phone number: empty; 1-10 digits typed; 11-32 (the layout once ten no longer fit; nothing past 30); 12345 then ▲ ×6 and ▼ ×2, C, 9 typed after moves; * ×4 (* + p w), settled; 1 # and 1 # #.",
  },
  {
    id: "text/input",
    dir: "text/input",
    shots: ["send-by-set", "set-1", "routing-00", "routing-01", "routing-case", "routing-typed"],
    note: "Options › Send by set, Set 1's list, then Alphanumeric's Routing address: empty, A, after # cycles (AElj), typed.",
  },

  // ------------------------------------------------ welcome note
  {
    id: "welcome/editor",
    dir: "welcome",
    shots: ["editor", "hi", "hi-c", "reopened", "36", "37th-key-0"],
    note: "Welcome note (6-2-3): the empty editor (counter 36); Hi typed; then C; reopened on the stored Hi; 36 characters; a 37th key (ignored).",
  },
  {
    id: "welcome/face",
    dir: "welcome/face",
    shots: ["01", "11", "12", "13", "23", "24", "26", "27", "36"],
    note: "Keys 2-9 typed into Welcome note, one shot per key: large at tops 8/22 while two lines fit, then small at tops 8/17/26.",
  },
  {
    id: "welcome/plan15",
    dir: "plan15/welcome",
    shots: [
      "hi-00-editor",
      "hi-01-typed",
      "hi-02-options",
      "long-01-typed",
      "erase-00-editor",
      "erase-01-options",
    ],
    note: "Plan 15's Welcome note captures: the editor, Hi typed, its Options; Welcome to my phone typed; the editor on a stored note and its Options before Erase.",
  },

  // ------------------------------------------------ SMS
  {
    id: "sms/send-prompt",
    dir: "sms/send",
    shots: ["1-prompt", "outbox-after"],
    note: "Send's empty Phone number: prompt; the Messages list on Outbox after the sends.",
  },
  {
    id: "sms/send-by-set-set-2-list",
    dir: "sms/send-by-set",
    shots: ["set-2-highlighted", "set-2-scroll/01", "set-2-scroll/02"],
    note: "Send by set with Set 2 highlighted, and Set 2's Numeric/Alphanumeric list.",
  },
  {
    id: "sms/notice",
    dir: "sms/notice",
    shots: [
      "count-1",
      "count-2",
      "count-3",
      "indicator-after-c",
      "menu-after-c",
      "standby-down-after-c",
      "standby-after-menu",
    ],
    note: "Standby after 1, 2 and 3 arrivals; after C on the notice (the envelope stays); Menu after it (Phone book); ▼ after it (No phone numbers); standby after Menu and back (no notice).",
  },
  {
    id: "sms/inbox",
    dir: "sms/inbox",
    shots: ["standby-unread", "notice-4", "erase-1-after", "erase-2-after", "erase-3-after"],
    note: "Standby with unread messages; the notice of a fourth arrival; the Inbox list after each of three erases.",
  },
  {
    id: "sms/inbox-option-typed",
    dir: "sms/inbox/option",
    shots: ["reply-typed", "reply-prompt", "forward-typed"],
    note: "Reply's empty editor with A typed; its Send's Phone number: prefilled with the sender; Forward's editor with the text kept and a typed.",
  },
  {
    id: "sms/inbox-view-1",
    dir: "sms/inbox/view-1",
    shots: [
      "list",
      "00",
      "down-01",
      "down-02",
      "down-03",
      "up-1",
      "up-2",
      "up-3",
      "up-4",
      "up-5",
      "list-after",
    ],
    note: "A one-page message: the list, Read, ▼ ×3 (text, Sender, Sent, wrap), ▲ ×5, C back to the list.",
  },
  {
    id: "sms/inbox-view-2",
    dir: "sms/inbox/view-2",
    shots: [
      "list",
      "00",
      "down-01",
      "down-02",
      "down-03",
      "down-04",
      "down-05",
      "up-1",
      "up-2",
      "up-3",
      "up-4",
      "up-5",
      "list-after",
    ],
    note: "A long message: the list, Read, ▼ ×5 (whole text pages, Sender, Sent, wrap), ▲ ×5, C back to the list.",
  },
  {
    id: "sms/outbox",
    dir: "sms/outbox",
    shots: ["with-number-typed"],
    note: "A saved message's text with a number in it, typed before Save.",
  },
  {
    id: "sms/outbox-read",
    dir: "sms/outbox/read-1",
    shots: ["00", ...range(1, 7, 1).map((n) => `down-${n}`), "up-1", "up-2", "up-3"],
    note: "The first saved message read: ▼ ×7 and ▲ ×3.",
  },
  {
    id: "sms/full",
    dir: "sms/full",
    shots: ["inbox-10", "outbox-5", "after-16"],
    note: "The Inbox list of ten incoming and the Outbox list of five saved messages (15 slots); a sixteenth arrival: No space for new messages.",
  },
  {
    id: "sms/persist",
    dir: "sms/persist",
    shots: ["editor", "standby"],
    note: "Before saveflash: the editor with the saved text; standby after the cold reboot.",
  },
  {
    id: "sms/restore",
    dir: "sms/restore",
    shots: ["editor", "prompt"],
    note: "Before Restore factory settings: the editor; Restore's security code prompt.",
  },
  {
    id: "sms/sim-same-new-process",
    dir: "sms/sim/same-sim-new-process",
    shots: ["standby"],
    note: "A new emulator process with the same SIM fixture: standby (no envelope).",
  },
  {
    id: "sms/sim-second",
    dir: "sms/sim/second-sim",
    shots: ["standby"],
    note: "A new emulator process with plan 15's second SIM: standby.",
  },
  {
    id: "sms/time-format",
    dir: "sms/time-format",
    shots: ["list", "standby", "view-1", "view-2", "view-3"],
    note: "Clock › Time format's list, 12-hour chosen; standby; then a message's Sender page, its Sent page (still 24-hour) and its text (Twelve hour).",
  },
  {
    id: "sms/elsewhere",
    dir: "sms/elsewhere",
    shots: ["editor-c", "editor-then-standby", "menu-then-standby", "snake-level-1-then-standby"],
    note: "After an arrival in the editor, a menu and Snake II: back at standby, the envelope without a received notice.",
  },
  {
    id: "sms/centre-1",
    dir: "sms/centre-1",
    shots: ["00", "typed-1", "cleared", "typed", "reopened"],
    note: "Set 1's Message centre number (2-7-1-1): as it opens (the SIM's +1234567890), a digit appended, cleared (Search), 0419000000 typed, reopened after the save.",
  },
  {
    id: "sms/centre-2",
    dir: "sms/centre-2",
    shots: ["00", "typed-1", "cleared", "typed", "reopened"],
    note: "Set 2's Message centre number (2-7-2-1): as it opens, a digit typed, cleared, a number typed, reopened after the save.",
  },
  {
    id: "sms/voice-mailbox",
    dir: "sms/voice-mailbox",
    shots: ["00", "typed", "reopened"],
    note: "Voice mailbox number (2-9): as it opens (the virgin number), digits appended, reopened after Saved.",
  },
];

/** The first cycle of each key in ABC and abc (the rest repeats it pixel for pixel). */
function keyRows(): ScrollRow[] {
  const rows: ScrollRow[] = [];
  for (const mode of ["upper", "lower"] as const) {
    for (const key of "1234567890") {
      const length = CYCLE_LENGTHS[mode][key]!;
      rows.push({
        id: `text/key-${key}-${mode}`,
        dir: `text/keys/${key}/${mode}`,
        keep: length,
        omittedReason: "the next cycle: it repeats the first pixel for pixel as Task 0 checked",
        note: `Key ${key} pressed ${length} times in ${mode === "upper" ? "ABC" : "abc"} from the empty editor (a shot per press, the character pending). Abc (sentence start) shows the same characters (text/key-modes has its header).`,
      });
    }
  }
  return rows;
}

const SCROLLS: readonly ScrollRow[] = [
  ...keyRows(),
  {
    id: "text/options",
    dir: "text/options-empty",
    note: "The multi-tap editor's Options (nine entries), ▼ per image.",
  },
  {
    id: "text/case-cycle-empty",
    dir: "text/case-cycle/empty",
    note: "# pressed nine times in the empty editor (a shot before and after each): Abc → ABC → abc → Abc.",
  },
  {
    id: "text/case-cycle-sentence",
    dir: "text/case-cycle/sentence",
    note: "# pressed nine times after Ab. and a space: Abc → ABC → abc → Abc.",
  },
  {
    id: "text/case-cycle-word",
    dir: "text/case-cycle/word",
    note: "# pressed nine times mid-word (after Ab): abc ↔ ABC.",
  },
  {
    id: "text/case-cycle-space",
    dir: "text/case-cycle/space",
    note: "# pressed nine times after Ab and a space: abc ↔ ABC.",
  },
  {
    id: "text/symbols-down",
    dir: "text/symbols/down",
    note: "▼ pressed 31 times from the first cell: the last cell, then each one before it back to the first (▼ retreats and wraps).",
  },
  {
    id: "text/symbols-up",
    dir: "text/symbols/up",
    keep: 1,
    omittedReason: "the cells of text/symbols-down in reverse order: identical pixels as verified",
    note: "▲ from the first cell: the second (▲ advances); the next 30 are text/symbols-down's cells in reverse order.",
  },
  {
    id: "text/wrap-spaces",
    dir: "text/wrap/spaces",
    note: "Spaces typed at a line end (six), then a letter: it starts the second line.",
  },
  {
    id: "text/input-send-by-set-list",
    dir: "text/input/send-by-set-list",
    note: "Send by set's list (Set 1, Set 2), ▼ per image.",
  },
  {
    id: "text/input-set-1-list",
    dir: "text/input/set-1-list",
    note: "Send by set › Set 1's list (Numeric, Alphanumeric), ▼ per image.",
  },
  {
    id: "welcome/options",
    dir: "welcome/options",
    note: "Welcome note's Options: Save, Erase.",
  },
  {
    id: "sms/notice-count-list",
    dir: "sms/notice/count-list",
    note: "Read on the 3 messages received notice: the Inbox list, ▼ per image.",
  },
  {
    id: "sms/inbox-list",
    dir: "sms/inbox/list",
    note: "The Inbox list from Read: four messages, ▼ per image.",
  },
  {
    id: "sms/inbox-list-one-read",
    dir: "sms/inbox/list-one-read",
    note: "The Inbox list after one message was read (its envelope opened), ▼ per image.",
  },
  {
    id: "sms/inbox-menu-2-2-list",
    dir: "sms/inbox/menu-2-2-list",
    note: "The Inbox list through Menu 2 2 (indicator 2-2-1 …), ▼ per image.",
  },
  {
    id: "sms/inbox-options",
    dir: "sms/inbox/options",
    note: "A received message's Options (seven entries), ▼ per image.",
  },
  {
    id: "sms/inbox-details",
    dir: "sms/inbox/option/details-pages",
    note: "Details: Sender, Message centre and Time pages.",
  },
  {
    id: "sms/outbox-list",
    dir: "sms/outbox/list",
    note: "The Outbox list of three saved messages, ▼ per image.",
  },
  {
    id: "sms/outbox-options",
    dir: "sms/outbox/options",
    note: "A saved message's Options (four entries), ▼ per image.",
  },
  {
    id: "sms/full-persist-inbox",
    dir: "sms/full-persist/inbox-after-list",
    note: "The ten-message Inbox list after a cold reboot within one process (pixel-identical to before).",
  },
  {
    id: "sms/full-persist-outbox",
    dir: "sms/full-persist/outbox-after-list",
    note: "The five-message Outbox list after a cold reboot within one process (pixel-identical to before).",
  },
];

const RECORDINGS: readonly RecordingRow[] = [
  // ------------------------------------------------ text entry
  {
    id: "text/dictionary-off",
    dir: "text/dictionary-off",
    note: "From the virgin T9 editor: Options, ▼ to Dictionary, its list, ▲ to Dictionary off, OK: T9 dictionary deactivated, then the multi-tap editor.",
  },
  {
    id: "text/commit",
    dir: "text/commit",
    note: "Key 2 at the start: A pending (no cursor), the commit, then the cursor blinking.",
  },
  { id: "text/blink", dir: "text/blink", note: "Hi committed: the cursor blinking for 5 s." },
  {
    id: "text/commit-blink",
    dir: "text/commit-blink",
    note: "A committed: the cursor blinking for 5 s.",
  },
  {
    id: "text/case-numeric-back",
    dir: "text/case-cycle/sentence-numeric-back",
    note: "# held into 123 from Abc, then held again: back to letters.",
  },
  { id: "text/hold-hash", dir: "text/hold-hash", note: "# held in the empty editor: 123." },
  {
    id: "text/hold-hash-back",
    dir: "text/hold-hash-back",
    note: "In 123 with 23: # tapped and held: # inserted; the hold returns to letters.",
  },
  {
    id: "text/hold-digit",
    dir: "text/hold-2/sentence",
    note: "Key 2 held in Abc: A pending, committed, then replaced by 2 at the next blink.",
  },
  {
    id: "text/hold-digit-lower",
    dir: "text/hold-2/lower",
    note: "Key 2 held in abc: a pending, committed, then replaced by 2.",
  },
  {
    id: "text/hold-digit-pending",
    dir: "text/hold-2-pending",
    note: "Key 2 held while A is pending.",
  },
  {
    id: "text/hold-zero",
    dir: "text/hold-0/sentence",
    note: "Key 0 held in Abc: a space, then 0.",
  },
  {
    id: "text/hold-one",
    dir: "text/hold-1/sentence",
    note: "Key 1 held in Abc: a full stop, then 1.",
  },
  {
    id: "text/hold-numeric",
    dir: "text/holds-extended/numeric-2",
    note: "Key 2 held in 123: 2 inserted once.",
  },
  {
    id: "text/hold-threshold-1450",
    dir: "text/hold-threshold/1450",
    note: "Key 2 held 1450 ms: A stays.",
  },
  {
    id: "text/hold-threshold-1475",
    dir: "text/hold-threshold/1475",
    note: "Key 2 held 1475 ms: 2.",
  },
  {
    id: "text/hold-full",
    dir: "text/holds-extended/full-committed-key",
    note: "A key on a full message whose last character is committed: nothing changes.",
  },
  { id: "text/star-tap", dir: "text/tap-star", note: "* tapped: the symbol table." },
  { id: "text/star-hold", dir: "text/hold-star/sentence", note: "* held: the symbol table." },
  {
    id: "text/symbols-use-first",
    dir: "text/symbols/use-first",
    note: "Use on the first cell: . inserted.",
  },
  {
    id: "text/symbols-use-middle",
    dir: "text/symbols/use-middle",
    note: "Use on cell 16 (@, 15 ▼ from the first).",
  },
  {
    id: "text/symbols-use-last",
    dir: "text/symbols/use-last",
    note: "Use on the last cell: ¥ inserted.",
  },
  { id: "text/symbols-c", dir: "text/symbols/c", note: "C in the symbol table: back to the text." },
  {
    id: "text/delete-hold",
    dir: "text/delete-hold",
    note: "C held on Hell: one deletion, then the text clears.",
  },
  {
    id: "text/delete-hold-short",
    dir: "text/delete-hold-short",
    note: "C held briefly on Hell.",
  },
  {
    id: "text/delete-empty",
    dir: "text/delete-empty",
    note: "C on the empty editor: back to the Messages list (Write messages).",
  },
  {
    id: "text/counter-limit-key",
    dir: "text/counter-limit-key",
    note: "Keys at the 459-character limit: only the pending last character changes.",
  },
  {
    id: "text/number-star-settle",
    dir: "text/number/star-settle",
    note: "Phone number: * settles after the pause.",
  },
  {
    id: "text/number-hold-2",
    dir: "text/number/hold-2",
    note: "Phone number: key 2 held.",
  },
  {
    id: "text/number-hold-star",
    dir: "text/number/hold-star",
    note: "Phone number: * held.",
  },
  {
    id: "text/number-hold-hash",
    dir: "text/number/hold-hash",
    note: "Phone number: # held.",
  },
  {
    id: "text/number-hold-c",
    dir: "text/number/hold-c",
    note: "Phone number: C held on digits: the entry clears.",
  },
  {
    id: "text/number-c-on-empty",
    dir: "text/number/c-on-empty",
    note: "Phone number: C on the empty entry: back to the editor.",
  },
  {
    id: "text/number-search-empty",
    dir: "text/number/search-empty",
    note: "Phone number: Search on the empty entry: No phone numbers, then the prompt.",
  },
  {
    id: "text/input-routing-open",
    dir: "text/input/routing-open",
    note: "Set 1 › Alphanumeric: the Routing address: prompt opens.",
  },
  {
    id: "text/input-routing-ok",
    dir: "text/input/routing-ok",
    note: "Routing address: AElj, OK: Sending message, Message sent, the editor.",
  },

  // ------------------------------------------------ welcome note
  {
    id: "welcome/save-hi",
    dir: "welcome/save-hi",
    note: "Welcome note Hi, Options › Save: Welcome note saved, then the page.",
  },
  {
    id: "welcome/save-empty",
    dir: "welcome/save-empty",
    note: "The empty Welcome note, Options › Save: Welcome note erased.",
  },
  {
    id: "welcome/erase-empty",
    dir: "welcome/erase-empty",
    note: "The empty Welcome note, Options › Erase: Welcome note erased.",
  },
  {
    id: "welcome/c-on-empty",
    dir: "welcome/c-on-empty",
    note: "C on the empty Welcome note: back to the page.",
  },
  { id: "welcome/hold-c", dir: "welcome/hold-c", note: "C held on Welcome note text: cleared." },
  {
    id: "welcome/37th-key",
    dir: "welcome/37th-key",
    note: "A 37th key on a full Welcome note: ignored.",
  },
  {
    id: "welcome/plan15-erase",
    dir: "plan15/welcome/erase",
    note: "Plan 15: Welcome note with a stored note, Options › Erase: Welcome note erased.",
  },
  {
    id: "welcome/plan15-save-long",
    dir: "plan15/welcome/save-long",
    note: "Plan 15: Welcome to my phone, Options › Save: Welcome note saved.",
  },

  // ------------------------------------------------ SMS
  {
    id: "sms/send",
    dir: "sms/send/3",
    note: "Send's Phone number: 0412345678, OK: Sending message (2662.4 ms, the median of five sends), Message sent, the editor with its text.",
  },
  {
    id: "sms/send-by-set-numeric",
    dir: "sms/send-by-set/set-1-numeric",
    note: "Send by set › Set 1 › Numeric: Phone number:, digits, OK: Sending message, Message sent.",
  },
  {
    id: "sms/send-by-set-alphanumeric",
    dir: "sms/send-by-set/set-1-alphanumeric",
    note: "Send by set › Set 1 › Alphanumeric: Routing address:, typed, OK: Sending message, Message sent.",
  },
  {
    id: "sms/send-by-set-set-2",
    dir: "sms/send-by-set/set-2",
    note: "Send by set › Set 2 (no message centre): it asks for one.",
  },
  {
    id: "sms/send-to-many",
    dir: "sms/send-to-many",
    note: "Send to many (virgin phone book): No phone numbers.",
  },
  { id: "sms/template", dir: "sms/template", note: "Template (virgin): no response." },
  {
    id: "sms/insert-smiley",
    dir: "sms/insert-smiley",
    note: "Insert smiley (virgin): no response.",
  },
  {
    id: "sms/save",
    dir: "sms/save",
    note: "Options › Save: Saving message, Message saved, the editor.",
  },
  {
    id: "sms/save-empty",
    dir: "sms/save-empty",
    note: "Options › Save on the empty editor: Saving message, Message saved.",
  },
  { id: "sms/erase", dir: "sms/erase", note: "Options › Erase: the text clears at once." },
  {
    id: "sms/erase-empty",
    dir: "sms/erase-empty",
    note: "Options › Erase on the empty editor.",
  },
  { id: "sms/exit", dir: "sms/exit", note: "Options › Exit: standby." },
  ...range(1, 5, 1).map((n) => ({
    id: `sms/arrive-${n}`,
    dir: `sms/arrive/${n}`,
    note: "An SMS injected at standby: the envelope and 1 message received with Read after the link time.",
  })),
  { id: "sms/notice-c", dir: "sms/notice/c", note: "C on the received notice: dismissed." },
  { id: "sms/notice-read", dir: "sms/notice/read", note: "Read on the notice: the Inbox list." },
  {
    id: "sms/notice-count-read",
    dir: "sms/notice/count-read",
    note: "Read on 3 messages received.",
  },
  {
    id: "sms/notice-inbox-menu",
    dir: "sms/notice/inbox-menu",
    note: "Menu after C on the notice.",
  },
  { id: "sms/notice-up", dir: "sms/notice/up", note: "▲ on the notice: last dialled numbers." },
  { id: "sms/notice-down", dir: "sms/notice/down", note: "▼ on the notice: the Phone book." },
  { id: "sms/notice-digit", dir: "sms/notice/digit", note: "A digit on the notice: number entry." },
  { id: "sms/notice-hash", dir: "sms/notice/hash", note: "# on the notice: number entry." },
  { id: "sms/inbox-read", dir: "sms/inbox/read", note: "Read on the Inbox list: the message." },
  {
    id: "sms/inbox-menu-2-2",
    dir: "sms/inbox/menu-2-2",
    note: "Menu 2 2: Opening, then the Inbox list (2-2-1).",
  },
  {
    id: "sms/inbox-erase-last",
    dir: "sms/inbox/erase-last",
    note: "Erase on the last message: Erase message?, Erasing message, No more messages in inbox.",
  },
  {
    id: "sms/inbox-option-erase",
    dir: "sms/inbox/option/erase",
    note: "Options › Erase: Erase message?, OK: Erasing message, Erased.",
  },
  {
    id: "sms/inbox-option-reply",
    dir: "sms/inbox/option/reply",
    note: "Options › Reply: an empty editor.",
  },
  {
    id: "sms/inbox-option-reply-send",
    dir: "sms/inbox/option/reply-send",
    note: "Reply's editor, Send: the sender prefilled, OK: Sending message, Message sent.",
  },
  {
    id: "sms/inbox-option-chat",
    dir: "sms/inbox/option/chat",
    note: "Options › Chat (plan 18c).",
  },
  {
    id: "sms/inbox-option-edit",
    dir: "sms/inbox/option/edit",
    note: "Options › Edit: the editor with the text.",
  },
  {
    id: "sms/inbox-option-use-number",
    dir: "sms/inbox/option/use-number",
    note: "Options › Use number (a number in the text).",
  },
  {
    id: "sms/inbox-option-use-number-odd",
    dir: "sms/inbox/option/use-number-odd",
    note: "Options › Use number (no number in the text).",
  },
  {
    id: "sms/inbox-option-forward",
    dir: "sms/inbox/option/forward",
    note: "Options › Forward: the editor with the text.",
  },
  {
    id: "sms/inbox-option-details",
    dir: "sms/inbox/option/details",
    note: "Options › Details: the Sender page.",
  },
  {
    id: "sms/inbox-option-details-odd",
    dir: "sms/inbox/option/details-odd",
    note: "Options › Details on another message.",
  },
  { id: "sms/outbox-open", dir: "sms/outbox/open", note: "Menu 2 3: Opening, the Outbox list." },
  {
    id: "sms/outbox-erase-last",
    dir: "sms/outbox/erase-last",
    note: "Erase on the last saved message: No more messages in outbox.",
  },
  {
    id: "sms/outbox-erase",
    dir: "sms/outbox/plain/erase",
    note: "Options › Erase: Erase message?, OK: Erasing message, Erased.",
  },
  {
    id: "sms/outbox-edit",
    dir: "sms/outbox/plain/edit",
    note: "Options › Edit: the editor with the text.",
  },
  {
    id: "sms/outbox-forward",
    dir: "sms/outbox/plain/forward",
    note: "Options › Forward: the editor with the text.",
  },
  {
    id: "sms/outbox-use-number",
    dir: "sms/outbox/plain/use-number",
    note: "Options › Use number (no number in the text).",
  },
  {
    id: "sms/outbox-use-number-found",
    dir: "sms/outbox/number/use-number",
    note: "Options › Use number (a number in the text).",
  },
  {
    id: "sms/full-arrival",
    dir: "sms/full/arrival-16",
    note: "A sixteenth arrival with 15 slots used: No space for new messages.",
  },
  {
    id: "sms/full-save",
    dir: "sms/full/save-16",
    note: "Save with 15 slots used: Message memory full.",
  },
  {
    id: "sms/full-persist-inbox-open",
    dir: "sms/full-persist/inbox-after",
    note: "Menu 2 2 after the cold reboot: the full Inbox.",
  },
  {
    id: "sms/full-persist-outbox-open",
    dir: "sms/full-persist/outbox-after",
    note: "Menu 2 3 after the cold reboot: the full Outbox.",
  },
  {
    id: "sms/persist-inbox",
    dir: "sms/persist/inbox",
    note: "Menu 2 2 after saveflash and a cold reboot.",
  },
  {
    id: "sms/persist-outbox",
    dir: "sms/persist/outbox",
    note: "Menu 2 3 after saveflash and a cold reboot.",
  },
  {
    id: "sms/restore-ok",
    dir: "sms/restore/ok",
    note: "Restore factory settings with 12345.",
  },
  {
    id: "sms/restore-inbox",
    dir: "sms/restore/inbox",
    note: "Menu 2 2 after Restore: the messages are kept.",
  },
  {
    id: "sms/restore-outbox",
    dir: "sms/restore/outbox",
    note: "Menu 2 3 after Restore: the saved messages are kept.",
  },
  {
    id: "sms/sim-same-inbox",
    dir: "sms/sim/same-sim-new-process/inbox",
    note: "Menu 2 2 in a new process with the same SIM fixture: empty.",
  },
  {
    id: "sms/sim-same-outbox",
    dir: "sms/sim/same-sim-new-process/outbox",
    note: "Menu 2 3 in a new process with the same SIM fixture: empty.",
  },
  {
    id: "sms/sim-second-inbox",
    dir: "sms/sim/second-sim/inbox",
    note: "Menu 2 2 with the second SIM: empty.",
  },
  {
    id: "sms/sim-second-outbox",
    dir: "sms/sim/second-sim/outbox",
    note: "Menu 2 3 with the second SIM: empty.",
  },
  {
    id: "sms/elsewhere-menu",
    dir: "sms/elsewhere/menu",
    note: "An arrival in a menu: no interruption.",
  },
  {
    id: "sms/elsewhere-messages-menu",
    dir: "sms/elsewhere/messages-menu",
    note: "An arrival in the Messages menu: no interruption.",
  },
  {
    id: "sms/elsewhere-editor",
    dir: "sms/elsewhere/editor",
    note: "An arrival in the editor: no interruption.",
  },
  {
    id: "sms/elsewhere-note",
    dir: "sms/elsewhere/note",
    note: "An arrival during Invalid shortcut: the note finishes, then the received notice.",
  },
  {
    id: "sms/elsewhere-sending",
    dir: "sms/elsewhere/sending",
    note: "An arrival during Sending message: no interruption.",
  },
  {
    id: "sms/elsewhere-snake",
    dir: "sms/elsewhere/snake-level-1",
    note: "An arrival during Snake II at level 1: play continues (13 moving frames).",
  },
  {
    id: "sms/centre-1-ok",
    dir: "sms/centre-1/ok",
    note: "2-7-1-1 OK: Centre number saved, then the page.",
  },
  {
    id: "sms/centre-1-ok-empty",
    dir: "sms/centre-1/ok-empty",
    note: "2-7-1-1 cleared, the soft key (Search) on the empty entry.",
  },
  {
    id: "sms/centre-2-ok",
    dir: "sms/centre-2/ok",
    note: "2-7-2-1 OK: Centre number saved, then the page.",
  },
  {
    id: "sms/voice-mailbox-ok",
    dir: "sms/voice-mailbox/ok",
    note: "2-9 OK: Saved, then the page.",
  },
];

/** Captures and artefacts deliberately not imported, with the reason (printed by the importer). */
export const MESSAGES_NOT_IMPORTED: Readonly<Record<string, string>> = {
  "plan18/text/keys/*/sentence/":
    "pixel-identical to upper below the header (verified); text/key-modes shows the Abc header",
  "plan18/text/dictionary-off-t9-editor, plan18/text/insert-number-t9/, plan18/text/insert-symbol-t9/":
    "T9 evidence for plan 18b (D3; tree/02-messages/2-1.leaf holds the T9 first screen)",
  "plan18/text/options-text/": "pixel-identical to text/options-empty (verified)",
  "plan18/text/commit-gap/{1300,1350,1500,1550,1600}*":
    "the same two outcomes as 1400 and 1450 (cycle, new character)",
  "plan18/text/case/{empty,sentence,word,space}/":
    "the interleaved type/delete probe; text/case-cycle/ records uninterrupted # presses (Task 0)",
  "plan18/text/case-cycle/{upper,lower}-numeric-back/":
    "the held-# round trip from ABC and abc; their settled screens are text/case-numeric-back-after",
  "plan18/text/hold-{0,1}/lower, plan18/text/hold-7/, plan18/text/holds-extended/{upper,lower,sentence,numeric}-* except numeric-2, plan18/text/holds-extended/threshold-*, plan18/text/hold-threshold/ except 1450 and 1475":
    "per-key and per-duration repeats of the held-key behaviour; Task 0's outcome records their thresholds",
  "plan18/text/cursor/three/ (other shots)":
    "intermediate ▲/▼ positions within a line; text/cursor-three keeps each line change and wrap",
  "plan18/text/wrap/words/, long-word/ (other shots)":
    "one more letter on the same line; text/wrap-words and text/wrap-long-word keep each wrap and scroll",
  "plan18/text/counter/ (other shots)":
    "counter steps between the part boundaries kept in text/counter",
  "plan18/text/number/ (other shots), plan18/text/number/hold-{0,1}":
    "further lengths and ▼ positions; held 0/1 repeat held 2",
  "plan18/welcome/face/ (other shots)":
    "one more letter on the same layout; welcome/face keeps each line change and the large-to-small switch",
  "plan15/welcome/save-hi": "the same flow as plan18/welcome/save-hi (welcome/save-hi)",
  "plan18/sms/send/{1,2,4,5}, plan18/sms/arrive (link-time samples beyond sms/arrive-*)":
    "send link-time samples (2646.4/2790.4/2574.3/2754.4 ms): Task 0's outcome records the spread; sms/send is the median recording",
  "plan18/sms/fail/":
    "attempts that reached no failure note (D14): empty centre OK is Search (sms/centre-1-ok-empty), Set 2 asks for a centre (sms/send-by-set-set-2)",
  "plan18/sms/elsewhere/snake":
    "one frame at the invalid virgin level 175; sms/elsewhere-snake (level 1) proves live play (Task 0 Deviation)",
  "plan18/sms/receive-limits/":
    "the emulator helper's 120-septet cap and ASCII packing, not firmware behaviour (D9); unverified",
  "plan18/sms/inbox/view-{3,4}, plan18/sms/outbox/read-{2,3}, plan18/sms/outbox/number/{edit,erase,forward}":
    "the same reader and Options flows on other messages",
  "plan18/sms/full/inbox-list, plan18/sms/full-persist/*-before":
    "pixel-identical to sms/full-persist-inbox and sms/full-persist-outbox (verified)",
  "plan18/glyphs/small/ multi-tap shots":
    "byte-identical to the text/key-* stills (verified); glyphs/small keeps the symbol-table characters",
  "plan18/glyphs/large/ repeated characters":
    "a character typed twice (digits and punctuation in both cases, symbols on multi-tap keys): one shot per character",
  "plan18/logs/, recordings.json, summary.json, text.json":
    "Task 0 evidence: protocol logs, parents, measurements and OCR (text.json feeds plan 18 Task 3)",
};

// ---------------------------------------------------------------- glyph sheets

/** The characters a glyph sheet note lists, one per image: `manifest <JSON array>`. */
export function manifestNote(what: string, chars: readonly string[]): string {
  return `${what}; manifest ${JSON.stringify(chars)}`;
}

/** The characters of a `manifest` note, or undefined when the note has none. */
export function parseManifestNote(note: string | undefined): string[] | undefined {
  const at = note?.indexOf("; manifest [") ?? -1;
  if (note === undefined || at < 0) return undefined;
  const chars: unknown = JSON.parse(note.slice(at + "; manifest ".length));
  if (!Array.isArray(chars) || !chars.every((c) => typeof c === "string")) {
    throw new MessagesCaptureError("manifest note", "is not a JSON array of strings");
  }
  return chars as string[];
}

/** The multi-tap characters (any mode), from the manifest's multi-tap shots. */
function multitapChars(shots: readonly GlyphShot[]): Set<string> {
  return new Set(shots.filter((shot) => shot.source === "multitap").map((shot) => shot.char));
}

/**
 * The glyph sheets: `glyphs/large` (one shot per distinct character, the first), `glyphs/small`
 * (the characters only the symbol table types; the multi-tap ones are the text/key-* stills) and
 * `glyphs/digits` (the editor header specimens).
 */
export function glyphEntries(io: MessagesCaptureIo): CaptureSetEntry[] {
  const manifest = (face: GlyphFace): readonly GlyphShot[] => {
    const shots = io.manifest(face);
    if (shots === undefined || shots.length === 0) {
      throw new MessagesCaptureError(
        `glyphs/${face}`,
        `missing ${BASE}/glyphs/${face}/manifest.json`,
      );
    }
    for (const shot of shots) {
      if (shot.face !== face || !/^\d{3}\.png$/.test(shot.file)) {
        throw new MessagesCaptureError(`glyphs/${face}`, `bad manifest entry ${shot.file}`);
      }
    }
    return shots;
  };
  const still = (face: GlyphFace, shots: readonly GlyphShot[], what: string): CaptureSetEntry => ({
    id: `glyphs/${face}`,
    kind: "still",
    status: statusOf(`glyphs/${face}`),
    prefer: {
      source: { kind: "shots", files: shots.map((shot) => `${BASE}/glyphs/${face}/${shot.file}`) },
      note: manifestNote(
        what,
        shots.map((shot) => shot.char),
      ),
    },
  });
  const firstPerChar = (shots: readonly GlyphShot[]): GlyphShot[] => {
    const seen = new Set<string>();
    return shots.filter((shot) => {
      if (seen.has(shot.char)) return false;
      seen.add(shot.char);
      return true;
    });
  };
  const small = manifest("small");
  const typed = multitapChars(small);
  const symbolsOnly = firstPerChar(small).filter(
    (shot) => shot.source === "symbols" && shot.dup_of === undefined && !typed.has(shot.char),
  );
  return [
    still(
      "large",
      firstPerChar(manifest("large")),
      "Glyph sheet (large): each typeable character typed once into Phone book › Add name's Name: (plan 19's prompt as a vehicle), shot pending",
    ),
    still(
      "small",
      symbolsOnly,
      "Glyph sheet (small): each character only the symbol table types, inserted with Use into the editor",
    ),
    still(
      "digits",
      manifest("digits"),
      "Editor header specimens (bold six-row mode and counter, cropped by plan 18 Task 3)",
    ),
  ];
}

// ---------------------------------------------------------------- the capture set

function rowError(id: string, message: string): never {
  throw new MessagesCaptureError(id, message);
}

/** An omission reason the golden format can hold: no commas or parentheses. */
function checkReason(id: string, reason: string | undefined): void {
  if (reason !== undefined && !/^[^,()]+$/.test(reason)) {
    rowError(id, `omission reason "${reason}" has a comma or parenthesis`);
  }
}

/** A row's directory under `captures/6.39`: plan 18's, unless it names plan 15's. */
function capturePath(dir: string): string {
  return dir.startsWith("plan15/") ? dir : `${BASE}/${dir}`;
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/** A recording as a timeline golden: the trigger is its first changed frame (plan 14 D8). */
export function recordingEntry(io: MessagesCaptureIo, row: RecordingRow): CaptureSetEntry {
  const dir = capturePath(row.dir);
  const frames = io.recording(dir);
  if (frames === undefined || frames.length === 0) rowError(row.id, `missing capture ${dir}`);
  const last = frames!.length - 1;
  if (row.to !== undefined && (row.to < 1 || row.to >= last)) {
    rowError(row.id, `cut at frame ${row.to} is outside 1..${last - 1}`);
  }
  if ((row.to === undefined) !== (row.cutReason === undefined)) {
    rowError(row.id, "a cut needs both `to` and `cutReason`");
  }
  checkReason(row.id, row.cutReason);
  const shown = row.to === undefined ? frames! : frames!.slice(0, row.to + 1);
  return {
    id: row.id,
    kind: "timeline",
    status: statusOf(row.id),
    prefer: {
      source:
        row.to === undefined
          ? { kind: "recording", dir }
          : { kind: "composite", parts: [{ dir, from: 0, to: row.to }] },
      triggerFrame: firstChangedFrame(shown),
      note: row.note,
      ...(row.to === undefined
        ? {}
        : { omitted: { [`${pad3(row.to + 1)}-${pad3(last)}`]: row.cutReason! } }),
    },
  };
}

function shotsEntry(row: ShotsRow): CaptureSetEntry {
  const dir = capturePath(row.dir);
  const names = row.shots.map((shot) => shot.slice(shot.lastIndexOf("/") + 1));
  const repeated = names.find((name, i) => names.indexOf(name) !== i);
  if (repeated !== undefined) rowError(row.id, `two shots named ${repeated}`);
  return {
    id: row.id,
    kind: "still",
    status: statusOf(row.id),
    prefer: {
      source: { kind: "shots", files: row.shots.map((shot) => `${dir}/${shot}.png`) },
      note: row.note,
    },
  };
}

function scrollEntry(io: MessagesCaptureIo, row: ScrollRow): CaptureSetEntry {
  const dir = capturePath(row.dir);
  const names = io.scrollImages(dir);
  if (names === undefined || names.length === 0) rowError(row.id, `missing capture ${dir}`);
  if ((row.keep === undefined) !== (row.omittedReason === undefined)) {
    rowError(row.id, "keeping part of a directory needs both `keep` and `omittedReason`");
  }
  checkReason(row.id, row.omittedReason);
  if (row.keep === undefined) {
    return {
      id: row.id,
      kind: "still",
      status: statusOf(row.id),
      prefer: { source: { kind: "scroll", dir }, note: row.note },
    };
  }
  if (row.keep < 1 || row.keep >= names!.length) {
    rowError(row.id, `keeps ${row.keep} of ${names!.length} images`);
  }
  // The kept shots by name, the rest as one omitted range (first-last).
  const rest = names!.slice(row.keep);
  const omitted = rest.length === 1 ? rest[0]! : `${rest[0]}-${rest.at(-1)}`;
  return {
    id: row.id,
    kind: "still",
    status: statusOf(row.id),
    prefer: {
      source: {
        kind: "shots",
        files: names!.slice(0, row.keep).map((name) => `${dir}/${name}.png`),
      },
      note: row.note,
      omitted: { [omitted]: row.omittedReason! },
    },
  };
}

/** Every plan 18 LCD golden, in table order (stills, scroll stills, timelines, glyph sheets). */
export function messagesCaptureSet(io: MessagesCaptureIo): CaptureSetEntry[] {
  const entries = [
    ...SHOTS.map(shotsEntry),
    ...SCROLLS.map((row) => scrollEntry(io, row)),
    ...RECORDINGS.map((row) => recordingEntry(io, row)),
    ...glyphEntries(io),
  ];
  const ids = entries.map((entry) => entry.id);
  const repeated = ids.find((id, i) => ids.indexOf(id) !== i);
  if (repeated !== undefined) rowError(repeated, "listed twice");
  return entries;
}
