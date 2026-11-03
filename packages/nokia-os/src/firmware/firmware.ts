// A firmware as a value (plan 32 Phase 0): a menu tree and the features bound to its nodes,
// composed into one table per kind of binding and the lookups the menu, the leaves, the settings
// store and the records list read. A node, key or text two features bind throws when the
// firmware is composed. `stock.ts` composes the v6.39 firmware; any other tree in the same node
// format composes the same way.
import type {
  AliasTarget,
  FactoryDefault,
  FactoryText,
  LeadEntry,
  LevelBinding,
  NamedNote,
  NoteEndBinding,
  OptionListHooks,
  QueryResult,
  ScreenBinding,
  StockFeature,
  StockServices,
  StockSettingsTables,
  StockWidgetTables,
  VirginChoice,
  VirginNumber,
  VirginText,
} from "./features/feature";
import type { EepromRecord } from "../services/storage";
import type { StockTreeNode } from "./generated/stock-tree";
import { byPattern, matchesPattern, nextSibling, treePath, treePaths } from "./tree";
import type { PromptLayout } from "../kit/ui/widgets/prompt";
import type { ListNumbering } from "../kit/ui/widgets/rows";
import type { StockPorts } from "./ports";
import type { StockSettings } from "./settings";

/** What a firmware is composed of: its menu tree and the features bound to its node numbers. */
export interface FirmwareSpec {
  readonly tree: readonly StockTreeNode[];
  readonly features: readonly StockFeature[];
}

/** The settings store's tables (plan 14 D9, plan 15), merged across a firmware's features. */
export interface FirmwareSettingsTables {
  readonly choices: readonly VirginChoice[];
  readonly aliases: readonly { readonly prefix: string; readonly target: AliasTarget }[];
  readonly hostValues: Readonly<
    Record<string, (ports: StockPorts, settings: StockSettings) => string | undefined>
  >;
  readonly virginTexts: readonly VirginText[];
  readonly virginNumbers: readonly VirginNumber[];
  readonly typedTexts: readonly string[];
  readonly codeSettings: Readonly<Record<string, readonly string[]>>;
  readonly restoreKeeps: readonly string[];
  readonly factoryDefaults: readonly FactoryDefault[];
  readonly factoryTexts: readonly FactoryText[];
}

/** One composed firmware: its tree, its features' merged tables and the lookups over them. */
export interface Firmware {
  readonly tree: readonly StockTreeNode[];
  /** The features, sorted by name: list tables (aliases, defaults, records) join in this order. */
  readonly features: readonly StockFeature[];
  /** Same-as subtrees (plan 14 S6). */
  readonly sameAs: Readonly<Record<string, string>>;
  /** Leaves that open a later plan's placeholder, by node pattern → owner plan. */
  readonly placeholders: Readonly<Record<string, string>>;
  /** Screens implemented by a feature, by node number. */
  readonly screens: Readonly<Record<string, ScreenBinding>>;
  /** Plan 21: bound leaves that exit at once while their condition holds, by node number. */
  readonly exitsWhen: Readonly<Record<string, (services: StockServices) => boolean>>;
  /** Entries heading submenu levels, by the level's node number. */
  readonly leads: Readonly<Record<string, LeadEntry>>;
  /** Labels and openings of submenu levels, by the level's node number (plan 17). */
  readonly levels: Readonly<Record<string, LevelBinding>>;
  readonly promptLayouts: Readonly<Record<string, PromptLayout>>;
  readonly noteStyles: Readonly<Record<string, string>>;
  readonly queryResults: Readonly<Record<string, QueryResult>>;
  readonly progressQuits: Readonly<Record<string, NamedNote>>;
  readonly exitLevels: Readonly<Record<string, number>>;
  readonly levelBars: Readonly<Record<string, string>>;
  /** The settings store's tables (plan 14 D9, plan 15). */
  readonly settings: FirmwareSettingsTables;
  /** The features' EEPROM records (plan 15 D2), in feature order. */
  readonly featureRecords: readonly EepromRecord<unknown>[];

