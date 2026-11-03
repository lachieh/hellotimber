// The stock settings store (plan 14 D9, plan 15 D3): the captured virgin EEPROM (plan 14 D10)
// with the phone's writes on top, persisted as one EEPROM record (`SETTINGS_RECORD`), and the
// factory state Restore factory settings writes (plan 15 D5). Each composed firmware has its own
// schema: the virgin state of its handset, tree and features, and its record. The stock-bound
// exports below are STOCK_FIRMWARE's.
import type { EepromRecord, StockEeprom } from "./eeprom";
import {
  NO_OVERRIDES,
  settingsStore,
  type SettingsOverrides,
  type StockSettings,
  type StockSettingsSnapshot,
  type StoreSchema,
} from "../kit/system/settings";

export type { SettingsOverrides, StockSettings, StockSettingsSnapshot };
import type { Firmware } from "./firmware";
import type { StockTreeNode } from "./generated/stock-tree";
import { STOCK_FIRMWARE } from "./stock";
import { settingKey, slugOf } from "./tree";

/**
 * An in-memory store over `initial` (tests and widget rigs) with `firmware`'s aliases and labels:
 * nothing persists.
 */
export function createMemorySettings(
  initial: StockSettingsSnapshot,
  firmware: Firmware = STOCK_FIRMWARE,
): StockSettings {
  const schema = schemaOf(firmware);
  return settingsStore(
    storeSchema(schema),
    initial,
    NO_OVERRIDES,
    () => {},
    (current) => factorySettings(schema, current),
  );
}

/** What the store engine reads of `schema`. */
function storeSchema(schema: Schema): StoreSchema {
  return {
    settingAlias: schema.firmware.settingAlias,
    typedTexts: schema.firmware.settings.typedTexts,
    optionLabels: schema.optionLabels,
  };
}

/** A firmware's settings schema: the tables below, computed once per firmware. */
interface Schema {
  readonly firmware: Firmware;
  /** The pages that show a value, by key, with their single choice's labels (`valuePages`). */
  readonly valuePages: ReadonlyMap<string, readonly string[]>;
  /** The option labels of every option list and single choice, by key (aliases included). */
  readonly optionLabels: ReadonlyMap<string, readonly string[]>;
  /** The virgin snapshot, computed on first use. */
  virgin(): StockSettingsSnapshot;
  readonly record: EepromRecord<SettingsOverrides>;
}

const SCHEMAS = new WeakMap<Firmware, Schema>();

function schemaOf(firmware: Firmware): Schema {
  let schema = SCHEMAS.get(firmware);
  if (schema === undefined) {
    let virginCache: StockSettingsSnapshot | undefined;
    const partial = {
      firmware,
      valuePages: valuePages(firmware),
      optionLabels: optionLabels(firmware),
      virgin: () => (virginCache ??= virginSettings(firmware)),
    };
    schema = { ...partial, record: settingsRecord(partial) };
    SCHEMAS.set(firmware, schema);
  }
  return schema;
}

/** The settings record of a phone running `firmware` (D3). */
export function settingsRecordOf(firmware: Firmware): EepromRecord<SettingsOverrides> {
  return schemaOf(firmware).record;
}

/**
 * The option labels of a setter level (Info service, Screen saver), in the setting's order;
 * undefined for other nodes.
 */
