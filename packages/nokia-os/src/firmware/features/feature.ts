// What a stock feature contributes (one module per menu area or behaviour, features/<slug>.ts):
// the screens it implements by tree node, the leaves it leaves to a later plan's placeholder, the
// tables the generic stock widgets read (prompt layouts, note styles and ends, query results,
// ...), its settings (virgin and factory values, aliases) and its EEPROM records. `stock.ts`
// composes every feature registered in `features/index.ts`; a node or key bound twice throws.
//
// Node patterns are menu numbers whose segments may be `*` (any one segment); a trailing `-**`
// also matches the node itself and everything below (`tree.ts` `matchesPattern`). Patterns of one
// table must not overlap (tests/features.test.ts).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { StockSounder } from "../../sound/sounder";
import type { Widget } from "../../widgets/flow";
import type { ListNumbering } from "../../widgets/rows";
import type { NoteSound } from "../../widgets/note";
import type { PromptLayout } from "../../widgets/prompt";
import type { StockGames } from "../../widgets/snake";
import type { EepromRecord, StockEeprom } from "../eeprom";
import type { StockResult, StockScreenSpec } from "../generated/stock-tree";
import type { StockPorts } from "../ports";
import type { StockSecurity } from "../security";
import type { StockSettings } from "../settings";

/** One phone's state and outputs, as feature bindings see them. */
export interface StockServices {
  readonly ports: StockPorts;
  readonly settings: StockSettings;
  /** The suspended game, the seed and the cue sink (plan 23). */
  readonly games: StockGames;
  readonly security: StockSecurity;
  readonly sounder: StockSounder;
  /** Every note's warning tone goes here, by its lines (plan 16 D12). */
  readonly noteSound: NoteSound;
  /** The phone's EEPROM, for the records a feature registers (`records`, plan 15 D2). */
  readonly eeprom: StockEeprom;
}

/** The tree node a bound screen opens for. */
export interface ScreenPlace {
  /** A leaf's number, or a list's option or page (`<list>-<k>`). */
  readonly number: string;
  /** What the tree records it opening: a leaf's spec, or an option's or page's result. */
  readonly screen: StockScreenSpec | StockResult;
  /** Its setting key: a leaf's or option's list's (`settingKey`), a page's `<list>/<page slug>`. */
  readonly key: string;
  /** How an option list opened here numbers its indicator (`optionListNumbering`). */
  readonly numbering: ListNumbering;
}

/** A screen a feature implements: the first widget of the flow the node opens. */
export type ScreenBinding = (services: StockServices, place: ScreenPlace) => () => Widget;

/** An entry a feature puts at the head of a submenu level (Snake II's Continue, plan 23 D10). */
export interface LeadEntry {
  readonly slug: string;
  readonly label: string;
  /** Whether the entry is listed now; the level opens on it while it is. */
  readonly shown: (services: StockServices) => boolean;
  /** The flow it opens. */
  readonly open: (services: StockServices) => () => Widget;
}

/** What a feature adds to an option list (plan 16: key beeps and previews). */
export interface OptionListHooks {
  /** A key went down on the list; `highlighted` is the option it now highlights. */
  readonly keyDown?: (key: PhoneKey, highlighted: number | null) => void;
  /** The highlight moved to `index` (from `previous`; null when the list opened unset). */
  readonly highlight?: (index: number, previous: number | null) => void;
  /** The list closed. */
  readonly close?: () => void;
}

/** Where a note ends beyond the screen below it. */
export interface NoteEndBinding {
  /** Closes this many levels (the setters return to their page). */
  readonly levels?: number;
  /** Selects this child of the level returned to, on the bottom row unless `row` is "top". */
  readonly select?: string;
  readonly row?: "top" | "bottom";
}

/** What confirming a query shows beyond the tree's record (plan 14 P8), by its first line. */
export type QueryResult =
  | { readonly kind: "note"; readonly lines: readonly string[]; readonly timeline: string }
  | {
      readonly kind: "prompt";
      readonly lines: readonly string[];
      readonly softkey: string;
      readonly layout: PromptLayout;
      /** The widget timeline (by node) whose cursor blink the prompt plays. */
      readonly blink: string;
    };

/** A note shown by a named widget timeline: its firmware lines and timeline name. */
export interface NamedNote {
  readonly lines: readonly string[];
  readonly timeline: string;
}

