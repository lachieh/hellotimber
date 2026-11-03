// A firmware as a value (plan 32 Phase 0): the handset's own settings and records, a menu tree
// and the features bound to its nodes, composed into one table per kind of binding and the
// lookups the menu, the leaves, the painter, the settings store and the records list read. A
// node, key or text two features bind throws when the firmware is composed. `stock.ts` composes
// the v6.39 firmware; any other tree in the same node format composes the same way.
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
import type { ScreenDisplay } from "../kit/ui/display/screen-display";
import {
  WIDGET_TIMELINE_BY_NODE,
  type CarouselGraphic,
  type StockWidgetTimeline,
} from "../kit/ui/resources";
import { timelineById } from "../kit/ui/timelines";
import type { PromptLayout } from "../kit/ui/widgets/prompt";
import type { ListNumbering } from "../kit/ui/widgets/rows";
import type { StockPorts } from "./ports";
import type { StockSettings } from "./settings";

/**
 * What the phone around the menu needs whatever tree it runs (`handset.ts` `STOCK_HANDSET`): the
 * settings it reads, which a tree's option lists bind to by key (same options, same virgin
 * choice), and its EEPROM records.
 */
export interface Handset {
  readonly settings: Pick<
    StockSettingsTables,
    "choices" | "aliases" | "typedTexts" | "restoreKeeps"
  >;
  readonly records: readonly EepromRecord<unknown>[];
}

/**
 * A top-level node of a firmware's tree: a tree node that may draw its own carousel graphic
 * (otherwise the stock icon of its slug; its slug still keys its settings).
 */
export type FirmwareNode = StockTreeNode & { readonly graphic?: CarouselGraphic };

/** SIM services' carousel slot (plan 30 D5): after the tree's items, numbered `number`. */
export interface SimServicesSlot {
  /** Its menu number (v6.39: 14 in the 13th slot, Task 0 K); its level draws no menu number. */
  readonly number: number;
}

/** What a firmware is composed of: its handset, its menu tree and the features bound to it. */
export interface FirmwareSpec {
  readonly handset: Handset;
  readonly tree: readonly FirmwareNode[];
  readonly features: readonly StockFeature[];
  /**
   * Subtrees whose nodes play the stock v6.39 recordings (their widget timelines) of a stock
   * subtree, by this tree's number prefix → the stock number prefix (`"3": "8"`: 3-1-1 plays
   * 8-1-1's). The stock firmware maps every top-level node to itself; remounted features add
   * theirs (`StockFeature.models`). A node under none has no node timeline, only text styles.
   */
  readonly models?: Readonly<Record<string, string>>;
  /** SIM services' slot, shown while the SIM has a toolkit; absent: the firmware has none. */
  readonly simServices?: SimServicesSlot;
}

/**
 * The settings store's tables (plan 14 D9, plan 15), merged across a firmware's handset (first)
 * and features.
 */
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
  readonly tree: readonly FirmwareNode[];
  /** The features, sorted by name: list tables (aliases, defaults, records) join in this order. */
  readonly features: readonly StockFeature[];
  /** Same-as subtrees (plan 14 S6). */
  readonly sameAs: Readonly<Record<string, string>>;
  /** The stock subtrees whose recordings this tree's subtrees play (`FirmwareSpec.models`). */
  readonly models: Readonly<Record<string, string>>;
  /** SIM services' slot, if the firmware has one. */
  readonly simServices: SimServicesSlot | undefined;
  /** What the painter and the describer draw beyond the screen model (`firmwareDisplay`). */
  readonly display: ScreenDisplay;
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
  /** The settings store's tables (plan 14 D9, plan 15), the handset's included. */
  readonly settings: FirmwareSettingsTables;
  /**
   * The EEPROM records (plan 15 D2) besides the settings store's: the handset's, then the
   * features' in feature order.
   */
  readonly records: readonly EepromRecord<unknown>[];

  /** The path from the top level to tree node `number`; throws when there is none. */
  readonly treePath: (number: string) => StockTreeNode[];
  /** The slug of the tree node after `number` among its siblings (circular). */
  readonly nextSibling: (number: string) => string;
  /** Every tree node with its path from the top level, in tree order. */
  readonly treePaths: () => Generator<readonly StockTreeNode[]>;

  /** The plan that owns the placeholder at node `number`, if it is one. */
  readonly placeholderOwner: (number: string) => string | undefined;
  /**
   * The tree node whose bindings stand for `number`: below a same-as root, the model's node, to
   * the end of a chain (`12-3-2-9-1` → `12-2-2-9-1`).
   */
  readonly sameAsNumber: (number: string) => string;
  /**
   * The stock node whose recordings `number` plays: its same-as node under `models`
   * (`12-3-2-9-1` → `12-2-2-9-1`: a long Screen saver `Done`, not the short style); undefined
   * under no model.
   */
  readonly recordingNumber: (number: string) => string | undefined;
  /** The widget timeline of node `number`'s own recording (`recordingNumber`), if any. */
  readonly nodeTimeline: (number: string) => StockWidgetTimeline | undefined;
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
  /**
   * The widget timeline id of the note at tree node `number` with text `lines`, if any: its own
   * recording's (`recordingNumber`), else its text's style (`noteStyles`).
   */
  readonly noteTimelineId: (number: string, lines: readonly string[]) => string | undefined;
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

