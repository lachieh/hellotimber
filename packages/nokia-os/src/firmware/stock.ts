// The stock firmware's features composed (features/index.ts): one table per kind of binding,
// and the lookups the menu, the leaves and the settings store use. A node, key or text two
// features bind throws here, when the module loads.
import * as FEATURES from "./features/index";
import type {
  AliasTarget,
  FactoryDefault,
  FactoryText,
  LeadEntry,
  LevelBinding,
  NoteEndBinding,
  OptionListHooks,
  ScreenBinding,
  StockFeature,
  StockServices,
  StockSettingsTables,
  StockWidgetTables,
  VirginNumber,
  VirginText,
} from "./features/feature";
import type { EepromRecord } from "./eeprom";
import { byPattern, matchesPattern } from "./tree";
import type { PromptLayout } from "../widgets/prompt";
import type { ListNumbering } from "../widgets/rows";

/**
 * Every registered feature, by name: module namespaces list their exports in a different order
 * in different module systems, so tables that are lists (aliases, factory defaults, records)
 * concatenate in this order.
 */
const registered: StockFeature[] = Object.values(FEATURES);
export const STOCK_FEATURES: readonly StockFeature[] = registered.sort((a, b) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
);

/** The union of one table from every feature; a key two features define throws. */
function merged<T>(
  what: string,
  table: (feature: StockFeature) => Readonly<Record<string, T>> | undefined,
): Readonly<Record<string, T>> {
  const out: Record<string, T> = {};
  const owner: Record<string, string> = {};
  for (const feature of STOCK_FEATURES) {
    for (const [key, value] of Object.entries(table(feature) ?? {})) {
      if (key in out) {
        throw new Error(`${what} "${key}" is bound by both ${owner[key]} and ${feature.name}.`);
      }
      out[key] = value;
      owner[key] = feature.name;
    }
  }
  return out;
}

/** Every feature's list, concatenated in feature order. */
function joined<T>(list: (feature: StockFeature) => readonly T[] | undefined): readonly T[] {
  return STOCK_FEATURES.flatMap((feature) => list(feature) ?? []);
}

const widgets = <K extends keyof StockWidgetTables>(
  what: string,
  key: K,
): NonNullable<StockWidgetTables[K]> =>
  merged(what, (f) => f.widgets?.[key] as Readonly<Record<string, unknown>> | undefined) as never;

const settings = <K extends keyof StockSettingsTables>(
  what: string,
  key: K,
): NonNullable<StockSettingsTables[K]> =>
  merged(what, (f) => f.settings?.[key] as Readonly<Record<string, unknown>> | undefined) as never;

/** Same-as subtrees (plan 14 S6). Equal to the importer's table (coverage guard). */
export const SAME_AS: Readonly<Record<string, string>> = merged("Same-as subtree", (f) => f.sameAs);

/** Leaves that open a later plan's placeholder. Equal to the importer's table (coverage guard). */
export const PLACEHOLDER_OWNERS: Readonly<Record<string, string>> = merged(
  "Placeholder",
  (f) => f.placeholders,
);

/** Screens implemented by a feature, by node number. */
export const SCREENS: Readonly<Record<string, ScreenBinding>> = merged("Screen", (f) => f.screens);

/** Entries heading submenu levels, by the level's node number. */
export const LEADS: Readonly<Record<string, LeadEntry>> = merged("Lead entry", (f) => f.leads);

/** Labels and openings of submenu levels, by the level's node number (plan 17). */
export const LEVELS: Readonly<Record<string, LevelBinding>> = merged("Level", (f) => f.levels);

export const PROMPT_LAYOUTS: Readonly<Record<string, PromptLayout>> = widgets(
  "Prompt layout",
  "promptLayouts",
);
export const NOTE_STYLES: Readonly<Record<string, string>> = widgets("Note style", "noteStyles");
const NOTE_ENDS = widgets("Note end", "noteEnds");
const NOTE_MOVES = widgets("Note moves", "noteMoves");
export const QUERY_RESULTS = widgets("Query result", "queryResults");
export const PROGRESS_QUITS = widgets("Progress quit", "progressQuits");
export const EXIT_LEVELS: Readonly<Record<string, number>> = widgets("Exit level", "exitLevels");
const SETTER_LEVELS = widgets("Setter level", "setterLevels");
const OPTION_LIST_NUMBERING = widgets("Option list numbering", "optionListNumbering");
export const LEVEL_BARS: Readonly<Record<string, string>> = widgets("Level bars", "levelBars");
const ENTRY_INDICATOR_LEVELS: readonly string[] = joined((f) => f.widgets?.entryIndicatorLevels);

