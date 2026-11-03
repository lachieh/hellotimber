// Moving a feature to another place in a menu tree (plan 32 Phase 0): a stock feature binds
// absolute v6.39 node numbers ("3" Chat, "8-1-1" Snake II's New game); another firmware's tree
// may put the same area elsewhere. `remountFeature` rewrites every node-number key, pattern and
// value of a feature from one subtree to another. Setting keys (slug paths), note texts and
// widget timeline ids (which name the stock recordings) stay as they are.
import type { StockFeature, StockSettingsTables, StockWidgetTables } from "./features/feature";

/**
 * A copy of `feature` whose node numbers and patterns at or below `fromPrefix` sit at or below
 * `toPrefix` instead ("8" → "3": `8-1-1` → `3-1-1`, `8-*` → `3-*`, `8` → `3`; `18-1` stays).
 * A match is by whole segments. Others stay as they are. A pattern that could match the prefix
 * only through a `*` in its leading segments throws: it cannot be moved exactly.
 */
export function remountFeature(
  feature: StockFeature,
  fromPrefix: string,
  toPrefix: string,
): StockFeature {
  const want = fromPrefix.split("-");
  /** Whether `pattern` reaches into the prefix's subtree only through wildcards. */
  const wild = (pattern: string): boolean => {
    const have = pattern.split("-");
    for (const [i, segment] of want.entries()) {
      const at = have[i];
      if (at === "**") return true;
      if (at === undefined || (at !== "*" && at !== segment)) return false;
    }
    return true;
  };
  const move = (number: string): string => {
    if (number === fromPrefix || number.startsWith(`${fromPrefix}-`)) {
      return toPrefix + number.slice(fromPrefix.length);
    }
    if (wild(number)) {
      throw new Error(
        `${feature.name}: pattern "${number}" cannot be remounted from "${fromPrefix}".`,
      );
    }
    return number;
  };
  const keys = <T>(
    table: Readonly<Record<string, T>> | undefined,
  ): Readonly<Record<string, T>> | undefined =>
    table === undefined
      ? undefined
      : Object.fromEntries(Object.entries(table).map(([key, value]) => [move(key), value]));

  const { sameAs, placeholders, screens, leads, levels, exitsWhen, widgets, settings } = feature;
  const out: Record<string, unknown> = { ...feature };
  const set = (name: keyof StockFeature, value: unknown): void => {
    if (value !== undefined) out[name] = value;
  };
  set(
    "sameAs",
    sameAs === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(sameAs).map(([copy, model]) => [move(copy), move(model)]),
        ),
  );
  set("placeholders", keys(placeholders));
  set("screens", keys(screens));
  set("leads", keys(leads));
  set("levels", keys(levels));
  set("exitsWhen", keys(exitsWhen));
  set("widgets", widgets === undefined ? undefined : remountWidgets(widgets, move, keys));
  set("settings", settings === undefined ? undefined : remountSettings(settings, move, keys));
  return out as unknown as StockFeature;
}

type Keys = <T>(
  table: Readonly<Record<string, T>> | undefined,
) => Readonly<Record<string, T>> | undefined;

/** The widget tables keyed by node number or pattern; `noteStyles`, `queryResults` and
 * `progressQuits` are keyed by text and name stock recordings, so they stay. */
function remountWidgets(
  widgets: StockWidgetTables,
  move: (number: string) => string,
  keys: Keys,
): StockWidgetTables {
  const out: Record<string, unknown> = { ...widgets };
  const tables = [
    "promptLayouts",
    "noteEnds",
    "noteMoves",
    "exitLevels",
    "setterLevels",
    "optionListNumbering",
    "levelBars",
  ] as const;
  for (const name of tables) {
    const table = widgets[name] as Readonly<Record<string, unknown>> | undefined;
    if (table !== undefined) out[name] = keys(table);
  }
  if (widgets.entryIndicatorLevels !== undefined) {
    out.entryIndicatorLevels = widgets.entryIndicatorLevels.map(move);
  }
  return out as StockWidgetTables;
}

/** The settings tables keyed by node number (`codeSettings`, a virgin value's `number`). */
function remountSettings(
  settings: StockSettingsTables,
  move: (number: string) => string,
  keys: Keys,
): StockSettingsTables {
  const out: Record<string, unknown> = { ...settings };
  if (settings.codeSettings !== undefined) out.codeSettings = keys(settings.codeSettings);
  if (settings.virginTexts !== undefined) {
    out.virginTexts = settings.virginTexts.map((entry) =>
      "number" in entry ? { ...entry, number: move(entry.number) } : entry,
    );
  }
  if (settings.virginNumbers !== undefined) {
    out.virginNumbers = settings.virginNumbers.map((entry) =>
      "number" in entry ? { ...entry, number: move(entry.number) } : entry,
    );
  }
  return out as StockSettingsTables;
}
