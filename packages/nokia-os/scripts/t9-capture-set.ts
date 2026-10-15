// T9 predictive text goldens (plan 18b "Golden pipeline additions"): an explicit table over plan
// 18b Task 0's captures (`$REF/captures/plan18b/<scenario>/`), the only bridge between the dirty
// room and the clean room (plan 18b D1, D9).
//
// Each row names a scenario and, for a partial import, the last step kept. Every kept step of the
// scenario's manifest becomes one golden: a still per shot step (`t9/<scenario>/<NN-label>`, both
// cursor-blink phases for a two-shot step) and a timeline per recording step (the recording
// directory's name, the trigger on its first changed frame). Only the manifest's step numbers,
// commands and file names are read; each golden's note is its row's description and the keys
// pressed from the scenario's base, so a scenario can be driven from the golden alone.
//
// Key vocabulary in the notes: digits, `*`, `#`, `c` (the C key), `menu` (the selection key),
// `up`, `down`; `K held N ms`, `wait N ms`, `record N ms` (a timeline starts), `K, recording N
// ms` (a timeline starts just before K), `save flash` and `cold boot` (plan 18b
// `g-persist-dict`: the rig's two phones over one storage).
//
// Goldens are `pending:18b` until their scenario lands (plan 29's pending workflow): the
// implementer adds a golden's id to `T9_PROMOTED` with its acceptance scenario and reimports.
// Reads captures only through the injected `T9CaptureIo`, so tests run it on synthetic manifests.
// Paths are relative to `$REF/captures/6.39` (the importer's root). Pure: imports only siblings.
import type { CaptureSetEntry } from "./capture-set.ts";
import type { GoldenStatus } from "./golden-format.ts";
import { firstChangedFrame, type RecordingFrame } from "./tree-capture-set.ts";

// ---------------------------------------------------------------- io

/** One step of a plan 18b capture manifest (the fields read). */
export interface T9ManifestStep {
  readonly step: number;
  readonly cmd: string;
  /** A still, relative to `captures/plan18b/`. */
  readonly shot?: string;
  /** The other cursor-blink phase of a two-shot step. */
  readonly shot_a?: string;
  /** A recording directory, relative to `captures/plan18b/`. */
  readonly record?: string;
}

export interface T9Manifest {
  readonly scenario: string;
  /** Where the scenario starts: the empty T9 editor, or the Write messages page. */
  readonly base: "editor" | "page";
  readonly steps: readonly T9ManifestStep[];
}

export interface T9CaptureIo {
  /** `captures/plan18b/<scenario>/manifest.json`, or undefined when it is missing. */
  manifest(scenario: string): T9Manifest | undefined;
  /** The frames of `<dir>/timings.csv` (a path from `T9_BASE`), or undefined when missing. */
  recording(dir: string): readonly RecordingFrame[] | undefined;
}

export class T9CaptureError extends Error {
  constructor(where: string, message: string) {
    super(`${where}: ${message}`);
    this.name = "T9CaptureError";
  }
}

/** `captures/plan18b/`, from the importer's root `captures/6.39/`. */
export const T9_BASE = "../plan18b";

// ---------------------------------------------------------------- table

interface T9Row {
  readonly scenario: string;
  /** What the scenario shows (plan 18b's table). */
  readonly note: string;
  /** A partial import: the last step kept, and why the later steps are not imported. */
  readonly through?: { readonly step: number; readonly reason: string };
}

