// Plan 19's goldens (docs/plans/19-phone-book.md "Golden pipeline additions"; paths under
// plan19/): the SIM phone book's stills and timelines, and its sound goldens, as an explicit
// table over Task 0's recaptures. Every golden names its SIM fixture (`PHONE_BOOK_SIMS`, the same
// invented contacts Task 0's generator wrote into `plan19/sims/`). Each row is imported
// `pending:19` until the task that implements it is done (`DONE_TASKS`, plan 29's pending
// workflow); Call from a name or a service number and a held speed dial are `pending:22` (the
// dialled numbers and a held key without Speed dialling are plan 22's, asserted here).
//
// Pure: imports only sibling scripts, reads captures through the injected io.
import type { CaptureIo, CaptureSetEntry, PlanCaptureSet } from "../capture-set.ts";
import type { GoldenStatus } from "../golden-format.ts";
import { resources } from "../resource-inputs/19-phone-book.ts";
import {
  buildSoundGolden,
  type SoundCaptureEntry,
  type SoundCaptureIo,
} from "../sound-capture-set.ts";
import type { SoundGolden } from "../sound-format.ts";
import { firstChangedFrame } from "../tree-capture-set.ts";

// ---------------------------------------------------------------- SIM fixtures

/** One SIM phone book entry or service number (the `StockContact` shape). */
export interface PhoneBookContact {
  readonly name: string;
  readonly number: string;
}

/** A SIM fixture as a `StockSimCard` value (plan 19 D2). */
export interface PhoneBookSim {
  readonly id: string;
  readonly phoneBook?: {
    readonly locations?: number;
    readonly nameLength?: number;
    readonly entries?: readonly (PhoneBookContact | null)[];
  };
  readonly serviceNumbers?: readonly PhoneBookContact[];
}

/** The fixture names: `plan19/sims/<name>.json`. */
export type PhoneBookSimName =
  | "content"
  | "two"
  | "full"
  | "fullrev"
  | "small"
  | "empty"
  | "second"
  | "sort";

/**
 * Task 0's SIM fixtures as `StockSimCard` values. `gen_v639_plan19.py check <this file>` reads
 * the object literal between the BEGIN/END lines and compares it with the fixtures it wrote. Every fixture
 * but `second` (plan 15's second SIM: another ICCID) is the emulator SIM's identity, `sim-1`.
 */
// BEGIN PHONE_BOOK_SIMS
const SIMS_JSON = {
  content: {
    id: "sim-1",
    phoneBook: {
      locations: 50,
      entries: [
        { name: "Jack", number: "0400000010" },
        { name: "anna", number: "0400000001" },
        { name: "Ben", number: "0400000002" },
        { name: "Carl", number: "0400000003" },
        { name: "Dave", number: "0400000004" },
        { name: "Eve", number: "0400000005" },
        { name: "Frank", number: "0400000006" },
        { name: "Gina", number: "0400000007" },
        { name: "Harry", number: "0400000008" },
        { name: "Ivy", number: "0400000009" },
        { name: "Abcdefghijklmnop", number: "12345678901234567890" },
        { name: "Intl", number: "+61412345678" },
        { name: "Bob", number: "0412345678" },
        { name: "Ånna", number: "0400000011" },
        { name: "1st", number: "0400000012" },
        { name: "zed", number: "0400000013" },
        { name: "Zed", number: "0400000014" },
        { name: "Lisa Ann Wilson", number: "12345678901234" },
        { name: "Wwwwwwwwwwwwwwww", number: "123456789012345" },
        { name: "Pause", number: "0412p345" },
        { name: "Hash", number: "0400#123" },
        { name: "Star", number: "*100#" },
        { name: "Long", number: "1234567890123456789" },
      ],
    },
    serviceNumbers: [
      { name: "Help", number: "1800123456" },
      { name: "Operator", number: "123" },
    ],
  },
  two: {
    id: "sim-1",
    phoneBook: {
      locations: 50,
      entries: [
        { name: "A", number: "0412345678" },
        { name: "B", number: "0298765432" },
      ],
    },
  },
  full: {
    id: "sim-1",
    phoneBook: {
      locations: 50,
      entries: [
        { name: "N00", number: "0400000000" },
        { name: "N01", number: "0400000001" },
        { name: "N02", number: "0400000002" },
        { name: "N03", number: "0400000003" },
        { name: "N04", number: "0400000004" },
        { name: "N05", number: "0400000005" },
        { name: "N06", number: "0400000006" },
        { name: "N07", number: "0400000007" },
        { name: "N08", number: "0400000008" },
        { name: "N09", number: "0400000009" },
        { name: "N10", number: "0400000010" },
        { name: "N11", number: "0400000011" },
        { name: "N12", number: "0400000012" },
        { name: "N13", number: "0400000013" },
        { name: "N14", number: "0400000014" },
        { name: "N15", number: "0400000015" },
        { name: "N16", number: "0400000016" },
        { name: "N17", number: "0400000017" },
        { name: "N18", number: "0400000018" },
        { name: "N19", number: "0400000019" },
        { name: "N20", number: "0400000020" },
        { name: "N21", number: "0400000021" },
        { name: "N22", number: "0400000022" },
        { name: "N23", number: "0400000023" },
        { name: "N24", number: "0400000024" },
        { name: "N25", number: "0400000025" },
        { name: "N26", number: "0400000026" },
        { name: "N27", number: "0400000027" },
        { name: "N28", number: "0400000028" },
        { name: "N29", number: "0400000029" },
        { name: "N30", number: "0400000030" },
        { name: "N31", number: "0400000031" },
        { name: "N32", number: "0400000032" },
        { name: "N33", number: "0400000033" },
        { name: "N34", number: "0400000034" },
        { name: "N35", number: "0400000035" },
        { name: "N36", number: "0400000036" },
        { name: "N37", number: "0400000037" },
        { name: "N38", number: "0400000038" },
        { name: "N39", number: "0400000039" },
        { name: "N40", number: "0400000040" },
        { name: "N41", number: "0400000041" },
        { name: "N42", number: "0400000042" },
        { name: "N43", number: "0400000043" },
        { name: "N44", number: "0400000044" },
        { name: "N45", number: "0400000045" },
        { name: "N46", number: "0400000046" },
        { name: "N47", number: "0400000047" },
        { name: "N48", number: "0400000048" },
        { name: "N49", number: "0400000049" },
      ],
    },
  },
  fullrev: {
    id: "sim-1",
    phoneBook: {
      locations: 50,
      entries: [
        { name: "N49", number: "0400000049" },
        { name: "N48", number: "0400000048" },
        { name: "N47", number: "0400000047" },
        { name: "N46", number: "0400000046" },
        { name: "N45", number: "0400000045" },
        { name: "N44", number: "0400000044" },
        { name: "N43", number: "0400000043" },
        { name: "N42", number: "0400000042" },
        { name: "N41", number: "0400000041" },
        { name: "N40", number: "0400000040" },
        { name: "N39", number: "0400000039" },
        { name: "N38", number: "0400000038" },
        { name: "N37", number: "0400000037" },
        { name: "N36", number: "0400000036" },
        { name: "N35", number: "0400000035" },
        { name: "N34", number: "0400000034" },
        { name: "N33", number: "0400000033" },
        { name: "N32", number: "0400000032" },
        { name: "N31", number: "0400000031" },
        { name: "N30", number: "0400000030" },
        { name: "N29", number: "0400000029" },
        { name: "N28", number: "0400000028" },
        { name: "N27", number: "0400000027" },
        { name: "N26", number: "0400000026" },
        { name: "N25", number: "0400000025" },
        { name: "N24", number: "0400000024" },
        { name: "N23", number: "0400000023" },
        { name: "N22", number: "0400000022" },
        { name: "N21", number: "0400000021" },
        { name: "N20", number: "0400000020" },
        { name: "N19", number: "0400000019" },
        { name: "N18", number: "0400000018" },
        { name: "N17", number: "0400000017" },
        { name: "N16", number: "0400000016" },
        { name: "N15", number: "0400000015" },
        { name: "N14", number: "0400000014" },
        { name: "N13", number: "0400000013" },
        { name: "N12", number: "0400000012" },
        { name: "N11", number: "0400000011" },
        { name: "N10", number: "0400000010" },
        { name: "N09", number: "0400000009" },
        { name: "N08", number: "0400000008" },
        { name: "N07", number: "0400000007" },
        { name: "N06", number: "0400000006" },
        { name: "N05", number: "0400000005" },
        { name: "N04", number: "0400000004" },
        { name: "N03", number: "0400000003" },
        { name: "N02", number: "0400000002" },
        { name: "N01", number: "0400000001" },
        { name: "N00", number: "0400000000" },
      ],
    },
  },
  small: {
    id: "sim-1",
    phoneBook: { locations: 3, entries: [{ name: "Zed", number: "0499999999" }] },
  },
  empty: { id: "sim-1", phoneBook: { locations: 50, entries: [] } },
  second: {
    id: "sim-2",
    phoneBook: {
      locations: 50,
      entries: [
        { name: "Kim", number: "0411111111" },
        { name: "Lee", number: "0422222222" },
        { name: "Max", number: "0433333333" },
        { name: "Ned", number: "0444444444" },
        { name: "Oz", number: "0455555555" },
      ],
    },
  },
  sort: {
    id: "sim-1",
    phoneBook: {
      locations: 50,
      entries: [
        { name: "Zed", number: "0400000101" },
        { name: "zed", number: "0400000102" },
        { name: "Ånna", number: "0400000103" },
        { name: "Anna", number: "0400000104" },
        { name: "anna", number: "0400000105" },
        { name: "Åsa", number: "0400000106" },
        { name: "Ava", number: "0400000107" },
        { name: "Azz", number: "0400000108" },
        { name: "A b", number: "0400000109" },
        { name: "Ab", number: "0400000110" },
        { name: "Äb", number: "0400000111" },
        { name: "9", number: "0400000112" },
        { name: "1st", number: "0400000113" },
        { name: ".dot", number: "0400000114" },
        { name: "-dash", number: "0400000115" },
        { name: "Émile", number: "0400000116" },
        { name: "Eve", number: "0400000117" },
        { name: "Öla", number: "0400000118" },
        { name: "Ola", number: "0400000119" },
        { name: "Zoe", number: "0400000120" },
        { name: "Ben", number: "0400000121" },
        { name: "ben", number: "0400000122" },
        { name: "Ben", number: "0400000123" },
        { name: "Øle", number: "0400000124" },
        { name: "Ñu", number: "0400000125" },
        { name: "Nu", number: "0400000126" },
        { name: " Lead", number: "0400000127" },
        { name: "A c", number: "0400000128" },
        { name: "_u", number: "0400000129" },
        { name: "ü", number: "0400000130" },
        { name: "A1", number: "0400000131" },
        { name: "Ab ", number: "0400000132" },
      ],
    },
  },
} as const;
// END PHONE_BOOK_SIMS

