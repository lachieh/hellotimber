// How the generated stock tree (src/firmware/generated/stock-tree.ts) binds to behaviour (plan 14
// D4). Setting keys and aliases come first (Task 8); Task 12 adds the leaf bindings.
import type { StockTreeNode } from "./generated/stock-tree";

/** A setting's key: the slug path of its tree node below the menu (`tones/ringing-volume`). */
export function settingKey(path: readonly StockTreeNode[]): string {
  return path.map((node) => node.slug).join("/");
}

/** Kebab-case slug of a label: line breaks become spaces, apostrophes vanish (plan 13). */
export function slugOf(label: string): string {
  return label
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Settings one menu shares with another (D9, P11): Tones are the active profile's Personalise
 * settings, and the virgin EEPROM's active profile is General. Silent and the other profiles
 * keep their own. Plan 17 makes the active profile switchable.
 */
export const SETTING_ALIASES: readonly { readonly prefix: string; readonly target: string }[] = [
  { prefix: "tones/", target: "profiles/general/personalise/" },
];

/**
 * The key `key` shares by `SETTING_ALIASES`, else itself. The virgin settings alias a key only
 * when that target exists (Composer has no Personalise counterpart).
 */
export function settingAlias(key: string): string {
  for (const { prefix, target } of SETTING_ALIASES) {
    if (key.startsWith(prefix)) return target + key.slice(prefix.length);
  }
  return key;
}

/** Host ports whose text appears on stock pages (and the clock on standby). */
export interface StockPorts {
  /** "HH:MM"; shown on Clock → Clock settings (and on standby). */
  clock?: () => string | undefined;
  /** Date text in the firmware's format (captured: `13.10.2026`); shown on Clock → Date setting. */
  date?: () => string | undefined;
}

/**
 * The Clock settings page under 12-hour Time format: `10:10` reads `10:10 am`
 * (`tree/11-clock/11-2-3-2.choose` image e). Other hours are UNVERIFIED (12-hour clock rules).
 */
export function twelveHourClock(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (match === null) return hhmm;
  const hours = Number(match[1]);
  const shown = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(shown).padStart(2, "0")}:${match[2]} ${hours < 12 ? "am" : "pm"}`;
}

/** The Time format setting and its 12-hour option (11-2-3, option 2). */
export const TIME_FORMAT = { key: "clock/clock-settings/time-format", twelveHour: 1 } as const;

/** Pages whose value is the host's (plan 13 D6), by setting key. */
export const HOST_VALUES: Readonly<Record<string, keyof StockPorts>> = {
  "clock/clock-settings": "clock",
  "clock/date-setting": "date",
};

/**
 * Virgin free-text values (D10) that are not page values, by key: a leaf screen's line from the
 * tree (`number`, `line`), or a value read from a golden (`text`).
 */
export const VIRGIN_TEXTS: readonly (
  | { readonly key: string; readonly number: string; readonly line: number }
  | { readonly key: string; readonly text: string }
)[] = [
  // tree/02-messages/2-7-1-1.leaf "c": the SIM's message centre (an emulator artefact). The tree
  // has no lines for this prompt.
  { key: "messages/message-settings/set-1/message-centre-number", text: "+1234567890" },
  // The SIM's voice mailbox (2-9 `Phone number:`).
  { key: "messages/voice-mailbox-number", number: "2-9", line: 1 },
  // Phone book › Options › Memory status: `SIM card:` / `50 free` / `0 in use`.
  { key: "phone-book/options/memory-status/free", number: "1-8-2", line: 1 },
  { key: "phone-book/options/memory-status/used", number: "1-8-2", line: 2 },
  // Top scores (`Top score:` / the score): uninitialised game EEPROM (Snake II, Space impact)
  // and zero (Pairs II).
  { key: "games/snake/top-score", number: "8-1-4", line: 1 },
  { key: "games/space-impact/top-score", number: "8-2-2", line: 1 },
  { key: "games/pairs-ii/time-trial/top-score", number: "8-4-1-3", line: 1 },
  { key: "games/pairs-ii/puzzle/top-score", number: "8-4-2-3", line: 1 },
];

/**
 * Option lists whose indicator is not `<list path>-<k>`, by node number prefix (measured on the
 * first image of every option-list golden): the lists of Message settings › Set n show only the
 * option's number (`tree/02-messages/2-7-1-3.options`: `6`), and the Call divert lists show their
 * parent level's path (`tree/07-call-divert/7-3-4.options`: `7-3-0`, `7-3-1`).
 */
const OPTION_LIST_NUMBERING: readonly {
  readonly prefix: string;
  readonly numbering: "parent" | "option";
}[] = [
  { prefix: "2-7-", numbering: "option" },
  { prefix: "7-", numbering: "parent" },
];

/** How the option list at tree node `number` numbers its indicator. */
export function optionListNumbering(number: string): "path" | "parent" | "option" {
  return OPTION_LIST_NUMBERING.find(({ prefix }) => number.startsWith(prefix))?.numbering ?? "path";
}

/**
 * Generated widget timelines for notes whose node has none of its own (no golden recorded it),
 * by note text: a representative recording of the same note class (D8). Timelines are keyed by
 * their first covered node (`WIDGET_TIMELINE_BY_NODE`): `Done` is a tick confirmation (box 684,
 * half 232, full 540 ms), `Timeout selected` a long one (full ≈1978 ms), `Requesting` the
 * looping bar.
 */
export const NOTE_STYLES: Readonly<Record<string, string>> = {
  Done: "2-7-3-3-2",
  "Timeout selected": "5-9-3-1",
  Requesting: "7-6",
};

/** The widget timeline id of the note at tree node `number` with text `lines`, if any. */
export function noteTimelineId(
  byNode: Readonly<Record<string, string>>,
  number: string,
  lines: readonly string[],
): string | undefined {
  return byNode[number] ?? NOTE_STYLES[lines.join(" ")];
}

/** How a prompt's first screen is laid out, measured on its golden (D11). */
export interface PromptLayout {
  /** Mode icons: `pen`, `abc` (`Abc`), `abc-lower`, `phone-book`. */
  readonly icons: readonly ("pen" | "abc" | "abc-lower" | "phone-book")[];
  /** Characters left, top right (prompts whose tree node has no lines, Task 8). */
  readonly counter?: string;
  /** Label lines when the tree node has none. */
  readonly label?: readonly string[];
  /** The value when the tree node has no lines. */
  readonly value?: string;
  /** `none`: a code prompt; `value`: below the label; else a box (see `PromptEntry`). */
  readonly entry: "none" | "value" | "text" | "end" | "start" | "box";
  /** The value's face in a box (default large). */
  readonly font?: "small";
  /** When the tree node has none. */
  readonly softkey?: string;
}

const PEN_BOX_END: PromptLayout = { icons: ["pen"], entry: "end" };
const PEN_BOX_START: PromptLayout = { icons: ["pen"], entry: "start" };

/**
 * Prompt layouts by node number, from the first image of each prompt golden: icons, counter and
 * label of the prompts the tree has no lines for, and where the entry and its cursor are.
 * `box` is a frame without a cursor (Search does not blink, P9).
 */
export const PROMPT_LAYOUTS: Readonly<Record<string, PromptLayout>> = {
  "1-1": { icons: ["pen", "abc"], entry: "box" },
  "1-3": { icons: ["pen", "abc"], counter: "16", label: ["Name:"], entry: "text", softkey: "OK" },
  "1-9": { icons: ["phone-book"], entry: "value" },
  "2-7-1-1": {
    icons: ["pen"],
    counter: "20",
    label: ["Centre number:"],
    value: "+1234567890",
    entry: "end",
    font: "small",
    softkey: "OK",
  },
  "2-7-2-1": {
    icons: ["pen"],
    counter: "30",
    label: ["Centre number:"],
    entry: "end",
    softkey: "Search",
  },
  "2-9": PEN_BOX_END,
  "6-3-4-2": PEN_BOX_END,
  "7-1-1-2": PEN_BOX_END,
  "7-2-1-2": PEN_BOX_END,
  "7-3-1-2": PEN_BOX_END,
  "7-4-1-2": PEN_BOX_END,
  "10-1": {
    icons: ["pen", "abc"],
    counter: "35",
    label: ["Remind about:"],
    entry: "text",
    softkey: "OK",
  },
  "11-1": PEN_BOX_START,
  "11-2-2": PEN_BOX_START,
  "11-3": PEN_BOX_START,
  "11-5": PEN_BOX_START,
  // The name being edited is the profile's (Silent: 10 - 6 characters left).
  "12-2-2-10": {
    icons: ["pen", "abc-lower"],
    counter: "4",
    label: ["New name:"],
    value: "Silent",
    entry: "text",
    softkey: "OK",
  },
};

/** Code prompts (security code, PIN, PIN2, barring password): the pen and the label only. */
const CODE_PROMPT: PromptLayout = { icons: ["pen"], entry: "none" };

/** The prompt layout of node `number`; code prompts share one. */
export function promptLayout(number: string, kind: string): PromptLayout | undefined {
  return PROMPT_LAYOUTS[number] ?? (kind === "code-prompt" ? CODE_PROMPT : undefined);
}

/**
 * Splits a prompt's firmware lines (D10): the label runs through the last line ending in `:`
 * (`Group` / `number:`), the rest is the value (`793000333`).
 */
export function splitPromptLines(lines: readonly string[]): {
  label: readonly string[];
  value: string;
} {
  let end = lines.length;
  while (end > 0 && !lines[end - 1]!.endsWith(":")) end--;
  return { label: lines.slice(0, end), value: lines.slice(end).join(" ") };
}

/** The level bar each game's Level shows (virgin EEPROM; Pairs II's two modes share one). */
export const LEVEL_BARS: Readonly<Record<string, string>> = {
  "8-1-2": "level/8-1",
  "8-3-2": "level/8-3",
  "8-4-1-2": "level/8-4",
  "8-4-2-2": "level/8-4",
};

/**
 * Info-page results the tree records only by kind (P15): Prepaid credit's Credit info display
 * opens an On/Off option list on its page value, Recharge status two info pages.
 */
export const PAGE_RESULTS = {
  "4-8-1": { kind: "option-list", labels: ["On", "Off"], softkey: "OK" },
  "4-8-4": {
    kind: "info-pages",
    pages: [
      { label: "Last recharge:", value: "0", softkey: "Back" },
      { label: "Expiry date:", value: "0", softkey: "Back" },
    ],
  },
} as const;

/**
 * Same-as subtrees (plan 14 S6): everything strictly below each key is the subtree below its
 * value, renumbered. Equal to the importer's table (`scripts/tree-capture-set.ts`; Task 13 test).
 */
export const SAME_AS: Readonly<Record<string, string>> = {
  "7-2": "7-1",
  "7-4": "7-1",
  "12-3-2": "12-2-2",
  "12-4-2": "12-2-2",
  "12-5-2": "12-2-2",
  "12-6-2": "12-2-2",
};

/**
 * The node whose goldens and timelines stand for `number`: below a same-as root, the model's
 * node (`12-3-2-9-1` → `12-2-2-9-1`: a long Screen saver `Done`, not the short style).
 */
export function modelNumber(number: string): string {
  for (const [copy, model] of Object.entries(SAME_AS)) {
    if (number.startsWith(`${copy}-`)) return model + number.slice(copy.length);
  }
  return number;
}

/**
 * Leaves that open the placeholder, by node pattern → owner plan (plan 14 "Leaf ownership").
 * A pattern is a menu number whose segments may be `*` (any one segment); a trailing `-**` also
 * matches the node itself and everything below. Equal to the importer's table (Task 13 test).
 */
export const PLACEHOLDER_OWNERS: Readonly<Record<string, string>> = {
  "2-1": "18", // Write messages: text editor
  "2-4": "18", // Picture messages: nothing in the virgin EEPROM
  "2-5": "18", // Templates
  "2-6": "18", // Smileys
  "2-8-4-1-**": "18", // Topics: lists of box-glyph names (virgin EEPROM)
  "2-8-4-2-**": "18",
  "2-8-4-3-**": "18",
  "2-10": "18", // Service command editor
  "3": "18", // Chat
  "5-4-*": "16", // Composer slots
  "5-9-4": "18", // Screen saver › Screen saver: nothing in the virgin EEPROM
  "12-*-2-9-4": "18",
  "6-2-1-3": "15", // Русский: native-language note, then that UI
  "6-2-1-4": "15", // Български
  "6-2-1-5": "15", // Українська
  "6-2-3": "15", // Welcome note: text editor
  "8-1-1": "23", // Snake II › New game: gameplay
  "8-2-1": "24", // Space impact › New game
  "8-3-1": "24", // Bantumi › New game
  "8-4-1-1": "24", // Pairs II › Time trial › New game
  "8-4-2-1": "24", // Pairs II › Puzzle › New game
  "9": "20", // Calculator
  "11-4": "21", // Stopwatch
  "12-*-1": "17", // Profiles › Activate
};

/** Whether menu number `number` matches a `PLACEHOLDER_OWNERS`/`SETTER_LEVELS` pattern. */
export function matchesPattern(number: string, pattern: string): boolean {
  const deep = pattern.endsWith("-**");
  const want = (deep ? pattern.slice(0, -3) : pattern).split("-");
  const have = number.split("-");
  if (deep ? have.length < want.length : have.length !== want.length) return false;
  return want.every((segment, i) => segment === "*" || segment === have[i]);
}

/** The plan that owns the placeholder at node `number`, if it is one. */
export function placeholderOwner(number: string): string | undefined {
  for (const [pattern, plan] of Object.entries(PLACEHOLDER_OWNERS)) {
    if (matchesPattern(number, pattern)) return plan;
  }
  return undefined;
}

/**
 * Submenu levels whose leaves set the level's value (no option list): the children, by slug, in
 * the setting's option order. Selecting one stores it (its note follows), the page shows its
 * label and the level opens on it (Info service opens on Off, `tree/02-messages/2-8.sub`).
 * Opening Screen saver on the stored value after On is UNVERIFIED (virgin: Off, its first child).
 */
export const SETTER_LEVELS: Readonly<Record<string, readonly string[]>> = {
  // Info service On/Off/Topic index: Topic index also sets the page value
  // (`tree/02-messages/2-8-3.leaf` image f: `Topic index`).
  "2-8": ["on", "off", "topic-index"],
  "5-9": ["off", "on"], // Tones › Screen saver
  "12-*-2-9": ["off", "on"], // Profiles › Personalise › Screen saver
};

/** The setter children (slugs) of the level at `number`, if it is a setter level. */
export function setterLevel(number: string): readonly string[] | undefined {
  for (const [pattern, slugs] of Object.entries(SETTER_LEVELS)) {
    if (matchesPattern(number, pattern)) return slugs;
  }
  return undefined;
}

/** The first-digit dots turn into the menu number 2948 ms after Menu (menu/01-phone-book.anim). */
export const STOCK_SHORTCUT_WINDOW_MS = 2948;

/**
 * Levels whose Select-entry shows their own path and the awaiting dots before the selection's
 * number, by node pattern, with how long (SubmenuOptions.entryIndicatorMs): Screen saver shows
 * `5-9-` and dots (`tree/05-tones/5-9.sub` image 01, `tree/12-profiles/12-1-2-9.sub` 01: the
 * profile's own path), and the firmware opens a digit window on that entry, so it lasts the stock
 * shortcut window (D14: ≈2.9 s; no capture runs it to its end). Keys work meanwhile (▼ shows
 * `5-9-2`, image 02; OK on Off opens its note, `5-9-1.leaf` frame 0).
 */
export const ENTRY_INDICATOR_LEVELS: readonly string[] = ["5-9", "12-*-2-9"];

/** Whether the level at `number` shows the entry indicator (`ENTRY_INDICATOR_LEVELS`). */
export function showsEntryIndicator(number: string): boolean {
  return ENTRY_INDICATOR_LEVELS.some((pattern) => matchesPattern(number, pattern));
}

/**
 * Leaves that close more than themselves (`exit({ levels })` through the flow): OK on a Call
 * divert › Set delay choice returns at once to the Call divert page, no note (P13), and View all
 * returns to the carousel (`tree/10-reminders/10-2.leaf`), both without drawing anything.
 */
export const EXIT_LEVELS: Readonly<Record<string, number>> = { "7-3-4": 2, "10-2": 2 };

/** Where a note ends beyond the screen below (`NOTE_ENDS`). */
export interface NoteEndBinding {
  readonly levels?: number;
  readonly select?: string;
  readonly row?: "top" | "bottom";
}

/**
 * Notes that end somewhere other than the screen below, by node pattern (a leaf, or an option
 * choice `<list>-<k>`): `levels` closes that many levels (the setters and Clock settings return
 * to their page: `tree/02-messages/2-8-1.leaf` image f, `tree/05-tones/5-9-2.leaf` image e,
 * `tree/11-clock/11-2-1.leaf` and `11-2-3-1.choose` image e), `select` selects a child of the
 * level returned to, on the bottom row of the window unless `row` is "top". Snake II's Top score
 * returns to New game on the bottom row (`Score IDs / Instructions / New game`, P12); Space
 * impact's and Pairs II's return to New game on the top row, the window rebuilt at it
 * (`New game / Top score / Score IDs`, `tree/08-games/8-2-2.leaf`, `8-4-1-3.leaf`, `8-4-2-3.leaf`
 * image m).
 */
export const NOTE_ENDS: Readonly<Record<string, NoteEndBinding>> = {
  "2-8-1": { levels: 2 },
  "2-8-2": { levels: 2 },
  "2-8-3": { levels: 2 },
  "5-9-1": { levels: 2 },
  "5-9-2": { levels: 2 },
  "12-*-2-9-1": { levels: 2 },
  "12-*-2-9-2": { levels: 2 },
  "11-2-1": { levels: 2 },
  "11-2-3-*": { levels: 2 },
  "8-1-4": { select: "new-game" },
  "8-2-2": { select: "new-game", row: "top" },
  "8-4-*-3": { select: "new-game", row: "top" },
};

/** How the note at node `number` ends, if not plainly back (`NOTE_ENDS`). */
export function noteEnd(number: string): NoteEndBinding | undefined {
  for (const [pattern, end] of Object.entries(NOTE_ENDS)) {
    if (matchesPattern(number, pattern)) return end;
  }
  return undefined;
}

/**
 * Children ▲/▼ select when they dismiss a note on a rows level, by node pattern (pages levels
 * get their neighbours, `LeafPlace.moves`). ▼ during Snake II's Top score returns to New game
 * and moves on to Level, which puts Level on the bottom row (`Instructions / New game / Level`,
 * `probe/games-top-score-down-2s` image m); ▲ there is UNVERIFIED and only dismisses.
 */
export const NOTE_MOVES: Readonly<
  Record<string, { readonly up?: string; readonly down?: string }>
> = { "8-1-4": { down: "level" } };

/** The note moves bound to node `number` (`NOTE_MOVES`). */
export function noteMoves(
  number: string,
): { readonly up?: string; readonly down?: string } | undefined {
  for (const [pattern, moves] of Object.entries(NOTE_MOVES)) {
    if (matchesPattern(number, pattern)) return moves;
  }
  return undefined;
}

/**
 * What confirming a query shows, by its first line, beyond the tree's record (P8): Level 5 stores
 * the choice only after OK, then `Done`; Reminders › Erase › All empties the reminder memory;
 * Club Nokia ID asks for the ID.
 */
export const QUERY_RESULTS: Readonly<
  Record<
    string,
    | { readonly kind: "note"; readonly lines: readonly string[]; readonly timeline: string }
    | { readonly kind: "prompt"; readonly lines: readonly string[]; readonly softkey: string }
  >
> = {
  "Select maximum": { kind: "note", lines: ["Done"], timeline: "level-5-done" },
  // probe/confirm-10-3-2-yes image c. The firmware then hides View all and Erase (image d), which
  // needs reminder data (plan 21).
  "Are you": {
    kind: "note",
    lines: ["Reminder", "memory", "empty"],
    timeline: "reminder-memory-empty",
  },
  // probe/confirm-8-6-4-ok image c: the prompt has no value.
  "Replace old ID?": { kind: "prompt", lines: ["Club Nokia ID:"], softkey: "OK" },
};

/** The layout of Club Nokia ID's prompt (probe/confirm-8-6-4-ok image c). */
export const CLUB_NOKIA_ID_PROMPT: PromptLayout = { icons: ["pen"], entry: "end" };

/**
 * Club Nokia ID's prompt has no recording of its own: probe/confirm-8-6-4-ok's cursor steps
 * (474, 481, 481, 479, 481, 479, 481, 482 ms) start within ±2 ms of the Closed user group number
 * prompt's (476, 480, 481, 479, 481, 480, 481, 479 ms), a prompt of the same layout.
 */
export const CLUB_NOKIA_ID_BLINK = "6-3-4-2";

/** Requesting's Quit: `Request not confirmed`, then standby (P7; C on Requesting UNVERIFIED). */
export const REQUEST_NOT_CONFIRMED = {
  lines: ["Request", "not", "confirmed"],
  timeline: "request-not-confirmed",
} as const;

/** The note digits that match no menu number open (P5); the kernel then goes to standby. */
export const INVALID_SHORTCUT = { lines: ["Invalid", "shortcut"], timeline: "invalid-shortcut" };

/**
 * The cursor blink of prompts whose own recording has none (a cursor every ≈480 ms, P9): the
 * Voice mailbox number prompt's.
 */
export const CURSOR_STYLE = "2-9";