/** Plan 18b "Golden pipeline additions", in table order. */
export const T9_SCENARIOS: readonly T9Row[] = [
  { scenario: "first", note: "Write messages page, the T9 editor, 3 s blink." },
  {
    scenario: "g-compose",
    note: "A four-key word key by key, 3 s with no commit, * six times through the list and the wrap.",
  },
  { scenario: "single", note: "One letter key and * four times: letters, the digit, no ?." },
  { scenario: "punct-alone", note: "Key 1 alone and * nine times." },
  {
    scenario: "g-punct-word",
    note: "A word then key 1, * through the eight marks and the wrap, 0, the next word.",
  },
  {
    scenario: "apostrophe",
    note: "A three-key word, key 1, one more key: the contraction as first display.",
    through: { step: 3, reason: "later displays are key-1 compositions (plan 18b D10)" },
  },
  {
    scenario: "g-nomatch3",
    note: "No match after a five-entry list; an ignored key; the * cycle.",
  },
  { scenario: "g-nomatch2", note: "No match after a two-entry list; the first-* quirk." },
  { scenario: "g-nomatch1", note: "No match after a one-entry list." },
  { scenario: "g-nomatch-keys", note: "0 and C in the no-match state." },
  { scenario: "g-case", note: "# at word starts, held # number mode and back." },
  { scenario: "g-case-upper", note: "# mid-word gives ABC for that word only." },
  {
    scenario: "case-word",
    note: "# while composing.",
    through: { step: 2, reason: "later steps show a candidate order only the firmware has" },
  },
  {
    scenario: "digits",
    note: "Held 5, 0 and 1 insert digits.",
    through: { step: 3, reason: "the next step shows a first candidate only the firmware has" },
  },
  { scenario: "g-delete", note: "C through a composing word and out of the editor." },
  { scenario: "g-delete-across", note: "C back across a space re-enters the previous word." },
  { scenario: "g-cursor-down", note: "▼ word stops, both cursor-blink phases." },
  { scenario: "g-cursor-up", note: "▲ word stops, both cursor-blink phases." },
  { scenario: "g-cursor-reenter", note: "▼ onto a word, *, C, 0; both cursor-blink phases." },
  { scenario: "g-cursor-insert", note: "Typing before a word; both cursor-blink phases." },
  { scenario: "options-empty", note: "Options of the empty T9 editor (12 entries)." },
  { scenario: "g-options", note: "Options with a composing word (13 entries, Matches)." },
  { scenario: "g-matches", note: "Matches, scrolling, Use." },
  { scenario: "g-matches-single", note: "Matches offered for a one-entry list." },
  {
    scenario: "g-spell",
    note: "Spell from no-match, typing, OK; the user word then matches and completes.",
  },
  {
    scenario: "g-insert-word",
    note: "Insert word; an exact user word second; a completion last.",
  },
  { scenario: "g-userwords-two", note: "Two exact user words on one sequence, oldest first." },
  { scenario: "insert-word-empty", note: "OK and C on an empty Insert word prompt." },
  {
    scenario: "g-star-free",
    note: "A short * does nothing with no composing word; held * opens the symbol table; C closes it.",
  },
  {
    scenario: "dictionary-list",
    note: "Options › Dictionary list: opens on English, wraps (the Cyrillic labels are UI text).",
  },
  {
    scenario: "dictionary-off-on",
    note: "Dictionary off (the note), the multi-tap Options list, English on, typing.",
  },
  {
    scenario: "g-persist-dict",
    note: "Dictionary off survives save flash and a cold boot.",
  },
];

/**
 * Goldens whose acceptance scenario has landed (plan 18b Tasks 6-8), asserted on the next import.
 * Every other golden of this set is `pending:18b`.
 */