/** Task 0's SIM fixtures. */
export const PHONE_BOOK_SIMS: Readonly<Record<PhoneBookSimName, PhoneBookSim>> = SIMS_JSON;

// ---------------------------------------------------------------- statuses

/**
 * The tasks whose goldens are asserted: each row names the task that implements it, and is
 * `pending:19` until that task is listed here (plan 29's pending workflow). Task 11 asserts the
 * rest.
 */
export const DONE_TASKS: ReadonlySet<number> = new Set<number>([7, 8, 9, 10, 11]);

/** The plan 19 task that implements a golden. */
type Task = 7 | 8 | 9 | 10 | 11;

/** Goldens another plan implements, by plan: calls and the dialled numbers (plan 22). */
type Owner = "22";

function statusOf(task: Task, owner: Owner | undefined): GoldenStatus {
  if (owner !== undefined) return `pending:${owner}`;
  return DONE_TASKS.has(task) ? "asserted" : "pending:19";
}

// ---------------------------------------------------------------- table

interface Row {
  readonly id: string;
  /** Under plan19/: a recording directory, or the directory of `shots`. */
  readonly dir: string;
  /** Shot file stems under `dir` (a still); absent = `dir` is a recording (a timeline). */
  readonly shots?: readonly string[];
  readonly sim: PhoneBookSimName;
  readonly task: Task;
  readonly owner?: Owner;
  readonly note: string;
}

const range = (prefix: string, from: number, to: number, pad = 2): string[] =>
  Array.from(
    { length: to - from + 1 },
    (_, i) => `${prefix}${String(from + i).padStart(pad, "0")}`,
  );

/** Letter-key shots `<key>-<press>`: each key's letters, its digit and an accent; the inert keys. */
const LETTER_LARGE_SHOTS = [
  "2-1",
  "2-2",
  "2-3",
  "2-4",
  "2-5",
  "5-2",
  "5-5",
  "6-1",
  "6-4",
  "9-2",
  "inert-0",
  "inert-1",
  "inert-star",
  "inert-hash",
];
/** In Name list view, the window after each jump (inside it, outside it, back to the first). */
const LETTER_LIST_SHOTS = [
  "2-1",
  "2-2",
  "2-3",
  "2-4",
  "2-5",
  "3-1",
  "3-4",
  "3-5",
  "4-1",
  "4-2",
  "4-3",
  "4-4",
  "4-5",
  "7-2",
  "7-5",
  "9-2",
  "inert-0",
  "inert-hash",
];