  /** The path from the top level to tree node `number`; throws when there is none. */
  readonly treePath: (number: string) => StockTreeNode[];
  /** The slug of the tree node after `number` among its siblings (circular). */
  readonly nextSibling: (number: string) => string;
  /** Every tree node with its path from the top level, in tree order. */
  readonly treePaths: () => Generator<readonly StockTreeNode[]>;

  /** The plan that owns the placeholder at node `number`, if it is one. */
  readonly placeholderOwner: (number: string) => string | undefined;
  /**
   * The node whose goldens and timelines stand for `number`: below a same-as root, the model's
   * node (`12-3-2-9-1` → `12-2-2-9-1`: a long Screen saver `Done`, not the short style).
   */
  readonly modelNumber: (number: string) => string;
  /** The setter children (slugs) of the level at `number`, if it is a setter level. */
  readonly setterLevel: (number: string) => readonly string[] | undefined;
  /** Whether the level at `number` shows the entry indicator. */
  readonly showsEntryIndicator: (number: string) => boolean;
  /** How the note at node `number` ends, if not plainly back. */
  readonly noteEnd: (
    number: string,
  ) => NoteEndBinding | ((services: StockServices) => NoteEndBinding) | undefined;
  /** The note moves bound to node `number`. */
  readonly noteMoves: (
    number: string,
  ) => { readonly up?: string; readonly down?: string } | undefined;
  /** How the option list at tree node `number` numbers its indicator. */
  readonly optionListNumbering: (number: string) => ListNumbering;
  /** The prompt layout of node `number`; code prompts share one. */
  readonly promptLayout: (number: string, kind: string) => PromptLayout | undefined;
  /** The widget timeline id of the note at tree node `number` with text `lines`, if any. */
  readonly noteTimelineId: (
    byNode: Readonly<Record<string, string>>,
    number: string,
    lines: readonly string[],
  ) => string | undefined;
  /** The note lines a numeric setting shows, by node number: line `line` is its value. */
  readonly numberLine: (
    number: string,
  ) => { readonly key: string; readonly line: number } | undefined;
  /**
   * The key `key` shares by the settings aliases, else itself; a target that follows a stored
   * choice reads it through `choice` (default: every choice unset, the virgin state: Tones are
   * General's). The virgin settings alias a key only when that target exists (Composer has no
   * Personalise counterpart).
   */
  readonly settingAlias: (key: string, choice?: (key: string) => number | null) => string;
  /** The features' hooks for the option list of setting `key`; at most one feature has any. */
  readonly optionListHooks: (key: string, services: StockServices) => OptionListHooks;
}

/** Code prompts (security code, PIN, PIN2, barring password): the pen and the label only. */
const CODE_PROMPT: PromptLayout = { icons: ["pen"], entry: "none" };