export const T9_PROMOTED: ReadonlySet<string> = new Set<string>([
  // Plan 18b Tasks 6-8: every golden; its scenario is tests/support/t9.ts's `t9Scenario`.
  "t9/apostrophe/01-don",
  "t9/apostrophe/02-don1",
  "t9/apostrophe/03-dont",
  "t9/case-word/01-goo",
  "t9/case-word/02-hash",
  "t9/dictionary-list/01-options",
  "t9/dictionary-list/02-on-dictionary",
  "t9/dictionary-list/03-list",
  "t9/dictionary-list/04-d1",
  "t9/dictionary-list/05-d2",
  "t9/dictionary-list/06-d3",
  "t9/dictionary-list/07-d4",
  "t9/dictionary-off-on/01-options",
  "t9/dictionary-off-on/02-on-dictionary",
  "t9/dictionary-off-on/03-list",
  "t9/dictionary-off-on/04-on-off",
  "t9/dictionary-off-on/05-off",
  "t9/dictionary-off-on/06-options2",
  "t9/dictionary-off-on/07-mt-opt1",
  "t9/dictionary-off-on/08-mt-opt2",
  "t9/dictionary-off-on/09-mt-opt3",
  "t9/dictionary-off-on/10-mt-opt4",
  "t9/dictionary-off-on/11-mt-opt5",
  "t9/dictionary-off-on/12-mt-opt6",
  "t9/dictionary-off-on/13-mt-opt7",
  "t9/dictionary-off-on/14-mt-opt8",
  "t9/dictionary-off-on/15-back-to-send",
  "t9/dictionary-off-on/16-on-dictionary2",
  "t9/dictionary-off-on/17-list2",
  "t9/dictionary-off-on/18-on-english",
  "t9/dictionary-off-on/19-on",
  "t9/dictionary-off-on/20-typed",
  "t9/digits/01-held5",
  "t9/digits/02-held0",
  "t9/digits/03-held1",
  "t9/first/01-page",
  "t9/first/02-editor",
  "t9/first/03-blink",
  "t9/g-case-upper/01-i",
  "t9/g-case-upper/02-hash",
  "t9/g-case-upper/03-into",
  "t9/g-case-upper/04-space",
  "t9/g-case-upper/05-next",
  "t9/g-case-upper/06-space2",
  "t9/g-case-upper/07-next2",
  "t9/g-case/01-into-",
  "t9/g-case/02-into-",
  "t9/g-case/03-abc-or-abc",
  "t9/g-case/04-w2",
  "t9/g-case/05-hash2",
  "t9/g-case/06-w3",
  "t9/g-case/07-hash3",
  "t9/g-case/08-w4",
  "t9/g-case/09-num",
  "t9/g-case/10-digits",
  "t9/g-case/11-back",
  "t9/g-case/12-w5",
  "t9/g-compose/01-i",
  "t9/g-compose/02-in",
  "t9/g-compose/03-got",
  "t9/g-compose/04-into",
  "t9/g-compose/05-idle",
  "t9/g-compose/06-star1",
  "t9/g-compose/07-star2",
  "t9/g-compose/08-star3",
  "t9/g-compose/09-star4",
  "t9/g-compose/10-star5",
  "t9/g-compose/11-star6",
  "t9/g-cursor-down/01-into-into",
  "t9/g-cursor-down/02-d1",
  "t9/g-cursor-down/03-d2",
  "t9/g-cursor-down/04-d3",
  "t9/g-cursor-down/05-d4",
  "t9/g-cursor-down/06-d5",
  "t9/g-cursor-down/07-d6",
  "t9/g-cursor-insert/01-into-into-",
  "t9/g-cursor-insert/02-d2",
  "t9/g-cursor-insert/03-typed",
  "t9/g-cursor-insert/04-star",
  "t9/g-cursor-insert/05-space",
  "t9/g-cursor-reenter/01-into-",
  "t9/g-cursor-reenter/02-d1",
  "t9/g-cursor-reenter/03-star1",
  "t9/g-cursor-reenter/04-star2",
  "t9/g-cursor-reenter/05-c1",
  "t9/g-cursor-reenter/06-space",
  "t9/g-cursor-up/01-into-into",
  "t9/g-cursor-up/02-u1",
  "t9/g-cursor-up/03-u2",
  "t9/g-cursor-up/04-u3",
  "t9/g-cursor-up/05-u4",
  "t9/g-cursor-up/06-u5",
  "t9/g-cursor-up/07-u6",
  "t9/g-delete-across/01-into-into",
  "t9/g-delete-across/02-c1",
  "t9/g-delete-across/03-c2",
  "t9/g-delete-across/04-c3",
  "t9/g-delete-across/05-c4",
  "t9/g-delete-across/06-c5",
  "t9/g-delete-across/07-c6",
  "t9/g-delete-across/08-c7",
  "t9/g-delete-across/09-c8",
  "t9/g-delete/01-into",
  "t9/g-delete/02-c1",
  "t9/g-delete/03-c2",
  "t9/g-delete/04-c3",
  "t9/g-delete/05-c4",
  "t9/g-delete/06-c5",
  "t9/g-insert-word/01-options",
  "t9/g-insert-word/02-on-insert",
  "t9/g-insert-word/03-prompt",
  "t9/g-insert-word/04-typed",
  "t9/g-insert-word/06-ok",
  "t9/g-insert-word/07-after-ok",
  "t9/g-insert-word/08-space",
  "t9/g-insert-word/09-retype",
  "t9/g-insert-word/10-star1",
  "t9/g-insert-word/11-star2",
  "t9/g-insert-word/12-star3",
  "t9/g-insert-word/13-star4",
  "t9/g-insert-word/14-star5",
  "t9/g-insert-word/15-star6",
  "t9/g-insert-word/16-star7",
  "t9/g-insert-word/17-nomatch",
  "t9/g-insert-word/18-spell",
  "t9/g-insert-word/19-typed2",
  "t9/g-insert-word/21-ok2",
  "t9/g-insert-word/22-space2",
  "t9/g-insert-word/23-retype2",
  "t9/g-insert-word/24-both-star1",
  "t9/g-insert-word/25-both-star2",
  "t9/g-insert-word/26-both-star3",
  "t9/g-insert-word/27-both-star4",
  "t9/g-insert-word/28-both-star5",
  "t9/g-insert-word/29-both-star6",
  "t9/g-insert-word/30-both-star7",
  "t9/g-insert-word/31-both-star8",
  "t9/g-matches-single/01-which",
  "t9/g-matches-single/02-options",
  "t9/g-matches-single/03-d4",
  "t9/g-matches-single/04-d5",
  "t9/g-matches/01-into",
  "t9/g-matches/02-options",
  "t9/g-matches/03-on-matches",
  "t9/g-matches/04-matches",
  "t9/g-matches/05-m2",
  "t9/g-matches/06-m3",
  "t9/g-matches/07-m4",
  "t9/g-matches/08-m5",
  "t9/g-matches/09-m4b",
  "t9/g-matches/10-used",
  "t9/g-nomatch-keys/01-nomatch",
  "t9/g-nomatch-keys/02-zero",
  "t9/g-nomatch-keys/03-nomatch2",
  "t9/g-nomatch-keys/04-c",
  "t9/g-nomatch-keys/05-c2",
  "t9/g-nomatch1/01-which",
  "t9/g-nomatch1/02-nomatch",
  "t9/g-nomatch1/03-star1",
  "t9/g-nomatch1/04-star2",
  "t9/g-nomatch1/05-star3",
  "t9/g-nomatch2/01-that",
  "t9/g-nomatch2/02-nomatch",
  "t9/g-nomatch2/03-star1",
  "t9/g-nomatch2/04-star2",
  "t9/g-nomatch2/05-star3",
  "t9/g-nomatch2/06-star4",
  "t9/g-nomatch3/01-into",
  "t9/g-nomatch3/02-nomatch",
  "t9/g-nomatch3/03-ignored",
  "t9/g-nomatch3/04-star1",
  "t9/g-nomatch3/05-star2",
  "t9/g-nomatch3/06-star3",
  "t9/g-nomatch3/07-star4",
  "t9/g-nomatch3/08-star5",
  "t9/g-nomatch3/09-star6",
  "t9/g-options/01-into",
  "t9/g-options/02-options",
  "t9/g-options/03-opt01",
  "t9/g-options/04-opt02",
  "t9/g-options/05-opt03",
  "t9/g-options/06-opt04",
  "t9/g-options/07-opt05",
  "t9/g-options/08-opt06",
  "t9/g-options/09-opt07",
  "t9/g-options/10-opt08",
  "t9/g-options/11-opt09",
  "t9/g-options/12-opt10",
  "t9/g-options/13-opt11",
  "t9/g-options/14-opt12",
  "t9/g-options/15-opt13",
  "t9/g-persist-dict/01-options",
  "t9/g-persist-dict/02-on-dictionary",
  "t9/g-persist-dict/03-list",
  "t9/g-persist-dict/04-on-off",
  "t9/g-persist-dict/05-off",
  "t9/g-persist-dict/07-page-after-reboot",
  "t9/g-persist-dict/08-editor-after-reboot",
  "t9/g-persist-dict/09-options-after-reboot",
  "t9/g-persist-dict/10-opt1",
  "t9/g-persist-dict/11-opt2",
  "t9/g-persist-dict/12-opt3",
  "t9/g-persist-dict/13-opt4",
  "t9/g-persist-dict/14-opt5",
  "t9/g-persist-dict/15-opt6",
  "t9/g-persist-dict/16-opt7",
  "t9/g-persist-dict/17-opt8",
  "t9/g-punct-word/01-into",
  "t9/g-punct-word/02-into1",
  "t9/g-punct-word/03-star1",
  "t9/g-punct-word/04-star2",
  "t9/g-punct-word/05-star3",
  "t9/g-punct-word/06-star4",
  "t9/g-punct-word/07-star5",
  "t9/g-punct-word/08-star6",
  "t9/g-punct-word/09-star7",
  "t9/g-punct-word/10-star8",
  "t9/g-punct-word/11-star9",
  "t9/g-punct-word/12-space",
  "t9/g-punct-word/13-into",
  "t9/g-spell/01-nomatch",
  "t9/g-spell/02-spell",
  "t9/g-spell/03-typed",
  "t9/g-spell/05-ok",
  "t9/g-spell/06-after-ok",
  "t9/g-spell/07-space",
  "t9/g-spell/08-retype",
  "t9/g-spell/09-retype-star",
  "t9/g-spell/10-space2",
  "t9/g-spell/11-prefix",
  "t9/g-spell/12-prefix-star1",
  "t9/g-spell/13-prefix-star2",
  "t9/g-spell/14-prefix-star3",
  "t9/g-spell/15-prefix-star4",
  "t9/g-spell/16-prefix-star5",
  "t9/g-spell/17-prefix-star6",
  "t9/g-spell/18-prefix-star7",
  "t9/g-star-free/01-star-empty",
  "t9/g-star-free/03-star-empty2",
  "t9/g-star-free/04-held-star-empty",
  "t9/g-star-free/05-c-after-held",
  "t9/g-star-free/06-into-",
  "t9/g-star-free/07-star-after-space",
  "t9/g-star-free/08-held-star-after-space",
  "t9/g-star-free/09-c2",
  "t9/g-userwords-two/01-options",
  "t9/g-userwords-two/02-on-insert",
  "t9/g-userwords-two/03-prompt",
  "t9/g-userwords-two/04-typed",
  "t9/g-userwords-two/06-ok",
  "t9/g-userwords-two/07-space",
  "t9/g-userwords-two/08-options2",
  "t9/g-userwords-two/09-on-insert2",
  "t9/g-userwords-two/10-prompt2",
  "t9/g-userwords-two/11-typed2",
  "t9/g-userwords-two/13-ok2",
  "t9/g-userwords-two/14-space2",
  "t9/g-userwords-two/15-retype",
  "t9/g-userwords-two/16-star1",
  "t9/g-userwords-two/17-star2",
  "t9/g-userwords-two/18-star3",
  "t9/g-userwords-two/19-star4",
  "t9/g-userwords-two/20-star5",
  "t9/g-userwords-two/21-star6",
  "t9/g-userwords-two/22-star7",
  "t9/g-userwords-two/23-star8",
  "t9/insert-word-empty/01-options",
  "t9/insert-word-empty/02-on-insert",
  "t9/insert-word-empty/03-prompt",
  "t9/insert-word-empty/04-ok-empty",
  "t9/insert-word-empty/05-after",
  "t9/insert-word-empty/06-options2",
  "t9/insert-word-empty/07-on-insert2",
  "t9/insert-word-empty/08-prompt2",
  "t9/insert-word-empty/09-c-empty",
  "t9/insert-word-empty/10-after-c",
  "t9/options-empty/01-options",
  "t9/options-empty/02-opt1",
  "t9/options-empty/03-opt2",
  "t9/options-empty/04-opt3",
  "t9/options-empty/05-opt4",
  "t9/options-empty/06-opt5",
  "t9/options-empty/07-opt6",
  "t9/options-empty/08-opt7",
  "t9/options-empty/09-opt8",
  "t9/options-empty/10-opt9",
  "t9/options-empty/11-opt10",
  "t9/options-empty/12-opt11",
  "t9/punct-alone/01-p1",
  "t9/punct-alone/02-p-star1",
  "t9/punct-alone/03-p-star2",
  "t9/punct-alone/04-p-star3",
  "t9/punct-alone/05-p-star4",
  "t9/punct-alone/06-p-star5",
  "t9/punct-alone/07-p-star6",
  "t9/punct-alone/08-p-star7",
  "t9/punct-alone/09-p-star8",
  "t9/punct-alone/10-p-star9",
  "t9/single/01-a",
  "t9/single/02-2-star1",
  "t9/single/03-2-star2",
  "t9/single/04-2-star3",
  "t9/single/05-2-star4",
]);