const ROWS: readonly Row[] = [
  // ------------------------------------------------ standby (S)
  {
    id: "phone-book/standby-down-large",
    dir: "standby/down-large",
    sim: "content",
    task: 7,
    note: "SIM content, Large font: ▼ at standby: the ladders erased 23 ms, then the list on its first name with Call.",
  },
  {
    id: "phone-book/standby-down-list",
    dir: "standby/down-list",
    sim: "content",
    task: 7,
    note: "SIM content, Name list view: ▼ at standby, the list's window on the first name.",
  },
  {
    id: "phone-book/standby-down-number",
    dir: "standby/down-number",
    sim: "content",
    task: 7,
    note: "SIM content, Name, number view: ▼ at standby.",
  },
  {
    id: "phone-book/standby-down-empty",
    dir: "standby/down-empty",
    sim: "empty",
    task: 7,
    note: "SIM empty: ▼ at standby: No phone numbers, then standby.",
  },
  {
    id: "phone-book/standby-down-list-c",
    dir: "standby/down-list-c",
    sim: "content",
    task: 7,
    note: "SIM content, Name list view: C in the list: standby without its operator 80 ms, then standby.",
  },
  {
    id: "phone-book/standby-list-c",
    dir: "standby/list-c",
    sim: "content",
    task: 7,
    note: "SIM content: C in the standby list: standby without its operator 86 ms, then standby.",
  },
  {
    id: "phone-book/standby-list-hold-c",
    dir: "standby/list-hold-c",
    sim: "content",
    task: 7,
    note: "SIM content: C held 1.5 s in the standby list: standby, redrawn at the long press.",
  },
  {
    id: "phone-book/standby-lead-c",
    dir: "standby/lead-c",
    sim: "content",
    task: 7,
    note: "SIM content: ▼, then C 10 ms later (in the leading frame): the list opens, C closes it.",
  },
  {
    id: "phone-book/standby-lead-down",
    dir: "standby/lead-down",
    sim: "content",
    task: 7,
    note: "SIM content: ▼, then ▼ again 10 ms later: the list opens on its second name.",
  },
  {
    id: "phone-book/standby-delay",
    dir: "standby/delay-05",
    sim: "content",
    task: 7,
    note: "SIM content: ▼ at standby (one of ten delay probes; leading frames 22-37 ms, median 23).",
  },
  {
    id: "phone-book/standby-list-call",
    dir: "standby/list-call",
    sim: "content",
    task: 7,
    owner: "22",
    note: "SIM content: Call in the standby list: Calling (plan 22).",
  },
  {
    id: "phone-book/standby-up",
    dir: "standby/up",
    sim: "content",
    task: 7,
    note: "SIM content: ▲ at standby: No last dialled numbers, then standby (plan 22).",
  },
  {
    id: "phone-book/standby-up-dialled",
    dir: "standby/up-dialled",
    sim: "content",
    task: 7,
    note: "SIM content, 123 dialled: ▲ at standby: Dialled 1: 123 (plan 22).",
  },
  // ------------------------------------------------ views (V) and sorting
  {
    id: "phone-book/view-large",
    dir: "views/large",
    shots: range("down-", 0, 23),
    sim: "content",
    task: 7,
    note: "SIM content, Large font: the standby list from its first name, ▼ through every name to the wrap.",
  },
  {
    id: "phone-book/view-list",
    dir: "views/list",
    shots: [...range("down-", 0, 24), ...range("up-", 1, 4), "up-24"],
    sim: "content",
    task: 7,
    note: "SIM content, Name list: ▼ through every name past the wrap, then ▲ back past it (the rows window; up-24 back on the first name).",
  },
  {
    id: "phone-book/view-number",
    dir: "views/number",
    shots: range("down-", 0, 23),
    sim: "content",
    task: 7,
    note: "SIM content, Name, number: ▼ through every name to the wrap (long names, long numbers, +, p, #, *).",
  },
  {
    id: "phone-book/view-sort",
    dir: "sort",
    shots: range("down-", 0, 32),
    sim: "sort",
    task: 7,
    note: "SIM sort, Name, number: ▼ through the sort order's corner cases to the wrap.",
  },
  ...(["a", "an", "a-umlaut", "b", "o", "z", "1", "space"] as const).map(
    (q): Row => ({
      id: `phone-book/search-sort-${q}`,
      dir: `sort/search-${q}`,
      sim: "sort",
      task: 7,
      note: `SIM sort, Name, number: Search ${q === "space" ? "a space" : q === "a-umlaut" ? "Ä" : q}, OK.`,
    }),
  ),
  // ------------------------------------------------ letters (L)
  {
    id: "phone-book/letters-large",
    dir: "letters/large",
    shots: LETTER_LARGE_SHOTS,
    sim: "content",
    task: 7,
    note: "SIM content, Large font: in the standby list, keys 2-9 pressed one to five times quickly (k-p: after press p, each from the first name); 0, 1, *, #.",
  },
  {
    id: "phone-book/letters-list",
    dir: "letters/list",
    shots: LETTER_LIST_SHOTS,
    sim: "content",
    task: 7,
    note: "SIM content, Name list: the same letter keys (the window after each jump).",
  },
  {
    id: "phone-book/letters-commit",
    dir: "letters/list/commit",
    sim: "content",
    task: 7,
    note: "SIM content, Name list: 5, 1.7 s, 5 (J again), 2 2 (B), 1.7 s, 2 (A): one-letter queries.",
  },
  // ------------------------------------------------ search (Q)
  {
    id: "phone-book/search-prompt",
    dir: "search",
    shots: ["prompt", "prompt-hash", "prompt-hold-hash", "prompt-star", "prompt-typed-c"],
    sim: "content",
    task: 7,
    note: "SIM content: Search's Name: prompt; then #, held #, *, and A A C.",
  },
  ...(
    [
      "a",
      "an",
      "b",
      "bo",
      "bz",
      "c",
      "gi",
      "l",
      "m",
      "w",
      "z",
      "zz",
      "a-upn-up",
      "an-up",
      "a-umlaut",
      "1",
      "9",
      "space",
      "empty-ok",
    ] as const
  ).map(
    (q): Row => ({
      id: `phone-book/search-${q}`,
      dir: `search/${q}`,
      sim: "content",
      task: 7,
      note: `SIM content: Search, ${q === "empty-ok" ? "nothing typed" : `the query of search/${q}-typed`}, OK: the list on the name found.`,
    }),
  ),
  ...(["c", "gi", "w"] as const).map(
    (q): Row => ({
      id: `phone-book/search-list-view-${q}`,
      dir: `search/list-view-${q}`,
      sim: "content",
      task: 7,
      note: `SIM content, Name list view: Search ${q.toUpperCase()}, OK: the name found on the top row.`,
    }),
  ),
  {
    id: "phone-book/search-list-c",
    dir: "search",
    shots: ["list-c", "list-c-c"],
    sim: "content",
    task: 7,
    note: "SIM content: C in the list Search found: the Phone book level; C again: the carousel.",
  },
  {
    id: "phone-book/search-prompt-c",
    dir: "search/prompt-c",
    sim: "content",
    task: 7,
    note: "SIM content: C on the empty Name: prompt: the Phone book level.",
  },
  {
    id: "phone-book/search-prompt-hold-c",
    dir: "search/prompt-hold-c",
    sim: "content",
    task: 7,
    note: "SIM content: C held on the empty Name: prompt: the level, then standby.",
  },
  {
    id: "phone-book/search-empty-sim",
    dir: "search/empty-sim",
    sim: "empty",
    task: 7,
    note: "SIM empty: Search A, OK: No phone numbers, then the Phone book level.",
  },
  // ------------------------------------------------ service numbers (N)
  {
    id: "phone-book/service-open",
    dir: "service/open",
    sim: "content",
    task: 7,
    note: "SIM content: Service Nos.: the SIM's service numbers with Call.",
  },
  {
    id: "phone-book/service-scroll",
    dir: "service",
    shots: ["down-1", "down-2", "up-1", "up-2"],
    sim: "content",
    task: 7,
    note: "SIM content: Service Nos.: ▼, ▼ (the wrap), then ▲, ▲.",
  },
  {
    id: "phone-book/service-c",
    dir: "service/c",
    sim: "content",
    task: 7,
    note: "SIM content: C in Service Nos.: the Phone book level.",
  },
  {
    id: "phone-book/service-call",
    dir: "service/call",
    sim: "content",
    task: 7,
    owner: "22",
    note: "SIM content: Call on Help: Calling (plan 22).",
  },
  // ------------------------------------------------ add name (A)
  {
    id: "phone-book/add-zoe",
    dir: "add",
    shots: ["name-prompt", "zoe-typed", "zoe-number"],
    sim: "content",
    task: 7,
    note: "SIM content: Add name's Name: prompt, Zoe typed, then 0411222333 typed.",
  },
  {
    id: "phone-book/add-zoe-ok",
    dir: "add/zoe-ok",
    sim: "content",
    task: 7,
    note: "SIM content: OK on Name: Zoe: Phone number: (20, OK).",
  },
  {
    id: "phone-book/add-saved",
    dir: "add/zoe-saved",
    sim: "content",
    task: 7,
    note: "SIM content: OK on 0411222333: Saved, then the list on Zoe with Call.",
  },
  {
    id: "phone-book/add-saved-c",
    dir: "add/zoe-saved-c",
    sim: "content",
    task: 7,
    note: "SIM content: C in the list after Saved: the Phone book level.",
  },
  {
    id: "phone-book/add-saved-down",
    dir: "add",
    shots: ["zoe-after-1", "zoe-after-2", "zoe-after-3"],
    sim: "content",
    task: 7,
    note: "SIM content: ▼ three times in the list after Saved (Zoe sorts after Zed).",
  },
  {
    id: "phone-book/add-empty-ok",
    dir: "add/empty-ok",
    sim: "content",
    task: 7,
    note: "SIM content: OK on the empty Name: Phone number: (OK even when empty).",
  },
  {
    id: "phone-book/add-nothing-to-save",
    dir: "add/nothing-to-save",
    sim: "content",
    task: 7,
    note: "SIM content: OK on the empty Phone number: after an empty name: Nothing to save, then the level.",
  },
  {
    id: "phone-book/add-no-name",
    dir: "add/no-name",
    sim: "content",
    task: 7,
    note: "SIM content: an empty name with 0499000000: Saved, then the list shows the number as its name.",
  },
  {
    id: "phone-book/add-no-number",
    dir: "add/no-number",
    sim: "content",
    task: 7,
    note: "SIM content: Noel with no number: Saved, then the list on Noel.",
  },
  {
    id: "phone-book/add-limits",
    dir: "add",
    shots: [
      "limit-15",
      "limit-16",
      "limit-17th",
      "limit-17th-later",
      "digits-19",
      "digits-20",
      "digits-21st",
    ],
    sim: "content",
    task: 7,
    note: "SIM content: Name: after 15 and 16 fast keys (16 committed), a 17th key; Phone number: after 19, 20 digits and a 21st.",
  },
  {
    id: "phone-book/add-limit-saved",
    dir: "add/limit-saved",
    sim: "content",
    task: 7,
    note: "SIM content: OK on the 20 digits after a 16-character name: Saved, the list on Adgjmptwadgjmptw.",
  },
  {
    id: "phone-book/add-wide",
    dir: "add",
    shots: ["wide-09", "wide-10", "wide-11", "wide-16"],
    sim: "content",
    task: 7,
    note: "SIM content: Name: with 9, 10, 11 and 16 Ms (each committed): the box drops to two lines.",
  },
  {
    id: "phone-book/add-chars",
    dir: "add",
    shots: ["chars-typed", "chars-number", "chars-euro"],
    sim: "content",
    task: 7,
    note: "SIM content: Name: A1é.- (a held 1, key 1's punctuation), Phone number: +0p1*2#3; Name: E€ (€ from the symbol table).",
  },
  {
    id: "phone-book/add-chars-saved",
    dir: "add/chars-saved",
    sim: "content",
    task: 7,
    note: "SIM content: OK on +0p1*2#3 after A1é.-: Saved, the list on A1é.-.",
  },
  {
    id: "phone-book/add-euro-saved",
    dir: "add/chars-euro-saved",
    sim: "content",
    task: 7,
    note: "SIM content: E€ with 0400: Saved, the list on E€.",
  },
  {
    id: "phone-book/add-invalid-char",
    dir: "add/chars-w",
    sim: "content",
    task: 7,
    note: "SIM content: W with 0400w1, OK: Invalid char. for SIM card, then the number prompt with the text.",
  },
  {
    id: "phone-book/add-name-c",
    dir: "add/name-c",
    sim: "content",
    task: 7,
    note: "SIM content: C on Name: Zo: Z.",
  },
  {
    id: "phone-book/add-name-c-empty",
    dir: "add/name-c-empty",
    sim: "content",
    task: 7,
    note: "SIM content: C on the empty Name:: the Phone book level.",
  },
  {
    id: "phone-book/add-name-hold-c",
    dir: "add/name-hold-c",
    sim: "content",
    task: 7,
    note: "SIM content: C held on Name: Zo: Z, then cleared.",
  },
  {
    id: "phone-book/add-number-c-empty",
    dir: "add/number-c-empty",
    sim: "content",
    task: 7,
    note: "SIM content: C on the empty Phone number: (after Zo): the Phone book level.",
  },
  {
    id: "phone-book/add-duplicate",
    dir: "add/duplicate",
    sim: "content",
    task: 7,
    note: "SIM content: Ben (an existing name) with 0400000099, OK: Replace? / Ben.",
  },
  {
    id: "phone-book/add-duplicate-ok",
    dir: "add/duplicate-ok",
    sim: "content",
    task: 7,
    note: "SIM content: OK on Replace? / Ben: Replaced, then the list on Ben.",
  },
  {
    id: "phone-book/add-duplicate-c",
    dir: "add/duplicate-c",
    sim: "content",
    task: 7,
    note: "SIM content: C on Replace? / Ben: Name: with Ben.",
  },
  {
    id: "phone-book/add-full",
    dir: "add/full",
    sim: "full",
    task: 7,
    note: "SIM full: Zoe with 0411222333, OK: Memory full, then Replace? / N00.",
  },
  {
    id: "phone-book/add-full-replace",
    dir: "add/full-replace",
    sim: "full",
    task: 7,
    note: "SIM full: OK on Replace? / N00: Saved, the list on Zoe.",
  },
  {
    id: "phone-book/add-full-replace-c",
    dir: "add/full-replace-c",
    sim: "full",
    task: 7,
    note: "SIM full: C on Replace? / N00: Name: with Zoe.",
  },
  {
    id: "phone-book/add-fullrev",
    dir: "add",
    shots: ["fullrev-down", "fullrev-up"],
    sim: "fullrev",
    task: 7,
    note: "SIM fullrev (the names in reverse SIM order): Replace? after ▼ (N01), then ▲ ▲ (the wrap to N49): sorted.",
  },
  {
    id: "phone-book/add-fullrev-replace",
    dir: "add/fullrev-replace",
    sim: "fullrev",
    task: 7,
    note: "SIM fullrev: OK on Replace? / N49: Saved, the list on Zoe.",
  },
  {
    id: "phone-book/add-empty-sim",
    dir: "add/empty-sim",
    sim: "empty",
    task: 7,
    note: "SIM empty: Zoe with 0411222333: Saved, the list on Zoe.",
  },
  {
    id: "phone-book/add-small-refill",
    dir: "add/small-refill",
    sim: "small",
    task: 9,
    note: "SIM small: Ann and Bea added, Ann erased, Cy added: Saved (Cy fills location 2, add/small-refill-key-2).",
  },
  {
    id: "phone-book/add-small-keys",
    dir: "add",
    shots: ["small-key-2", "small-key-3", "small-refill-key-2", "small-refill-key-3"],
    sim: "small",
    task: 9,
    note: "SIM small: Speed dials keys 2 and 3 after Ann and Bea are added, then after Ann is erased and Cy added.",
  },
  // ------------------------------------------------ options (O)
  ...(
    [
      ["content", "memory-content", "content"],
      ["empty", "memory-empty", "empty"],
      ["full", "memory-full", "full"],
      ["small", "memory-small", "small (after the adds and the erase of add/small-refill)"],
      ["empty", "memory-empty-after-add", "empty, after Zoe was added"],
    ] as const
  ).map(
    ([sim, dir, what]): Row => ({
      id: `phone-book/${dir}`,
      dir: `options/${dir}`,
      sim,
      // memory-small's log passes through Speed dials (Task 9).
      task: dir === "memory-small" ? 9 : 7,
      note: `SIM ${what}: Options › Memory status.`,
    }),
  ),
  ...(["name-list", "name-number", "large-font"] as const).map(
    (slug): Row => ({
      id: `phone-book/view-choose-${slug}`,
      dir: `options/choose-${slug}-ok`,
      sim: "content",
      task: 7,
      note: `SIM content: Options › Type of view, OK on ${slug}: Done, then the page with the value.`,
    }),
  ),
  // ------------------------------------------------ erase (E)
  {
    id: "phone-book/erase-one-by-one",
    dir: "erase/large-one-by-one",
    sim: "content",
    task: 8,
    note: "SIM content: Erase › One by one: the list with Erase.",
  },
  ...(
    [
      ["large", "first"],
      ["list", "middle"],
      ["list", "last"],
    ] as const
  ).flatMap(([view, at]): Row[] => [
    {
      id: `phone-book/erase-${view}-${at}`,
      dir: `erase/${view}-${at}`,
      sim: "content",
      task: 8,
      note: `SIM content, ${view} view: Erase on the ${at} name: Erase? / the name.`,
    },
    {
      id: `phone-book/erase-${view}-${at}-ok`,
      dir: `erase/${view}-${at}-ok`,
      sim: "content",
      task: 8,
      note: `SIM content, ${view} view: OK on Erase? (${at} name): Erased, then the list on the next name.`,
    },
  ]),
  {
    id: "phone-book/erase-query-c",
    dir: "erase/query-c",
    sim: "content",
    task: 8,
    note: "SIM content: C on Erase?: the list.",
  },
  {
    id: "phone-book/erase-list-c",
    dir: "erase/list-c",
    sim: "content",
    task: 8,
    note: "SIM content: C in One by one's list: the Erase level.",
  },
  {
    id: "phone-book/erase-last-name-ok",
    dir: "erase/last-name-ok",
    sim: "small",
    task: 8,
    note: "SIM small: erasing its only name: Memory erased, then the Erase level.",
  },
  {
    id: "phone-book/erase-one-by-one-empty",
    dir: "erase/one-by-one-empty",
    sim: "small",
    task: 8,
    note: "SIM small, emptied: One by one: No phone numbers, then the level.",
  },
  {
    id: "phone-book/erase-all",
    dir: "erase/all",
    sim: "content",
    task: 8,
    note: "SIM content: Erase all: Are you sure?",
  },
  {
    id: "phone-book/erase-all-c",
    dir: "erase/all-c",
    sim: "content",
    task: 8,
    note: "SIM content: C on Are you sure?: the Erase level.",
  },
  {
    id: "phone-book/erase-all-ok",
    dir: "erase/all-ok",
    sim: "content",
    task: 8,
    note: "SIM content: OK on Are you sure?: Security code:.",
  },
  {
    id: "phone-book/erase-all-wrong",
    dir: "erase/all-wrong",
    sim: "content",
    task: 8,
    note: "SIM content (virgin image): 00000, OK: Code error, then the prompt.",
  },
  {
    id: "phone-book/erase-all-code-c",
    dir: "erase/all-code-c",
    sim: "content",
    task: 8,
    note: "SIM content: C on the empty Security code:: the Erase level.",
  },
  {
    id: "phone-book/erase-all-erasing",
    dir: "erase/all-erasing",
    sim: "content",
    task: 8,
    note: "SIM content (factory image): 12345, OK: Erasing memory, Memory erased, the Erase level.",
  },
  {
    id: "phone-book/erase-all-after-down",
    dir: "erase/all-after-down",
    sim: "content",
    task: 8,
    note: "SIM content, erased: ▼ at standby: No phone numbers.",
  },
  {
    id: "phone-book/erase-all-empty",
    dir: "erase/all-empty",
    sim: "empty",
    task: 8,
    note: "SIM empty: Erase all: No phone numbers, then the level.",
  },
  // ------------------------------------------------ edit (D)
  {
    id: "phone-book/edit-open",
    dir: "edit/open",
    sim: "content",
    task: 8,
    note: "SIM content: Edit on anna: Name: with anna.",
  },
  {
    id: "phone-book/edit-name-ok",
    dir: "edit/name-ok",
    sim: "content",
    task: 8,
    note: "SIM content: OK on Name: anna: Phone number: with 0400000001.",
  },
  {
    id: "phone-book/edit-unchanged",
    dir: "edit/unchanged",
    sim: "content",
    task: 8,
    note: "SIM content: OK on the unchanged number: Saved, the list on anna with Edit.",
  },
  {
    id: "phone-book/edit-replace-query",
    dir: "edit/replace-query",
    sim: "content",
    task: 8,
    note: "SIM content: annab, OK, OK: Replace / Add.",
  },
  {
    id: "phone-book/edit-replace",
    dir: "edit/replace",
    sim: "content",
    task: 8,
    note: "SIM content: Replace: Saved, the list on annab.",
  },
  {
    id: "phone-book/edit-add",
    dir: "edit/add",
    sim: "content",
    task: 8,
    note: "SIM content: Add: Saved, the list on annab (anna kept, edit/add-down-*).",
  },
  {
    id: "phone-book/edit-after",
    dir: "edit",
    shots: ["replace-down-1", "add-down-1", "add-down-2", "replace-memory", "add-memory"],
    sim: "content",
    task: 8,
    note: "SIM content: ▼ after Replace and after Add; Memory status after each.",
  },
  {
    id: "phone-book/edit-replace-query-c",
    dir: "edit/replace-query-c",
    sim: "content",
    task: 8,
    note: "SIM content: C on Replace / Add: Name: with annab.",
  },
  {
    id: "phone-book/edit-number-only",
    dir: "edit/number-only",
    sim: "content",
    task: 8,
    note: "SIM content: the number changed only: Saved at once.",
  },
  {
    id: "phone-book/edit-both-replace",
    dir: "edit/both-replace",
    sim: "content",
    task: 8,
    note: "SIM content: name and number changed, Replace: Saved.",
  },
  {
    id: "phone-book/edit-empty-name",
    dir: "edit/empty-name",
    sim: "content",
    task: 8,
    note: "SIM content: the name cleared (C held), OK, OK: Replace / Add.",
  },
  {
    id: "phone-book/edit-empty-number",
    dir: "edit/empty-number",
    sim: "content",
    task: 8,
    note: "SIM content: the number cleared, OK: Saved, the list on anna.",
  },
  {
    id: "phone-book/edit-empty-both",
    dir: "edit/empty-both",
    sim: "content",
    task: 8,
    note: "SIM content: name and number cleared, OK: Nothing to save, then Name: with anna.",
  },
  {
    id: "phone-book/edit-name-c",
    dir: "edit/name-c",
    sim: "content",
    task: 8,
    note: "SIM content: C on Name: anna: ann.",
  },
  {
    id: "phone-book/edit-full-add",
    dir: "edit/full-add",
    sim: "full",
    task: 8,
    note: "SIM full: N00b, Add: Memory full, then Replace? / N00.",
  },
  {
    id: "phone-book/edit-full-add-replace",
    dir: "edit/full-add-replace",
    sim: "full",
    task: 8,
    note: "SIM full: OK on Replace? / N00: Saved, the list on N00b.",
  },
  {
    id: "phone-book/edit-full-add-c",
    dir: "edit/full-add-c",
    sim: "full",
    task: 8,
    note: "SIM full: C on Replace?: Name: with N00b.",
  },
  {
    id: "phone-book/edit-follow",
    dir: "edit",
    shots: [
      "follow-tone-after-replace",
      "follow-speed-after-replace",
      "follow-speed-after-erase",
      "follow-tone-pages-17",
      "follow-speed-after-add",
    ],
    sim: "content",
    task: 9,
    note: "SIM content: Ånna's tone (Low) and speed dial key 3 after Edit › Replace (Ånnax); key 3 after Ånnax is erased; the tone page and key 3 after New fills its location.",
  },
  // ------------------------------------------------ assign tone (T)
  {
    id: "phone-book/tone-pages",
    dir: "tone",
    shots: ["page-01", "page-02", "page-03", "page-16", "page-20", "page-23", "page-24", "page-up"],
    sim: "content",
    task: 8,
    note: "SIM content: Assign tone's pages: the first, ▼ to anna, Ånna, Lisa Ann Wilson, the wide name, 1st, the wrap, then ▲.",
  },
  {
    id: "phone-book/tone-pages-views",
    dir: "tone",
    shots: ["list-page-01", "list-page-02", "number-page-01", "number-page-02"],
    sim: "content",
    task: 8,
    note: "SIM content: Assign tone's first two pages in Name list and Name, number views (the same pages).",
  },
  {
    id: "phone-book/tone-list",
    dir: "tone/list",
    sim: "content",
    task: 8,
    note: "SIM content: Assign on Ånna: the list on Default (1-6-2).",
  },
  ...(["down", "down-2", "down-3", "up", "back-to-default", "no-tone", "wrap"] as const).map(
    (move): Row => ({
      id: `phone-book/tone-preview-${move}`,
      dir: `tone/preview-${move}`,
      sim: "content",
      task: 8,
      note: `SIM content: the tone list, ${move} (the preview's sound: sound/phone-book/tone-preview-${move}).`,
    }),
  ),
  {
    id: "phone-book/tone-ok",
    dir: "tone/ok",
    sim: "content",
    task: 8,
    note: "SIM content: OK on Ring ring: Done, then the page with Ring ring.",
  },
  {
    id: "phone-book/tone-ok-default",
    dir: "tone/ok-default-again",
    sim: "content",
    task: 8,
    note: "SIM content: OK on Default: Done, the page with Default.",
  },
  {
    id: "phone-book/tone-ok-no-tone",
    dir: "tone/ok-no-tone",
    sim: "content",
    task: 8,
    note: "SIM content: OK on No tone: Done, the page with No tone.",
  },
  {
    id: "phone-book/tone-ok-third",
    dir: "tone/ok-third",
    sim: "content",
    task: 8,
    note: "SIM content: OK on Mosquito (1-6-5): Done, then the page with Mosquito.",
  },
  {
    id: "phone-book/tone-list-again",
    dir: "tone/list-again",
    sim: "content",
    task: 8,
    note: "SIM content: Assign on Ånna after Ring ring: the list on Ring ring (1-6-3).",
  },
  {
    id: "phone-book/tone-preview-c",
    dir: "tone/preview-c",
    sim: "content",
    task: 8,
    note: "SIM content: C during a preview: the page, unchanged.",
  },
  {
    id: "phone-book/tone-c",
    dir: "tone/c",
    sim: "content",
    task: 8,
    note: "SIM content: C in the tone list: the page.",
  },
  // ------------------------------------------------ send b'card (B)
  {
    id: "phone-book/bcard-send",
    dir: "bcard/send",
    sim: "content",
    task: 10,
    note: "SIM content: Send on Ånna: an OK-only frame, then Phone number: (30, Search).",
  },
  {
    id: "phone-book/bcard-ok",
    dir: "bcard/ok",
    sim: "content",
    task: 10,
    note: "SIM content: 0412, OK: Sending b'card (3240 ms, the median of six), Business card sent, the list.",
  },
  {
    id: "phone-book/bcard-search",
    dir: "bcard/search",
    sim: "content",
    task: 10,
    note: "SIM content: Search on the empty Phone number:: the name list with OK.",
  },
  {
    id: "phone-book/bcard-search-select",
    dir: "bcard/search-select",
    sim: "content",
    task: 10,
    note: "SIM content: OK on anna: Phone number: with anna's number.",
  },
  {
    id: "phone-book/bcard-prompt-c",
    dir: "bcard/prompt-c",
    sim: "content",
    task: 10,
    note: "SIM content: C on the empty Phone number:: the list.",
  },
  // ------------------------------------------------ speed dials (K)
  {
    id: "phone-book/speed-keys",
    dir: "speed",
    shots: ["key-2", ...range("down-", 3, 10, 1), "up-1", "up-2"],
    sim: "content",
    task: 9,
    note: "SIM content: Speed dials from Key 2: ▼ to Key 9 and the wrap, then ▲ back past it (each key shows SIM location n).",
  },
  ...[2, 3, 4, 5, 6, 7, 8, 9].flatMap((key): Row[] => [
    {
      id: `phone-book/speed-assign-${key}`,
      dir: `speed/assign-${key}`,
      sim: "content",
      task: 9,
      note: `SIM content: Assign on Key ${key}: the list with Select.`,
    },
    {
      id: `phone-book/speed-assign-${key}-saved`,
      dir: `speed/assign-${key}-saved`,
      sim: "content",
      task: 9,
      note: `SIM content: ▼, Select (anna): Speed dial key ${key} saved, then the key with Options.`,
    },
  ]),
  {
    id: "phone-book/speed-options",
    dir: "speed/options",
    sim: "content",
    task: 9,
    note: "SIM content: Options on Key 3 (Ånna): View number, Change, Erase.",
  },
  {
    id: "phone-book/speed-options-c",
    dir: "speed/options-c",
    sim: "content",
    task: 9,
    note: "SIM content: C in the key's Options: the key.",
  },
  {
    id: "phone-book/speed-view",
    dir: "speed/view",
    sim: "content",
    task: 9,
    note: "SIM content: View number: Ånna's number in the large face with Back.",
  },
  {
    id: "phone-book/speed-view-back",
    dir: "speed/view-back",
    sim: "content",
    task: 9,
    note: "SIM content: Back on View number: the key.",
  },
  {
    id: "phone-book/speed-view-long",
    dir: "speed/view-long",
    sim: "content",
    task: 9,
    note: "SIM content: View number of Abcdefghijklmnop's 20 digits (Key 4).",
  },
  {
    id: "phone-book/speed-view-intl",
    dir: "speed/view-intl",
    sim: "content",
    task: 9,
    note: "SIM content: View number of Intl's +61412345678 (Key 5).",
  },
  {
    id: "phone-book/speed-change",
    dir: "speed/change",
    sim: "content",
    task: 9,
    note: "SIM content: Change: the list with Select.",
  },
  {
    id: "phone-book/speed-change-select",
    dir: "speed/change-select",
    sim: "content",
    task: 9,
    note: "SIM content: ▲ (1st), Select: Speed dial key 3 saved, the key on 1st.",
  },
  {
    id: "phone-book/speed-erase",
    dir: "speed/erase",
    sim: "content",
    task: 9,
    note: "SIM content: Erase in the key's Options: Erase? / Ånna.",
  },
  {
    id: "phone-book/speed-erase-c",
    dir: "speed/erase-c",
    sim: "content",
    task: 9,
    note: "SIM content: C on Erase?: the key.",
  },
  {
    id: "phone-book/speed-erase-ok",
    dir: "speed/erase-ok",
    sim: "content",
    task: 9,
    note: "SIM content: OK on Erase?: Speed dial key 3 erased, then Key 3 on its fallback (Ben) with Assign.",
  },
  {
    id: "phone-book/speed-erased-name",
    dir: "speed",
    shots: ["key-6-dave", "key-6-erased"],
    sim: "content",
    task: 9,
    note: "SIM content: Key 6 assigned to Dave; after Dave is erased, Key 6 shows its fallback (Eve) with Assign.",
  },
  {
    id: "phone-book/speed-two",
    dir: "speed",
    shots: range("two-key-", 2, 9, 1),
    sim: "two",
    task: 9,
    note: "SIM two: Keys 2-9 (Key 2: B, the others (empty)).",
  },
  {
    id: "phone-book/speed-small",
    dir: "speed",
    shots: ["small-key-2", "small-key-3", "small-up"],
    sim: "small",
    task: 9,
    note: "SIM small (3 locations): Keys 2 and 3, then ▲.",
  },
  {
    id: "phone-book/speed-small-assign",
    dir: "speed/small-assign",
    sim: "small",
    task: 9,
    note: "SIM small: Assign on Key 2: the list on Zed.",
  },
  {
    id: "phone-book/speed-empty",
    dir: "speed/empty-assign",
    sim: "empty",
    task: 9,
    note: "SIM empty: Assign on Key 2 (empty): No phone numbers, then the key.",
  },
  {
    id: "phone-book/speed-restore",
    dir: "speed",
    shots: ["restore-before", "restore-tone-before", "restore-after", "restore-tone-after"],
    sim: "content",
    task: 9,
    note: "SIM content (factory image): Key 3 (Ben) and Ben's tone (Low) before and after Restore factory settings.",
  },
  // ------------------------------------------------ held keys at standby (H, plan 22)
  ...(["off-2", "on-2"] as const).map(
    (slug): Row => ({
      id: `phone-book/hold-${slug}`,
      dir: `hold/${slug}`,
      sim: "content",
      task: 9,
      // Held 2 with Speed dialling On calls the speed dial: plan 22's follow-up.
      ...(slug === "on-2" ? { owner: "22" as const } : {}),
      note: `SIM content: ${slug.slice(-1)} held at standby with Speed dialling ${slug.startsWith("on") ? "On" : "Off"} (plan 22).`,
    }),
  ),
  // ------------------------------------------------ voice tags (G)
  {
    id: "phone-book/voice-add",
    dir: "voice/add",
    sim: "content",
    task: 9,
    note: "SIM content: Add voice tag: the list with Add voice tag.",
  },
  {
    id: "phone-book/voice-add-select",
    dir: "voice/add-select",
    sim: "content",
    task: 9,
    note: "SIM content: Add voice tag on Ben: Press Start, then speak after tone.",
  },
  {
    id: "phone-book/voice-start",
    dir: "voice/start",
    sim: "content",
    task: 9,
    note: "SIM content: Start: Please speak now (animated), Voice system error, the list.",
  },
  {
    id: "phone-book/voice-quit",
    dir: "voice/quit",
    sim: "content",
    task: 9,
    note: "SIM content: Quit on Please speak now: the list.",
  },
  {
    id: "phone-book/voice-press-start-c",
    dir: "voice/press-start-c",
    sim: "content",
    task: 9,
    note: "SIM content: C on Press Start: the list.",
  },
  ...(["playback", "change", "erase"] as const).map(
    (slug): Row => ({
      id: `phone-book/voice-${slug}`,
      dir: `voice/${slug}`,
      sim: "content",
      task: 9,
      note: `SIM content: Voice tags › ${slug}: No voice tags saved, then the level.`,
    }),
  ),
  ...(["list", "number"] as const).map(
    (view): Row => ({
      id: `phone-book/voice-${view}-add`,
      dir: `voice/${view}-add`,
      sim: "content",
      task: 9,
      note: `SIM content, ${view} view: Add voice tag: the list.`,
    }),
  ),
  // ------------------------------------------------ persistence and SIMs (P)
  {
    id: "phone-book/persist-before",
    dir: "persist",
    shots: ["before-list", "before-key-3", "before-tone-dave"],
    sim: "content",
    task: 11,
    note: "SIM content: after Add Zoe, Edit anna → annab, Erase Ben, Key 3 → Carl, Dave's tone Low: the list, Key 3, Dave's page.",
  },
  {
    id: "phone-book/persist-after",
    dir: "persist",
    shots: [
      "after-list",
      "after-down-1",
      "after-down-2",
      "after-down-3",
      "after-key-3",
      "after-tone-dave",
      "after-memory",
    ],
    sim: "content",
    task: 11,
    note: "SIM content: the same after saveflash and a cold boot of the saved image.",
  },
  {
    id: "phone-book/sim-second",
    dir: "sim",
    shots: [
      "second-list",
      ...range("second-down-", 1, 5, 1),
      ...range("second-key-", 2, 6, 1),
      ...range("second-tone-", 1, 5, 1),
    ],
    sim: "second",
    task: 11,
    note: "SIM second on the saved image: its own names; Keys 2-6 and the tones show none of the content SIM's.",
  },
  {
    id: "phone-book/sim-same",
    dir: "sim",
    shots: ["same-list", "same-key-3"],
    sim: "content",
    task: 11,
    note: "SIM content again on the saved image (a new process: the fixture's names; Key 3 still Carl).",
  },
  // ------------------------------------------------ pickers (X)
  {
    id: "phone-book/pick-send-search",
    dir: "pick/send-search",
    sim: "content",
    task: 10,
    note: "SIM content: Write messages › Options › Send, Search: the name list with OK.",
  },
  {
    id: "phone-book/pick-send-search-select",
    dir: "pick/send-search-select",
    sim: "content",
    task: 10,
    note: "SIM content: OK on anna: Phone number: with anna's number.",
  },
  {
    id: "phone-book/pick-send-to-many",
    dir: "pick/send-to-many",
    sim: "content",
    task: 10,
    note: "SIM content: Send to many: an OK-only frame, then the name list with Send.",
  },
  {
    id: "phone-book/pick-send-to-many-send",
    dir: "pick/send-to-many-send",
    sim: "content",
    task: 10,
    note: "SIM content: Send on anna: Sending message, Message sent, the list.",
  },
  {
    id: "phone-book/pick-send-to-many-c",
    dir: "pick/send-to-many-c",
    sim: "content",
    task: 10,
    note: "SIM content: C in Send to many's list: the editor.",
  },
];