/** Whether `number` is `prefix` or below it, by whole segments. */
const under = (number: string, prefix: string): boolean =>
  number === prefix || number.startsWith(`${prefix}-`);

/** Throws unless every top-level node's own carousel graphic can be painted. */
function checkGraphics(tree: readonly FirmwareNode[]): void {
  for (const { number, graphic } of tree) {
    if (graphic === undefined) continue;
    if (graphic.frames.length === 0) throw new Error(`Node ${number}'s graphic has no frames.`);
    const step = graphic.timeline?.steps.find((s) => s.frame >= graphic.frames.length);
    if (step !== undefined) {
      throw new Error(
        `Node ${number}'s graphic timeline shows frame ${step.frame}, which it lacks.`,
      );
    }
  }
}

/**
 * What a firmware's screens draw beyond their models: its nodes' own carousel graphics by graphic
 * id (the node's slug, `firmwareMenu`), and SIM services' level, which draws no menu number.
 */
function firmwareDisplay(
  tree: readonly FirmwareNode[],
  simServices: SimServicesSlot | undefined,
): ScreenDisplay {
  return {
    menuIcons: Object.fromEntries(
      tree.flatMap((node) => (node.graphic === undefined ? [] : [[node.slug, node.graphic]])),
    ),
    unnumberedMenus: simServices === undefined ? [] : [simServices.number],
  };
}

/**
 * Composes `spec.features` over `spec.tree` with `spec.handset`; a node, key or text two features
 * bind throws, as does a model prefix two features map to different stock subtrees.
 */
export function composeFirmware(spec: FirmwareSpec): Firmware {
  const { tree, handset, simServices } = spec;
  const features = byName(spec.features);
  checkGraphics(tree);

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
  const models: Record<string, string> = { ...spec.models };
  for (const feature of features) {
    for (const [prefix, model] of Object.entries(feature.models ?? {})) {
      if (models[prefix] !== undefined && models[prefix] !== model) {
        throw new Error(
          `${feature.name} maps ${prefix} to stock ${model}, not ${models[prefix]} as composed.`,
        );
      }
      models[prefix] = model;
    }
  }
  /** Longest prefix first, so a deeper mapping wins. */
  const modelPrefixes = Object.keys(models).sort((a, b) => b.length - a.length);
  const sameAsNumber = (number: string): string => {
    let at = number;
    for (let hops = 0; hops <= Object.keys(sameAs).length; hops++) {
      const copy = Object.keys(sameAs).find((root) => at.startsWith(`${root}-`));
      if (copy === undefined) return at;
      at = sameAs[copy]! + at.slice(copy.length);
    }
    throw new Error(`Same-as subtrees loop at ${number}.`);
  };
  const recordingNumber = (number: string): string | undefined => {
    const at = sameAsNumber(number);
    const prefix = modelPrefixes.find((p) => under(at, p));
    return prefix === undefined ? undefined : models[prefix] + at.slice(prefix.length);
  };
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

  const own = handset.settings;
  const settings: FirmwareSettingsTables = {
    choices: [...(own.choices ?? []), ...joined((f) => f.settings?.choices)],
    aliases: [...(own.aliases ?? []), ...joined((f) => f.settings?.aliases)],
    hostValues: settingsTable("Host value", "hostValues"),
    virginTexts: joined((f) => f.settings?.virginTexts),
    virginNumbers: joined((f) => f.settings?.virginNumbers),
    typedTexts: [...(own.typedTexts ?? []), ...joined((f) => f.settings?.typedTexts)],
    codeSettings: settingsTable("Code setting", "codeSettings"),
    restoreKeeps: [...(own.restoreKeeps ?? []), ...joined((f) => f.settings?.restoreKeeps)],
    factoryDefaults: joined((f) => f.settings?.factoryDefaults),
    factoryTexts: joined((f) => f.settings?.factoryTexts),
  };

  const aliasPrefix = (target: AliasTarget, choice: (key: string) => number | null): string =>
    typeof target === "string" ? target : target(choice);

  return {
    tree,
    features,
    sameAs,
    models,
    simServices,
    display: firmwareDisplay(tree, simServices),
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
    records: [...handset.records, ...joined((f) => f.records)],

    treePath: (number) => treePath(tree, number),
    nextSibling: (number) => nextSibling(tree, number),
    treePaths: () => treePaths(tree),

    placeholderOwner: (number) => byPattern(placeholders, number),
    sameAsNumber,
    recordingNumber,
    nodeTimeline(number) {
      const recording = recordingNumber(number);
      const id = recording === undefined ? undefined : WIDGET_TIMELINE_BY_NODE[recording];
      return id === undefined ? undefined : timelineById(id, `node ${number}`);
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
    noteTimelineId(number, lines) {
      const recording = recordingNumber(number);
      const own = recording === undefined ? undefined : WIDGET_TIMELINE_BY_NODE[recording];
      return own ?? noteStyles[lines.join(" ")];
    },
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