const EXCLUDED: Readonly<Record<string, string>> = {
  "plan18b/{compose,compose-timing,commit,short,nomatch,nomatch2,nomatch3,silentdrop,punct-word,case,delete,delete-across,delete-hold,cursor,cursor-edit,cursor-reenter,matches,matches-use,spell,insert-word,counter,multi-to-t9}/":
    "planning probes: their screens show candidate lists only the firmware has; each has a g- counterpart or a unit test (plan 18b D9)",
  "plan18b/g-persist/": "planning probe: its navigation went wrong",
  "plan18b/g-persist-word/":
    "a user word lost after a cold boot: evidence for plan 18b Open question 5, not a behaviour to assert",
  "plan18b/g-persist-poweroff/":
    "a known bad run (the capture harness hung after the phone switched itself off); not in plan 18b's table",
  "plan18b/longword/":
    "the 32-key limit: its screens show stems only the firmware has (a unit test)",
  "plan18b/russian/, plan18b/bulgarian/": "Cyrillic T9: plan 26",
  "plan18b/g-audio/":
    "key tones only: evidence for spec 12, no keys.csv (plan 16's format needs it)",
  "plan18b/*/*@8x.png": "8x enlargements of the imported shots",
  "plan18b/*/manifest.json (buffer, OCR), plan18b/README.md, plan18b/gen.log":
    "dirty-room evidence: only step numbers, commands and file names are read",
};