/** The SIM fixture a golden's capture ran with, by golden id. */
export const PHONE_BOOK_GOLDEN_SIMS: Readonly<Record<string, PhoneBookSimName>> =
  Object.fromEntries(ROWS.map((row) => [row.id, row.sim]));

function lcdEntries(io: CaptureIo | undefined): CaptureSetEntry[] {
  return ROWS.map((row): CaptureSetEntry => {
    const status = statusOf(row.task, row.owner);
    const note = row.note;
    if (row.shots !== undefined) {
      return {
        id: row.id,
        kind: "still",
        status,
        prefer: {
          source: { kind: "shots", files: row.shots.map((s) => `plan19/${row.dir}/${s}.png`) },
          note,
        },
      };
    }
    const dir = `plan19/${row.dir}`;
    const frames = io?.frames.recording(dir);
    return {
      id: row.id,
      kind: "timeline",
      status,
      prefer: {
        source: { kind: "recording", dir },
        triggerFrame: frames === undefined ? 1 : firstChangedFrame(frames),
        note,
      },
    };
  });
}

// ---------------------------------------------------------------- sounds

interface SoundRow {
  readonly id: string;
  readonly dir: string;
  readonly task: Task;
  readonly note: string;
}

/**
 * The sound goldens (factory, Warning tones On unless the note says Off): the new notes'
 * sounds, as `sound/note/<name>` when they play a warning tone (the form plan 16's extractor
 * reads `NOTE_SOUNDS` from: the note quotes the text) and `sound/phone-book/<name>` when only the
 * key beeps; the tone list's previews; Send b'card.
 */