/** `features` sorted by name: module namespaces list their exports in different orders. */
export function byName(features: readonly StockFeature[]): readonly StockFeature[] {
  return [...features].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Composes `spec.features` over `spec.tree`; a node, key or text two features bind throws. */
export function composeFirmware(spec: FirmwareSpec): Firmware {
  const { tree } = spec;
  const features = byName(spec.features);

  /** The union of one table from every feature; a key two features define throws. */
  function merged<T>(
    what: string,
    table: (feature: StockFeature) => Readonly<Record<string, T>> | undefined,
  ): Readonly<Record<string, T>> {
    const out: Record<string, T> = {};
    const owner: Record<string, string> = {};
    for (const feature of features) {
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
  const joined = <T>(list: (feature: StockFeature) => readonly T[] | undefined): readonly T[] =>
    features.flatMap((feature) => list(feature) ?? []);

  const widgets = <K extends keyof StockWidgetTables>(
    what: string,
    key: K,
  ): NonNullable<StockWidgetTables[K]> =>
    merged(what, (f) => f.widgets?.[key] as Readonly<Record<string, unknown>> | undefined) as never;

  const settingsTable = <K extends keyof StockSettingsTables>(
    what: string,
    key: K,
  ): NonNullable<StockSettingsTables[K]> =>
    merged(
      what,
      (f) => f.settings?.[key] as Readonly<Record<string, unknown>> | undefined,
    ) as never;

  const sameAs = merged("Same-as subtree", (f) => f.sameAs);
  const placeholders = merged("Placeholder", (f) => f.placeholders);
  const screens = merged("Screen", (f) => f.screens);
  const exitsWhen = merged("Exits when", (f) => f.exitsWhen);
  const leads = merged("Lead entry", (f) => f.leads);
  const levels = merged("Level", (f) => f.levels);
  const promptLayouts = widgets("Prompt layout", "promptLayouts");
  const noteStyles = widgets("Note style", "noteStyles");
  const noteEnds = widgets("Note end", "noteEnds");
  const noteMoves = widgets("Note moves", "noteMoves");
  const queryResults = widgets("Query result", "queryResults");
  const progressQuits = widgets("Progress quit", "progressQuits");
  const exitLevels = widgets("Exit level", "exitLevels");
  const setterLevels = widgets("Setter level", "setterLevels");
  const optionListNumbering = widgets("Option list numbering", "optionListNumbering");
  const levelBars = widgets("Level bars", "levelBars");
  const entryIndicatorLevels = joined((f) => f.widgets?.entryIndicatorLevels);

  const settings: FirmwareSettingsTables = {
    choices: joined((f) => f.settings?.choices),
    aliases: joined((f) => f.settings?.aliases),
    hostValues: settingsTable("Host value", "hostValues"),
    virginTexts: joined((f) => f.settings?.virginTexts),
    virginNumbers: joined((f) => f.settings?.virginNumbers),
    typedTexts: joined((f) => f.settings?.typedTexts),
    codeSettings: settingsTable("Code setting", "codeSettings"),
    restoreKeeps: joined((f) => f.settings?.restoreKeeps),
    factoryDefaults: joined((f) => f.settings?.factoryDefaults),
    factoryTexts: joined((f) => f.settings?.factoryTexts),
  };

  const aliasPrefix = (target: AliasTarget, choice: (key: string) => number | null): string =>
    typeof target === "string" ? target : target(choice);

  return {
    tree,
    features,
    sameAs,
    placeholders,
    screens,
    exitsWhen,
    leads,
    levels,
    promptLayouts,
    noteStyles,
    queryResults,
    progressQuits,
    exitLevels,
    levelBars,
    settings,
    featureRecords: joined((f) => f.records),

    treePath: (number) => treePath(tree, number),
    nextSibling: (number) => nextSibling(tree, number),
    treePaths: () => treePaths(tree),

    placeholderOwner: (number) => byPattern(placeholders, number),
    modelNumber(number) {
      for (const [copy, model] of Object.entries(sameAs)) {
        if (number.startsWith(`${copy}-`)) return model + number.slice(copy.length);
      }
      return number;
    },
    setterLevel: (number) => byPattern(setterLevels, number),
    showsEntryIndicator: (number) =>
      entryIndicatorLevels.some((pattern) => matchesPattern(number, pattern)),
    noteEnd: (number) => byPattern(noteEnds, number),
    noteMoves: (number) => byPattern(noteMoves, number),
    optionListNumbering: (number) =>
      Object.entries(optionListNumbering).find(([prefix]) => number.startsWith(prefix))?.[1] ??
      "path",
    promptLayout: (number, kind) =>
      promptLayouts[number] ?? (kind === "code-prompt" ? CODE_PROMPT : undefined),
    noteTimelineId: (byNode, number, lines) => byNode[number] ?? noteStyles[lines.join(" ")],
    numberLine(number) {
      for (const entry of settings.virginNumbers) {
        if ("number" in entry && entry.number === number) {
          return { key: entry.key, line: entry.line };
        }
      }
      return undefined;
    },
    settingAlias(key, choice = () => null) {
      for (const { prefix, target } of settings.aliases) {
        if (key.startsWith(prefix)) return aliasPrefix(target, choice) + key.slice(prefix.length);
      }
      return key;
    },
    optionListHooks(key, services) {
      const hooks = features.flatMap((feature) => {
        const found = feature.optionLists?.(key, services);
        return found === undefined ? [] : [{ feature: feature.name, found }];
      });
      if (hooks.length > 1) {
        throw new Error(
          `Option list "${key}" is hooked by ${hooks.map((h) => h.feature).join(", ")}.`,
        );
      }
      return hooks[0]?.found ?? {};
    },
  };
}