/** Captures deliberately not imported, with the reason (printed by the importer). */
export const T9_NOT_IMPORTED: Readonly<Record<string, string>> = {
  ...EXCLUDED,
  ...Object.fromEntries(
    T9_SCENARIOS.filter((row) => row.through !== undefined).map((row) => [
      `plan18b/${row.scenario}/ steps after ${pad2(row.through!.step)}`,
      row.through!.reason,
    ]),
  ),
};

// ---------------------------------------------------------------- entries

function rowError(where: string, message: string): never {
  throw new T9CaptureError(where, message);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function statusOf(id: string, promoted: ReadonlySet<string>): GoldenStatus {
  return promoted.has(id) ? "asserted" : "pending:18b";
}

const KEY = /^([0-9*#c]|menu|up|down)$/;

function keys(where: string, tokens: readonly string[]): string {
  const bad = tokens.find((token) => !KEY.test(token));
  if (tokens.length === 0 || bad !== undefined) rowError(where, `unknown key "${bad ?? ""}"`);
  return tokens.join(" ");
}

/** A manifest command in the notes' key vocabulary; throws on a command it does not know. */
export function describeCommand(where: string, cmd: string): string | undefined {
  const [verb, ...args] = cmd.trim().split(/\s+/);
  const ms = (value: string | undefined): string => {
    if (value === undefined || !/^\d+$/.test(value)) rowError(where, `bad duration in "${cmd}"`);
    return `${value} ms`;
  };
  switch (verb) {
    case "page":
      return undefined; // the base itself
    case "k":
    case "kk":
      return keys(where, args);
    case "hold":
      if (args.length !== 2) rowError(where, `bad command "${cmd}"`);
      return `${keys(where, [args[0]!])} held ${ms(args[1])}`;
    case "run":
      if (args.length !== 1) rowError(where, `bad command "${cmd}"`);
      return `wait ${ms(args[0])}`;
    case "rec":
      if (args.length !== 2) rowError(where, `bad command "${cmd}"`);
      return `record ${ms(args[1])}`;
    case "reck":
      if (args.length !== 3) rowError(where, `bad command "${cmd}"`);
      return `${keys(where, [args[2]!])}, recording ${ms(args[1])}`;
    case "saveflash":
      return "save flash";
    case "reboot":
      return "cold boot";
    default:
      return rowError(where, `unknown command "${cmd}"`);
  }
}

/** `NN-label` of a capture path, lower case (golden ids and image names are lower case). */
function stem(where: string, path: string, scenario: string): string {
  const match = new RegExp(`^${scenario}/(\\d\\d-[A-Za-z0-9-]+?)(\\.png)?$`).exec(path);
  if (!match) rowError(where, `capture "${path}" is not ${scenario}/NN-<label>`);
  return match[1]!.toLowerCase();
}

function rowEntries(io: T9CaptureIo, row: T9Row, promoted: ReadonlySet<string>): CaptureSetEntry[] {
  const manifest = io.manifest(row.scenario);
  if (manifest === undefined) rowError(row.scenario, "missing manifest.json");
  if (manifest!.scenario !== row.scenario) {
    rowError(row.scenario, `manifest names scenario "${manifest!.scenario}"`);
  }
  if (manifest!.base !== "editor" && manifest!.base !== "page") {
    rowError(row.scenario, `unknown base "${String(manifest!.base)}"`);
  }
  const steps = manifest!.steps;
  steps.forEach((step, i) => {
    if (step.step !== i + 1) rowError(row.scenario, `step ${i + 1} is numbered ${step.step}`);
  });
  const last = row.through?.step ?? steps.length;
  if (last < 1 || last > steps.length || (row.through !== undefined && last === steps.length)) {
    rowError(row.scenario, `keeps steps 1-${last} of ${steps.length}`);
  }
  const from =
    manifest!.base === "page" ? "the Write messages page" : "the empty T9 Write messages editor";

  const done: string[] = [];
  const entries: CaptureSetEntry[] = [];
  for (const step of steps.slice(0, last)) {
    const where = `${row.scenario} step ${step.step}`;
    const command = describeCommand(where, step.cmd);
    if (command !== undefined) done.push(command);
    const note = `${row.note} From ${from}${done.length ? `: ${done.join(" · ")}` : ""}.`;
    const captures = [step.shot, step.shot_a, step.record].filter((c) => c !== undefined);
    if (step.record !== undefined && captures.length > 1) {
      rowError(where, "a step with a recording and shots");
    }
    if (step.shot_a !== undefined && step.shot === undefined) rowError(where, "shot_a alone");
    if (step.record !== undefined) {
      const name = stem(where, step.record, row.scenario);
      const dir = `${T9_BASE}/${step.record}`;
      const frames = io.recording(dir);
      if (frames === undefined || frames.length === 0) rowError(where, `missing capture ${dir}`);
      const id = `t9/${row.scenario}/${name}`;
      entries.push({
        id,
        kind: "timeline",
        status: statusOf(id, promoted),
        prefer: {
          source: { kind: "recording", dir },
          triggerFrame: firstChangedFrame(frames!),
          note,
        },
      });
    } else if (step.shot !== undefined) {
      const name = stem(where, step.shot, row.scenario);
      const files = [{ file: `${T9_BASE}/${step.shot}`, name }];
      if (step.shot_a !== undefined) {
        const other = stem(where, step.shot_a, row.scenario);
        if (other !== `${name}-a`) rowError(where, `second shot "${step.shot_a}" is not ${name}-a`);
        files.push({ file: `${T9_BASE}/${step.shot_a}`, name: other });
      }
      const id = `t9/${row.scenario}/${name}`;
      entries.push({
        id,
        kind: "still",
        status: statusOf(id, promoted),
        prefer: { source: { kind: "shots", files }, note },
      });
    }
  }
  return entries;
}

/** Every plan 18b LCD golden, in table and step order; `promoted` ones asserted. */
export function t9CaptureSet(
  io: T9CaptureIo,
  promoted: ReadonlySet<string> = T9_PROMOTED,
): CaptureSetEntry[] {
  const scenarios = T9_SCENARIOS.map((row) => row.scenario);
  const twice = scenarios.find((s, i) => scenarios.indexOf(s) !== i);
  if (twice !== undefined) rowError(twice, "listed twice");
  const entries = T9_SCENARIOS.flatMap((row) => rowEntries(io, row, promoted));
  const ids = new Set(entries.map((entry) => entry.id));
  if (ids.size !== entries.length) {
    const repeated = entries.find((e, i) => entries.findIndex((x) => x.id === e.id) !== i)!;
    rowError(repeated.id, "listed twice");
  }
  const unknown = [...promoted].filter((id) => !ids.has(id));
  if (unknown.length) rowError(unknown[0]!, "promoted but not imported");
  return entries;
}
