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