const SOUND_ROWS: readonly SoundRow[] = [
  {
    id: "sound/note/nothing-to-save",
    dir: "notes/nothing-to-save",
    task: 7,
    note: '"Nothing to save" (Warning tones On) after OK on Add name\'s empty Phone number: (SIM content).',
  },
  {
    id: "sound/note/memory-full",
    dir: "notes/memory-full",
    task: 7,
    note: '"Memory full" (Warning tones On) after OK on Add name\'s Phone number: (SIM full).',
  },
  {
    id: "sound/phone-book/nothing-to-save-off",
    dir: "notes/nothing-to-save-off",
    task: 7,
    note: "Nothing to save with Warning tones Off: silent but for OK's beep (SIM content).",
  },
  {
    id: "sound/phone-book/saved",
    dir: "notes/saved",
    task: 7,
    note: "Saved after Add name: OK's beep only (SIM content).",
  },
  {
    id: "sound/phone-book/erased",
    dir: "notes/erased",
    task: 8,
    note: "Erased after One by one: OK's beep only (SIM content).",
  },
  {
    id: "sound/phone-book/memory-erased",
    dir: "notes/memory-erased",
    task: 8,
    note: "Erasing memory and Memory erased after Erase all's code: OK's beep only (SIM content).",
  },
  {
    id: "sound/phone-book/done",
    dir: "notes/done",
    task: 8,
    note: "Done after Assign tone's OK on Default: OK's beep only (SIM content).",
  },
  {
    id: "sound/phone-book/speed-dial-saved",
    dir: "notes/speed-dial-saved",
    task: 9,
    note: "Speed dial key 3 saved: Select's beep only (SIM content).",
  },
  {
    id: "sound/phone-book/speed-dial-erased",
    dir: "notes/speed-dial-erased",
    task: 9,
    note: "Speed dial key 3 erased: OK's beep only (SIM content).",
  },
  {
    id: "sound/phone-book/voice-system-error",
    dir: "notes/voice-system-error",
    task: 9,
    note: "Start on Press Start: Please speak now, Voice system error with its 675 Hz DSP beeps (SIM content).",
  },
  {
    id: "sound/phone-book/bcard",
    dir: "notes/business-card-sent",
    task: 10,
    note: "Send b'card's OK: Sending b'card and Business card sent: OK's beep only (SIM content).",
  },
  ...(["down", "down-2", "down-3", "up", "back-to-default", "no-tone", "wrap"] as const).map(
    (move): SoundRow => ({
      id: `sound/phone-book/tone-preview-${move}`,
      dir: `tone/preview-${move}`,
      task: 8,
      note: `Assign tone's list, ${move}: the key's beep and the highlighted entry's preview ≈990 ms later (SIM content).`,
    }),
  ),
];

