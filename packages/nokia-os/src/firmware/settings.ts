// The stock settings store (plan 14 D9, plan 15 D3): the captured virgin EEPROM (plan 14 D10)
// with the phone's writes on top, persisted as one EEPROM record (`SETTINGS_RECORD`), and the
// factory state Restore factory settings writes (plan 15 D5).
import type { EepromRecord, StockEeprom } from "./eeprom";
import type { StockTreeNode } from "./generated/stock-tree";
import { setterLevel, settingAlias, STOCK_SETTINGS } from "./stock";
import { settingKey, slugOf, treePaths } from "./tree";

const { codeSettings, factoryDefaults, hostValues, restoreKeeps, typedTexts } = STOCK_SETTINGS;

export interface StockSettings {
  /** Chosen option index of a single-choice setting; null = never written (virgin EEPROM). */
  choice(key: string): number | null;
  choose(key: string, index: number): void;
  /** Multi-select marks, one per option. */
  marks(key: string): readonly boolean[];
  toggle(key: string, index: number): void;
  /**
   * Free-text values shown on pages and screens (virgin snapshot, e.g. "+1234567890"). A key's
   * text is its display value until the key's first choice or toggle replaces it (D9).
   */
  text(key: string): string | undefined;
  /** Writes (or, with undefined, clears) a typed text: the welcome note, a profile name. */
  setText(key: string, text: string | undefined): void;
  /** The chosen option's label of a single-choice setting (`"Level 2"`), if chosen. */
  label(key: string): string | undefined;
  /**
   * Restore factory settings (D5): every EEPROM record with a `factory` takes it, this store's
   * included (the security record and later plans' data are kept).
   */
  restoreFactory(): void;
  /** A numeric value (plan 23 D9: Snake II's level and top score). */
  number(key: string): number;
  setNumber(key: string, value: number): void;
}

export interface StockSettingsSnapshot {
  /** Single-choice settings: the option count and the chosen index (null = never written). */
  readonly choices: Readonly<
    Record<string, { readonly options: number; readonly chosen: number | null }>
  >;
  readonly marks: Readonly<Record<string, readonly boolean[]>>;
  readonly texts: Readonly<Record<string, string>>;
  /** Numeric values: non-negative integers. */
  readonly numbers: Readonly<Record<string, number>>;
  /** Keys that read and write another key (D9: Tones are the General profile's). */
  readonly aliases: Readonly<Record<string, string>>;
}

/**
 * What the settings record stores (D3): the writes since the virgin EEPROM, by stored key (an
 * aliased key under its target). A text of `null` clears a virgin text.
 */
export interface SettingsOverrides {
  readonly choices: Readonly<Record<string, number>>;
  readonly marks: Readonly<Record<string, readonly boolean[]>>;
  readonly texts: Readonly<Record<string, string | null>>;
  readonly numbers: Readonly<Record<string, number>>;
}

type MutableOverrides = {
  -readonly [K in keyof SettingsOverrides]: Record<string, SettingsOverrides[K][string]>;
};

const NO_OVERRIDES: SettingsOverrides = { choices: {}, marks: {}, texts: {}, numbers: {} };

function copyOverrides(overrides: SettingsOverrides): MutableOverrides {
  return {
    choices: { ...overrides.choices },
    marks: Object.fromEntries(Object.entries(overrides.marks).map(([k, v]) => [k, [...v]])),
    texts: { ...overrides.texts },
    numbers: { ...overrides.numbers },
  };
}

/**
 * A store over `initial` with `stored` applied (a key's choice or marks remove its virgin text,
 * D9), calling `save` with the overrides after every write. Restore factory settings replaces
 * the overrides with `restore(current)` (D5).
 */
