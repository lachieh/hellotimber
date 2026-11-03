// The settings store engine (plan 14 D9, plan 15 D3): single choices, multi-select marks, texts
// and numbers over a virgin snapshot, with the writes since the virgin state as overrides, and
// aliases that resolve against the stored choices. A firmware supplies the schema and the
// persistence (src/firmware/settings.ts: the snapshot of its handset, tree and features, and its
// EEPROM record).

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
  /**
   * Keys that read and write another key, by their virgin target (D9: Tones are the General
   * profile's). A store resolves them again against its stored choices (plan 17 D1: Tones are the
   * active profile's).
   */
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

export const NO_OVERRIDES: SettingsOverrides = { choices: {}, marks: {}, texts: {}, numbers: {} };

function copyOverrides(overrides: SettingsOverrides): MutableOverrides {
  return {
    choices: { ...overrides.choices },
    marks: Object.fromEntries(Object.entries(overrides.marks).map(([k, v]) => [k, [...v]])),
    texts: { ...overrides.texts },
    numbers: { ...overrides.numbers },
  };
}

/** What a settings store reads of its firmware's schema. */
export interface StoreSchema {
  /** The key `key` shares by the settings aliases, else itself (`Firmware.settingAlias`). */
  readonly settingAlias: (key: string, choice?: (key: string) => number | null) => string;
  /** Texts the user types that have no virgin value. */
  readonly typedTexts: readonly string[];
  /** The option labels of every single choice, by stored key. */
  readonly optionLabels: ReadonlyMap<string, readonly string[]>;
}

/**
 * A store over `initial` with `stored` applied (a key's choice or marks remove its virgin text,
 * D9), calling `save` with the overrides after every write. Restore factory settings replaces
 * the overrides with `restore(current)` (D5).
 */
export function settingsStore(
  schema: StoreSchema,
  initial: StockSettingsSnapshot,
  stored: SettingsOverrides,
  save: (overrides: SettingsOverrides) => void,
  restore: (current: SettingsOverrides) => SettingsOverrides,
): StockSettings {
  const { settingAlias, typedTexts } = schema;
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

  // A stock alias follows the stored choices it reads (plan 17 D1: Tones are the active
  // profile's); any other alias of the snapshot (a test's) is fixed.
  const chosen = (key: string): number | null => choices.get(key)?.chosen ?? null;
  const resolve = (key: string): string => {
    const target = initial.aliases[key];
    if (target === undefined) return key;
    return target === settingAlias(key) ? settingAlias(key, chosen) : target;
  };
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
      return chosen === null ? undefined : schema.optionLabels.get(resolve(key))?.[chosen];
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