export const PHONE_BOOK_SOUNDS: readonly SoundCaptureEntry[] = SOUND_ROWS.map((row) => ({
  id: row.id,
  dir: `plan19/${row.dir}`,
  state: "factory",
  status: statusOf(row.task, undefined),
  note: row.note,
}));

/** The plan 19 task that implements each golden (sound goldens included), by id. */
export const PHONE_BOOK_TASKS: Readonly<Record<string, number>> = Object.fromEntries([
  ...ROWS.map((row) => [row.id, row.task]),
  ...SOUND_ROWS.map((row) => [row.id, row.task]),
]);

export function phoneBookSounds(io: SoundCaptureIo): SoundGolden[] {
  return PHONE_BOOK_SOUNDS.map((entry) => buildSoundGolden(entry, io));
}

// ---------------------------------------------------------------- the set

export const PHONE_BOOK_NOT_IMPORTED: Readonly<Record<string, string>> = {
  "plan19/**/*@8x.png": "previews",
  "plan19/text.json, recordings.json, logs/": "OCR and recording parents (the generator's check)",
  "plan19/sims/": "the SIM fixtures (restated as PHONE_BOOK_SIMS)",
  "plan19/standby/{delay-00..09 but 05,lead-up,up-empty,down-number-c}, after-up, dialled-calling, list-call-end, up-dialled-end":
    "more probes of the leading frame and of plan 22's screens (standby-delay keeps one; Task 0's outcome lists them)",
  "plan19/views/{large,number}/{down-24,up-*}, views/list/up-05..23":
    "the same screens again after the wrap; ▲ through the middle",
  "plan19/letters/*: the presses LETTER_*_SHOTS leave out, *-settled":
    "more keys of the same rule (Task 0's outcome lists every result); settled screens are unchanged",
  "plan19/search/*-typed, list-view-*'s prompts, d e f g h i j ja ca le p s, prompt-typed-hold-c, empty-sim-ok":
    "more queries of the same rule (Task 0's outcome lists every result); the recordings' frame 0 shows each typed query",
  "plan19/service/{call-end,down-3,up-3}, service/empty":
    "plan 22's call screen; the wrap again; plan 14's tree golden already shows the empty SIM's note",
  "plan19/add/{limit-01..14,digits-01..18,wide-01..08,wide-12..15}, chars-*-selected, chars-symbol*, duplicate-*down*, full-replace-down*, fullrev, fullrev-key-2, zoe-saved-call's end, name-c-c, number-c*, chars-euro-ok, chars-w-typed":
    "intermediate counters, the symbol table (plan 18's goldens), probes whose rule the imported goldens show",
  "plan19/erase/{large-middle*,large-last*,number-first*,list-first*,list-one-by-one,number-middle*,number-last*,number-one-by-one,all-query,last-name,last-name-end,all-code,after-all-empty,all-after-memory}":
    "the same notes and flows in another view or position",
  "plan19/edit/{add-query,add-selected,*-typed,both-query,number-c,name-cleared,number-cleared,number-typed,empty-name-ok,unchanged-down-*,replace-down-2..3,add-down-3,follow-* but the edit-follow shots,list}":
    "intermediate screens of the imported flows",
  "plan19/tone/{ok-default,page-after*,no-tone-list,preview-up-default,list-last,default-again,page-04..15,17..19,21,22,25,26}":
    "the same rules on other tones and pages",
  "plan19/bcard/{again-*,search-ok,typed,typed-c,list}":
    "the link-time probes (Task 0: 3237-3359 ms) and their prompts; bcard-ok holds the flow",
  "plan19/speed/{up-3..8,assign-3-ben,key-3-assigned,small-past-last*,small-assign-select}":
    "intermediate shots; the emulator's hang past a small SIM's last key (an artefact)",
  "plan19/hold/{off-1,off-5,on-1,on-5,on-9}, *-end, speed-dialling-list, add/zoe-saved-call":
    "more of plan 22's held keys and call screens",
  "plan19/voice/{level,start-end}": "the level (plan 14's golden) and the list again",
  "plan19/notes/{saved-off}, notes/* LCD":
    "the notes' screens are the flows' goldens; only their sound is imported",
  "plan19/pick/{send-prompt,send-search-ok,send-to-many-after,send-to-many-send-2}":
    "plan 18's Send flow (its goldens), the list after a send",
  "plan19/**/*.wav, plan19/**/*.events.csv but sound/*'s": "the LCD sections' audio",
  "scratch-plan19/": "planning probes (plan 19 S1-S17), never imported",
};

export const phoneBook: PlanCaptureSet = {
  plan: "19",
  resources,
  lcd: (io) => lcdEntries(io),
  sounds: (io) => phoneBookSounds(io.sound),
  notImported: PHONE_BOOK_NOT_IMPORTED,
};