function settingsOver(
  initial: StockSettingsSnapshot,
  stored: SettingsOverrides,
  save: (overrides: SettingsOverrides) => void,
  restore: (current: SettingsOverrides) => SettingsOverrides,
): StockSettings {
  let overrides = copyOverrides(NO_OVERRIDES);
  let choices = new Map<string, { options: number; chosen: number | null }>();
  let marks = new Map<string, boolean[]>();
  let texts = new Map<string, string>();
  let numbers = new Map<string, number>();
  const load = (from: SettingsOverrides): void => {
    overrides = copyOverrides(from);
    choices = new Map(Object.entries(initial.choices).map(([key, value]) => [key, { ...value }]));
    marks = new Map(Object.entries(initial.marks).map(([key, value]) => [key, [...value]]));
    texts = new Map(Object.entries(initial.texts));
    numbers = new Map(Object.entries(initial.numbers));
    for (const [key, index] of Object.entries(overrides.choices)) {
      const setting = choices.get(key);
      if (setting !== undefined) setting.chosen = index;
      texts.delete(key);
    }
    for (const [key, value] of Object.entries(overrides.marks)) {
      if (marks.has(key)) marks.set(key, [...value]);
      texts.delete(key);
    }
    for (const [key, value] of Object.entries(overrides.texts)) {
      if (value === null) texts.delete(key);
      else texts.set(key, value);
    }
    for (const [key, value] of Object.entries(overrides.numbers)) numbers.set(key, value);
  };
  load(stored);

  const resolve = (key: string): string => initial.aliases[key] ?? key;
  const single = (key: string): { options: number; chosen: number | null } => {
    const found = choices.get(resolve(key));
    if (!found) throw new Error(`No single-choice setting "${key}".`);
    return found;
  };
  const multi = (key: string): boolean[] => {
    const found = marks.get(resolve(key));
    if (!found) throw new Error(`No multi-select setting "${key}".`);
    return found;
  };
  const numeric = (key: string): string => {
    if (!numbers.has(resolve(key))) throw new Error(`No numeric setting "${key}".`);
    return resolve(key);
  };
  const check = (key: string, options: number, index: number): void => {
    if (!Number.isInteger(index) || index < 0 || index >= options) {
      throw new Error(`Setting "${key}" has ${options} options; got index ${index}.`);
    }
  };
  /** A choice or marks replace the key's text: its virgin display text and any written one. */
  const replaceText = (stored: string): void => {
    texts.delete(stored);
    delete overrides.texts[stored];
  };
  return {
    choice: (key) => single(key).chosen,
    choose(key, index) {
      const setting = single(key);
      check(key, setting.options, index);
      setting.chosen = index;
      replaceText(resolve(key));
      overrides.choices[resolve(key)] = index;
      save(overrides);
    },
    marks: (key) => [...multi(key)],
    toggle(key, index) {
      const setting = multi(key);
      check(key, setting.length, index);
      setting[index] = !setting[index];
      replaceText(resolve(key));
      overrides.marks[resolve(key)] = [...setting];
      save(overrides);
    },
    text: (key) => texts.get(resolve(key)),
    setText(key, text) {
      const stored = resolve(key);
      if (!(stored in initial.texts) && !typedTexts.includes(stored)) {
        throw new Error(`No text setting "${key}".`);
      }
      if (text === undefined) texts.delete(stored);
      else texts.set(stored, text);
      if (text !== undefined) overrides.texts[stored] = text;
      else if (stored in initial.texts) overrides.texts[stored] = null;
      else delete overrides.texts[stored];
      save(overrides);
    },
    label(key) {
      const chosen = single(key).chosen;
      return chosen === null ? undefined : OPTION_LABELS.get(resolve(key))?.[chosen];
    },
    restoreFactory() {
      load(restore(overrides));
    },
    number: (key) => numbers.get(numeric(key))!,
    setNumber(key, value) {
      const stored = numeric(key);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Setting "${key}" takes a non-negative integer; got ${value}.`);
      }
      numbers.set(stored, value);
      overrides.numbers[stored] = value;
      save(overrides);
    },
  };
}

/** An in-memory store over `initial` (tests and widget rigs): nothing persists. */
export function createMemorySettings(initial: StockSettingsSnapshot): StockSettings {
  return settingsOver(initial, NO_OVERRIDES, () => {}, factorySettings);
}

/**
 * The option labels of a setter level (Info service, Screen saver), in the setting's order;
 * undefined for other nodes.
 */
function setterLabels(node: StockTreeNode): readonly string[] | undefined {
  const slugs = node.opens.kind === "submenu" ? setterLevel(node.number) : undefined;
  if (slugs === undefined) return undefined;
  return slugs.map((slug) => {
    const child = node.children?.find((c) => c.slug === slug);
    if (child === undefined) throw new Error(`Setter level ${node.number} has no child "${slug}".`);
    return child.label;
  });
}

/**
 * The option labels of a single-choice setting at `node`, in its order: an option list's, a
 * setter level's, or a code setting's; undefined for other nodes.
 */
function choiceLabels(node: StockTreeNode): readonly string[] | undefined {
  const spec = node.opens;
  if (spec.kind === "option-list" && !spec.multi) return spec.options.map((o) => o.label);
  return setterLabels(node) ?? codeSettings[node.number];
}

/**
 * The pages that show a value, by key, with their option labels when they are single-choice
 * settings: every node whose page showed a value in the virgin capture (its value hint), and every
 * list that opens unset (its page shows the choice once made: Incoming call alert → `Ringing`).
 * Other pages show none (Erase recent call lists, Voice mailbox number).
 */
const VALUE_PAGES: ReadonlyMap<string, readonly string[]> = new Map(
  [...treePaths()].flatMap((path) => {
    const node = path[path.length - 1]!;
    const spec = node.opens;
    const single = spec.kind === "option-list" && !spec.multi;
    if (node.valueHint === undefined && !(single && spec.opening === null)) return [];
    return [[settingKey(path), choiceLabels(node) ?? []] as const];
  }),
);

/**
 * The captured virgin-EEPROM state (D10) from the generated tree: option lists open on their
 * captured value (null when unset), setter levels on their page value (Info service `Off`),
 * multi-select marks, page values as display text (the Clock
 * pages are the host's), info page values, and the features' virgin texts and numbers. Keys that
 * alias another (Tones → General) are stored once, under their target.
 */
export function virginSettings(): StockSettingsSnapshot {
  const choices: Record<string, { options: number; chosen: number | null }> = {};
  const marks: Record<string, boolean[]> = {};
  const texts: Record<string, string> = {};
  const byNumber = new Map<string, StockTreeNode>();
  for (const path of treePaths()) {
    const node = path[path.length - 1]!;
    const key = settingKey(path);
    byNumber.set(node.number, node);
    if (node.valueHint !== undefined && hostValues[key] === undefined) {
      texts[key] = node.valueHint;
    }
    const spec = node.opens;
    const setter = setterLabels(node) ?? codeSettings[node.number];
    if (setter !== undefined) {
      const chosen = setter.indexOf(node.valueHint ?? "");
      if (chosen < 0) throw new Error(`Setting ${node.number} shows no option as its value.`);
      choices[key] = { options: setter.length, chosen };
    } else if (spec.kind === "option-list") {
      if (spec.multi) marks[key] = spec.options.map((option) => option.marked === true);
      else choices[key] = { options: spec.options.length, chosen: spec.opening };
    } else if (spec.kind === "info-pages") {
      for (const page of spec.pages) {
        if (page.value !== undefined) texts[`${key}/${slugOf(page.label)}`] = page.value;
      }
    }
  }
  for (const { key, labels, chosen } of STOCK_SETTINGS.choices) {
    if (key in choices) throw new Error(`Setting "${key}" is a tree setting too.`);
    choices[key] = { options: labels.length, chosen };
  }
  for (const entry of STOCK_SETTINGS.virginTexts) {
    if ("text" in entry) {
      texts[entry.key] = entry.text;
      continue;
    }
    const opens = byNumber.get(entry.number)?.opens;
    const line = opens && "lines" in opens ? opens.lines[entry.line] : undefined;
    if (line === undefined) throw new Error(`No line ${entry.line} on tree node ${entry.number}.`);
    texts[entry.key] = line;
  }

  const numbers: Record<string, number> = {};
  for (const entry of STOCK_SETTINGS.virginNumbers) {
    if ("value" in entry) {
      numbers[entry.key] = entry.value;
      continue;
    }
    const opens = byNumber.get(entry.number)?.opens;
    const line = opens && "lines" in opens ? opens.lines[entry.line] : undefined;
    if (line === undefined || !/^\d+$/.test(line)) {
      throw new Error(`No number on line ${entry.line} of tree node ${entry.number}.`);
    }
    numbers[entry.key] = Number(line);
  }

  const aliases: Record<string, string> = {};
  for (const table of [choices, marks, texts] as Record<string, unknown>[]) {
    for (const key of Object.keys(table)) {
      const target = settingAlias(key);
      if (target === key || !(target in table)) continue;
      if (JSON.stringify(table[key]) !== JSON.stringify(table[target])) {
        throw new Error(`Setting "${key}" shares "${target}" but their virgin values differ.`);
      }
      aliases[key] = target;
      delete table[key];
    }
  }
  return { choices, marks, texts, numbers, aliases };
}

/**
 * The value a stock page shows for the setting `key`: on a page that shows a value, its text (the
 * virgin value until the first choice), else the chosen option's label; else nothing.
 */
export function stockPageValue(settings: StockSettings, key: string): string | undefined {
  const labels = VALUE_PAGES.get(key);
  if (labels === undefined) return undefined;
  const text = settings.text(key);
  if (text !== undefined) return text;
  const chosen = labels.length === 0 ? null : settings.choice(key);
  return chosen === null ? undefined : labels[chosen];
}

/** The option labels of every option list and single choice, by key (aliases included). */
const OPTION_LABELS: ReadonlyMap<string, readonly string[]> = new Map([
  ...[...treePaths()].flatMap((path) => {
    const node = path[path.length - 1]!;
    const spec = node.opens;
    const labels =
      spec.kind === "option-list" ? spec.options.map((o) => o.label) : choiceLabels(node);
    return labels === undefined ? [] : [[settingKey(path), labels] as const];
  }),
  ...STOCK_SETTINGS.choices.map(({ key, labels }) => [key, labels] as const),
]);

let virginCache: StockSettingsSnapshot | undefined;
/** The virgin snapshot, computed once. */
function virgin(): StockSettingsSnapshot {
  virginCache ??= virginSettings();
  return virginCache;
}

/** The keys a settings record can hold, by table, sorted (pinned by a snapshot test, D3). */
export function settingsRecordKeys(): Record<keyof SettingsOverrides, string[]> {
  const v = virgin();
  return {
    choices: Object.keys(v.choices).sort(),
    marks: Object.keys(v.marks).sort(),
    texts: [...new Set([...Object.keys(v.texts), ...typedTexts])].sort(),
    numbers: Object.keys(v.numbers).sort(),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The entries of table `name` in stored data whose values `keep` accepts; throws on a bad shape. */
function table<T>(
  data: Record<string, unknown>,
  name: keyof SettingsOverrides,
  keep: (key: string, value: unknown) => value is T,
): Record<string, T> {
  const stored = data[name];
  if (stored === undefined) return {};
  if (!isPlainObject(stored)) throw new Error(`"${name}" is not an object.`);
  return Object.fromEntries(Object.entries(stored).filter(([k, v]) => keep(k, v))) as Record<
    string,
    T
  >;
}

/** Only the entries of `from` whose keys are in `keys`. */
function only<T>(from: Readonly<Record<string, T>>, keys: readonly string[]): Record<string, T> {
  return Object.fromEntries(Object.entries(from).filter(([key]) => keys.includes(key)));
}

/** The factory choices and marks (the features' factory defaults), by stored key. */
function factoryTables(): Pick<SettingsOverrides, "choices" | "marks"> {
  const choices: Record<string, number> = {};
  const marks: Record<string, boolean[]> = {};
  const v = virgin();
  for (const entry of factoryDefaults) {
    const key = v.aliases[entry.key] ?? entry.key;
    const labels = OPTION_LABELS.get(key);
    if (labels === undefined) throw new Error(`Factory default for unknown list "${entry.key}".`);
    if ("label" in entry) {
      const index = labels.indexOf(entry.label);
      if (index < 0 || !(key in v.choices)) {
        throw new Error(`Factory default "${entry.label}" is not an option of "${entry.key}".`);
      }
      choices[key] = index;
    } else {
      const unknown = entry.marked.filter((label) => !labels.includes(label));
      if (unknown.length > 0 || !(key in v.marks)) {
        throw new Error(`Factory marks ${JSON.stringify(unknown)} are not options of "${key}".`);
      }
      marks[key] = labels.map((label) => entry.marked.includes(label));
    }
  }
  return { choices, marks };
}

/**
 * The factory state (D5): virgin choices and marks under the factory defaults, and only the
 * texts and numbers Restore keeps.
 */
function factorySettings(current: SettingsOverrides): SettingsOverrides {
  return {
    ...factoryTables(),
    texts: only(current.texts, restoreKeeps),
    numbers: only(current.numbers, restoreKeeps),
  };
}

/**
 * The settings record (D3): overrides of the virgin snapshot. Stale entries (an unknown key, an
 * index out of range, marks of the wrong length) are dropped on load; Restore factory settings
 * writes `factorySettings`.
 */
export const SETTINGS_RECORD: EepromRecord<SettingsOverrides> = {
  name: "settings",
  version: 1,
  initial: () => NO_OVERRIDES,
  decode(data) {
    if (!isPlainObject(data)) throw new Error("not an object.");
    const v = virgin();
    const texts = settingsRecordKeys().texts;
    return {
      choices: table(data, "choices", (key, value): value is number => {
        const setting = v.choices[key];
        return (
          setting !== undefined &&
          Number.isInteger(value) &&
          (value as number) >= 0 &&
          (value as number) < setting.options
        );
      }),
      marks: table(
        data,
        "marks",
        (key, value): value is boolean[] =>
          Array.isArray(value) &&
          value.length === v.marks[key]?.length &&
          value.every((mark) => typeof mark === "boolean"),
      ),
      texts: table(
        data,
        "texts",
        (key, value): value is string | null =>
          texts.includes(key) && (typeof value === "string" || value === null),
      ),
      numbers: table(
        data,
        "numbers",
        (key, value): value is number =>
          key in v.numbers && Number.isInteger(value) && (value as number) >= 0,
      ),
    };
  },
  encode: (value) => ({ ...value }),
  factory: factorySettings,
};

/** The phone's settings over its EEPROM (D3): every write is stored at once. */
export function createStockSettings(eeprom: StockEeprom): StockSettings {
  return settingsOver(
    virgin(),
    eeprom.read(SETTINGS_RECORD),
    (overrides) => eeprom.write(SETTINGS_RECORD, overrides),
    () => {
      eeprom.restoreFactory();
      return eeprom.read(SETTINGS_RECORD);
    },
  );
}