function setterLabels(firmware: Firmware, node: StockTreeNode): readonly string[] | undefined {
  const slugs = node.opens.kind === "submenu" ? firmware.setterLevel(node.number) : undefined;
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
function choiceLabels(firmware: Firmware, node: StockTreeNode): readonly string[] | undefined {
  const spec = node.opens;
  if (spec.kind === "option-list" && !spec.multi) return spec.options.map((o) => o.label);
  return setterLabels(firmware, node) ?? firmware.settings.codeSettings[node.number];
}

/**
 * The pages that show a value, by key, with their option labels when they are single-choice
 * settings: every node whose page showed a value in the virgin capture (its value hint), and every
 * list that opens unset (its page shows the choice once made: Incoming call alert → `Ringing`).
 * Other pages show none (Erase recent call lists, Voice mailbox number).
 */
function valuePages(firmware: Firmware): ReadonlyMap<string, readonly string[]> {
  return new Map(
    [...firmware.treePaths()].flatMap((path) => {
      const node = path[path.length - 1]!;
      const spec = node.opens;
      const single = spec.kind === "option-list" && !spec.multi;
      if (node.valueHint === undefined && !(single && spec.opening === null)) return [];
      return [[settingKey(path), choiceLabels(firmware, node) ?? []] as const];
    }),
  );
}

/**
 * The captured virgin-EEPROM state (D10) from `firmware`'s tree (default the stock firmware's
 * generated tree): option lists open on their
 * captured value (null when unset), setter levels on their page value (Info service `Off`),
 * multi-select marks, page values as display text (the Clock
 * pages are the host's), info page values, and the features' virgin texts and numbers. The
 * handset's and features' single choices (`settings.choices`) join them: one the tree lists too
 * binds to the tree's (same options, same virgin choice; throws otherwise). Keys that alias
 * another (Tones → General) are stored once, under their target; an alias prefix covers every key
 * under its virgin target, listed under the prefix in the tree or not.
 */
export function virginSettings(firmware: Firmware = STOCK_FIRMWARE): StockSettingsSnapshot {
  const { codeSettings, hostValues } = firmware.settings;
  const tables = firmware.settings;
  const choices: Record<string, { options: number; chosen: number | null }> = {};
  const marks: Record<string, boolean[]> = {};
  const texts: Record<string, string> = {};
  /** The tree's single choices' option labels, by key. */
  const treeLabels = new Map<string, readonly string[]>();
  const byNumber = new Map<string, StockTreeNode>();
  for (const path of firmware.treePaths()) {
    const node = path[path.length - 1]!;
    const key = settingKey(path);
    byNumber.set(node.number, node);
    if (node.valueHint !== undefined && hostValues[key] === undefined) {
      texts[key] = node.valueHint;
    }
    const spec = node.opens;
    const setter = setterLabels(firmware, node) ?? codeSettings[node.number];
    if (setter !== undefined) {
      const chosen = setter.indexOf(node.valueHint ?? "");
      if (chosen < 0) throw new Error(`Setting ${node.number} shows no option as its value.`);
      choices[key] = { options: setter.length, chosen };
      treeLabels.set(key, setter);
    } else if (spec.kind === "option-list") {
      if (spec.multi) marks[key] = spec.options.map((option) => option.marked === true);
      else {
        choices[key] = { options: spec.options.length, chosen: spec.opening };
        treeLabels.set(
          key,
          spec.options.map((option) => option.label),
        );
      }
    } else if (spec.kind === "info-pages") {
      for (const page of spec.pages) {
        if (page.value !== undefined) texts[`${key}/${slugOf(page.label)}`] = page.value;
      }
    }
  }
  for (const { key, labels, chosen } of tables.choices) {
    const listed = treeLabels.get(key);
    if (listed !== undefined) {
      if (JSON.stringify(listed) !== JSON.stringify(labels) || choices[key]!.chosen !== chosen) {
        throw new Error(`Tree setting "${key}" differs from its registered choice.`);
      }
      continue;
    }
    if (key in choices || key in marks) throw new Error(`Setting "${key}" is registered twice.`);
    choices[key] = { options: labels.length, chosen };
  }
  for (const entry of tables.virginTexts) {
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
  for (const entry of tables.virginNumbers) {
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
      const target = firmware.settingAlias(key);
      if (target === key || !(target in table)) continue;
      if (JSON.stringify(table[key]) !== JSON.stringify(table[target])) {
        throw new Error(`Setting "${key}" shares "${target}" but their virgin values differ.`);
      }
      aliases[key] = target;
      delete table[key];
    }
  }
  for (const { prefix, target } of tables.aliases) {
    const base = typeof target === "string" ? target : target(() => null);
    for (const table of [choices, marks, texts] as Record<string, unknown>[]) {
      for (const key of Object.keys(table)) {
        const alias = prefix + key.slice(base.length);
        if (!key.startsWith(base) || alias in aliases) continue;
        if (firmware.settingAlias(alias) === key) aliases[alias] = key;
      }
    }
  }
  return { choices, marks, texts, numbers, aliases };
}

/**
 * The value a stock page shows for the setting `key`: on a page that shows a value, its text (the
 * virgin value until the first choice), else the chosen option's label; else nothing. The pages
 * are `firmware`'s.
 */
export function stockPageValue(
  settings: StockSettings,
  key: string,
  firmware: Firmware = STOCK_FIRMWARE,
): string | undefined {
  const labels = schemaOf(firmware).valuePages.get(key);
  if (labels === undefined) return undefined;
  const text = settings.text(key);
  if (text !== undefined) return text;
  const chosen = labels.length === 0 ? null : settings.choice(key);
  return chosen === null ? undefined : labels[chosen];
}

/** The option labels of every option list and single choice, by key (aliases included). */
function optionLabels(firmware: Firmware): ReadonlyMap<string, readonly string[]> {
  return new Map([
    ...[...firmware.treePaths()].flatMap((path) => {
      const node = path[path.length - 1]!;
      const spec = node.opens;
      const labels =
        spec.kind === "option-list"
          ? spec.options.map((o) => o.label)
          : choiceLabels(firmware, node);
      return labels === undefined ? [] : [[settingKey(path), labels] as const];
    }),
    ...firmware.settings.choices.map(({ key, labels }) => [key, labels] as const),
  ]);
}

/**
 * The keys a settings record of `firmware` can hold, by table, sorted (pinned by a snapshot
 * test, D3).
 */
export function settingsRecordKeys(
  firmware: Firmware = STOCK_FIRMWARE,
): Record<keyof SettingsOverrides, string[]> {
  return recordKeys(schemaOf(firmware));
}

function recordKeys(
  schema: Pick<Schema, "firmware" | "virgin">,
): Record<keyof SettingsOverrides, string[]> {
  const v = schema.virgin();
  const { typedTexts } = schema.firmware.settings;
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
function factoryTables(
  schema: Pick<Schema, "firmware" | "virgin" | "optionLabels">,
): Pick<SettingsOverrides, "choices" | "marks"> {
  const choices: Record<string, number> = {};
  const marks: Record<string, boolean[]> = {};
  const v = schema.virgin();
  for (const entry of schema.firmware.settings.factoryDefaults) {
    const key = v.aliases[entry.key] ?? entry.key;
    const labels = schema.optionLabels.get(key);
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
 * choices, texts and numbers Restore keeps (plan 18b: the Dictionary, `sms/restore`).
 */
function factorySettings(
  schema: Pick<Schema, "firmware" | "virgin" | "optionLabels">,
  current: SettingsOverrides,
): SettingsOverrides {
  const { factoryTexts, restoreKeeps } = schema.firmware.settings;
  const factory = factoryTables(schema);
  const texts = Object.fromEntries(factoryTexts.map(({ key, text }) => [key, text]));
  return {
    ...factory,
    choices: { ...factory.choices, ...only(current.choices, restoreKeeps) },
    texts: { ...texts, ...only(current.texts, restoreKeeps) },
    numbers: only(current.numbers, restoreKeeps),
  };
}

/**
 * A firmware's settings record (D3): overrides of its virgin snapshot. Stale entries (an unknown
 * key, an index out of range, marks of the wrong length) are dropped on load; Restore factory
 * settings writes `factorySettings`.
 */
function settingsRecord(
  schema: Pick<Schema, "firmware" | "virgin" | "optionLabels">,
): EepromRecord<SettingsOverrides> {
  return {
    name: "settings",
    version: 1,
    initial: () => NO_OVERRIDES,
    decode(data) {
      if (!isPlainObject(data)) throw new Error("not an object.");
      const v = schema.virgin();
      const texts = recordKeys(schema).texts;
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
    factory: (current) => factorySettings(schema, current),
  };
}

/** The stock firmware's settings record. */
export const SETTINGS_RECORD: EepromRecord<SettingsOverrides> = schemaOf(STOCK_FIRMWARE).record;

/**
 * The phone's settings over its EEPROM (D3), for `firmware` (default the stock firmware; the
 * EEPROM must hold that firmware's settings record): every write is stored at once.
 * `virginChoices` replaces virgin choices for this phone (plan 18b D5: Dictionary off without a T9
 * dictionary); Restore factory settings returns to them.
 */
export function createStockSettings(
  eeprom: StockEeprom,
  virginChoices: Readonly<Record<string, number>> = {},
  firmware: Firmware = STOCK_FIRMWARE,
): StockSettings {
  const schema = schemaOf(firmware);
  const record = schema.record;
  const base = schema.virgin();
  const initial: StockSettingsSnapshot =
    Object.keys(virginChoices).length === 0
      ? base
      : {
          ...base,
          choices: {
            ...base.choices,
            ...Object.fromEntries(
              Object.entries(virginChoices).map(([key, chosen]) => {
                const setting = base.choices[key];
                if (setting === undefined) throw new Error(`No single-choice setting "${key}".`);
                return [key, { ...setting, chosen }];
              }),
            ),
          },
        };
  return settingsStore(
    storeSchema(schema),
    initial,
    eeprom.read(record),
    (overrides) => eeprom.write(record, overrides),
    () => {
      eeprom.restoreFactory();
      return eeprom.read(record);
    },
  );
}