/** Tables the generic stock widgets read (plan 14), by node number or pattern. */
export interface StockWidgetTables {
  /** Prompt layouts by node number, measured on each prompt golden's first image (D11). */
  readonly promptLayouts?: Readonly<Record<string, PromptLayout>>;
  /**
   * Widget timelines for notes whose node has none of its own, by note text: the node number of
   * a representative recording of the same note class (D8).
   */
  readonly noteStyles?: Readonly<Record<string, string>>;
  /** Notes that end somewhere other than the screen below, by node pattern. */
  readonly noteEnds?: Readonly<
    Record<string, NoteEndBinding | ((services: StockServices) => NoteEndBinding)>
  >;
  /** Children ▲/▼ select when they dismiss a note on a rows level, by node pattern. */
  readonly noteMoves?: Readonly<Record<string, { readonly up?: string; readonly down?: string }>>;
  /** What confirming a query shows, by the query's first line. */
  readonly queryResults?: Readonly<Record<string, QueryResult>>;
  /** What Quit on a progress note shows, by the note's text (then standby). */
  readonly progressQuits?: Readonly<Record<string, NamedNote>>;
  /** Leaves and lists whose OK closes this many levels at once, by node number. */
  readonly exitLevels?: Readonly<Record<string, number>>;
  /** Submenu levels whose leaves set the level's value, by node pattern: the children's slugs. */
  readonly setterLevels?: Readonly<Record<string, readonly string[]>>;
  /** Levels whose Select-entry shows their path and the awaiting dots (node patterns). */
  readonly entryIndicatorLevels?: readonly string[];
  /** Option lists whose indicator is not `<list path>-<k>`, by node number prefix. */
  readonly optionListNumbering?: Readonly<Record<string, "parent" | "option">>;
  /** The fixed level bar sprite each game's Level shows, by node number. */
  readonly levelBars?: Readonly<Record<string, string>>;
}

/** A virgin free-text value: a leaf screen's line (`number`, `line`), or a captured `text`. */
export type VirginText =
  | { readonly key: string; readonly number: string; readonly line: number }
  | { readonly key: string; readonly text: string };

/** A virgin number: a value, or the number on a leaf screen's line (a note that shows it). */
export type VirginNumber =
  | { readonly key: string; readonly value: number }
  | { readonly key: string; readonly number: string; readonly line: number };

/** A factory value read from a v6.39 factory scroll after a captured Restore (plan 15 D5). */
export type FactoryDefault = {
  readonly key: string;
  readonly evidence: "v6.39";
  /** The scroll image under `$REF/captures/6.39/` that shows it. */
  readonly capture: string;
} & ({ readonly label: string } | { readonly marked: readonly string[] });

/** What a feature adds to the settings store (plan 14 D9, plan 15). */
export interface StockSettingsTables {
  /** Keys under `prefix` read and write the same key under `target` (Tones → a profile's). */
  readonly aliases?: readonly { readonly prefix: string; readonly target: string }[];
  /** Pages whose value is the host's, by setting key: what the page shows. */
  readonly hostValues?: Readonly<
    Record<string, (ports: StockPorts, settings: StockSettings) => string | undefined>
  >;
  /** Virgin free-text values that are not page values. */
  readonly virginTexts?: readonly VirginText[];
  /** Numeric settings and their virgin values. */
  readonly virginNumbers?: readonly VirginNumber[];
  /** Texts the user types that have no virgin value. */
  readonly typedTexts?: readonly string[];
  /** Code-prompt leaves that store a single choice, by node number: the option labels. */
  readonly codeSettings?: Readonly<Record<string, readonly string[]>>;
  /** Texts and numbers Restore factory settings keeps (every other returns to virgin). */
  readonly restoreKeeps?: readonly string[];
  /** What Restore factory settings writes over the virgin choices and marks. */
  readonly factoryDefaults?: readonly FactoryDefault[];
}

/** One feature of the stock firmware. Every field is optional; tables merge across features. */
export interface StockFeature {
  /** The module's name, `features/<name>.ts`. */
  readonly name: string;
  /** Same-as subtrees (plan 14 S6): everything strictly below each key is its value's subtree. */
  readonly sameAs?: Readonly<Record<string, string>>;
  /** Leaves that open a later plan's placeholder, by node pattern → owner plan (D13). */
  readonly placeholders?: Readonly<Record<string, string>>;
  /** Screens this feature implements, by node number (a leaf, an option, a page). */
  readonly screens?: Readonly<Record<string, ScreenBinding>>;
  /** Entries this feature heads submenu levels with, by the level's node number. */
  readonly leads?: Readonly<Record<string, LeadEntry>>;
  /** Hooks for the option list of setting `key`, if this feature has any. */
  readonly optionLists?: (key: string, services: StockServices) => OptionListHooks | undefined;
  readonly widgets?: StockWidgetTables;
  readonly settings?: StockSettingsTables;
  /** EEPROM records this feature owns (plan 15 D2); Restore and erase see them all. */
  readonly records?: readonly EepromRecord<unknown>[];
}