/** The settings store's tables (plan 14 D9, plan 15). */
export const STOCK_SETTINGS = {
  aliases: joined((f) => f.settings?.aliases),
  choices: joined((f) => f.settings?.choices),
  hostValues: settings("Host value", "hostValues"),
  virginTexts: joined<VirginText>((f) => f.settings?.virginTexts),
  virginNumbers: joined<VirginNumber>((f) => f.settings?.virginNumbers),
  typedTexts: joined((f) => f.settings?.typedTexts),
  codeSettings: settings("Code setting", "codeSettings"),
  restoreKeeps: joined((f) => f.settings?.restoreKeeps),
  factoryDefaults: joined<FactoryDefault>((f) => f.settings?.factoryDefaults),
  factoryTexts: joined<FactoryText>((f) => f.settings?.factoryTexts),
} as const;

/** The features' EEPROM records (plan 15 D2), in feature order. */
export const FEATURE_RECORDS: readonly EepromRecord<unknown>[] = joined((f) => f.records);

/** The plan that owns the placeholder at node `number`, if it is one. */
export function placeholderOwner(number: string): string | undefined {
  return byPattern(PLACEHOLDER_OWNERS, number);
}

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

/** The setter children (slugs) of the level at `number`, if it is a setter level. */
export function setterLevel(number: string): readonly string[] | undefined {
  return byPattern(SETTER_LEVELS, number);
}

/** Whether the level at `number` shows the entry indicator. */
export function showsEntryIndicator(number: string): boolean {
  return ENTRY_INDICATOR_LEVELS.some((pattern) => matchesPattern(number, pattern));
}

/** How the note at node `number` ends, if not plainly back. */
export function noteEnd(
  number: string,
): NoteEndBinding | ((services: StockServices) => NoteEndBinding) | undefined {
  return byPattern(NOTE_ENDS, number);
}

/** The note moves bound to node `number`. */
export function noteMoves(
  number: string,
): { readonly up?: string; readonly down?: string } | undefined {
  return byPattern(NOTE_MOVES, number);
}

/** How the option list at tree node `number` numbers its indicator. */
export function optionListNumbering(number: string): ListNumbering {
  return (
    Object.entries(OPTION_LIST_NUMBERING).find(([prefix]) => number.startsWith(prefix))?.[1] ??
    "path"
  );
}

/** Code prompts (security code, PIN, PIN2, barring password): the pen and the label only. */
const CODE_PROMPT: PromptLayout = { icons: ["pen"], entry: "none" };

/** The prompt layout of node `number`; code prompts share one. */
export function promptLayout(number: string, kind: string): PromptLayout | undefined {
  return PROMPT_LAYOUTS[number] ?? (kind === "code-prompt" ? CODE_PROMPT : undefined);
}

/** The widget timeline id of the note at tree node `number` with text `lines`, if any. */
export function noteTimelineId(
  byNode: Readonly<Record<string, string>>,
  number: string,
  lines: readonly string[],
): string | undefined {
  return byNode[number] ?? NOTE_STYLES[lines.join(" ")];
}

/** The note lines a numeric setting shows, by node number: line `line` is its value. */
export function numberLine(
  number: string,
): { readonly key: string; readonly line: number } | undefined {
  for (const entry of STOCK_SETTINGS.virginNumbers) {
    if ("number" in entry && entry.number === number) return { key: entry.key, line: entry.line };
  }
  return undefined;
}

/**
 * The key `key` shares by the settings aliases, else itself; a target that follows a stored
 * choice reads it through `choice` (default: every choice unset, the virgin state: Tones are
 * General's). The virgin settings alias a key only when that target exists (Composer has no
 * Personalise counterpart).
 */
export function settingAlias(
  key: string,
  choice: (key: string) => number | null = () => null,
): string {
  for (const { prefix, target } of STOCK_SETTINGS.aliases) {
    if (key.startsWith(prefix)) return aliasPrefix(target, choice) + key.slice(prefix.length);
  }
  return key;
}

function aliasPrefix(target: AliasTarget, choice: (key: string) => number | null): string {
  return typeof target === "string" ? target : target(choice);
}

/** The features' hooks for the option list of setting `key`; at most one feature has any. */
export function optionListHooks(key: string, services: StockServices): OptionListHooks {
  const hooks = STOCK_FEATURES.flatMap((feature) => {
    const found = feature.optionLists?.(key, services);
    return found === undefined ? [] : [{ feature: feature.name, found }];
  });
  if (hooks.length > 1) {
    throw new Error(`Option list "${key}" is hooked by ${hooks.map((h) => h.feature).join(", ")}.`);
  }
  return hooks[0]?.found ?? {};
}
