// The stock settings store (plan 14 D9): an internal, in-memory port until plan 15 adds host
// persistence and factory defaults. Its initial state is the captured virgin EEPROM (D10).
import {
  HOST_VALUES,
  setterLevel,
  settingAlias,
  settingKey,
  slugOf,
  VIRGIN_TEXTS,
} from "./bindings";
import { STOCK_TREE, type StockTreeNode } from "./generated/stock-tree";

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
}

export interface StockSettingsSnapshot {
  /** Single-choice settings: the option count and the chosen index (null = never written). */
  readonly choices: Readonly<
    Record<string, { readonly options: number; readonly chosen: number | null }>
  >;
  readonly marks: Readonly<Record<string, readonly boolean[]>>;
  readonly texts: Readonly<Record<string, string>>;
  /** Keys that read and write another key (D9: Tones are the General profile's). */
  readonly aliases: Readonly<Record<string, string>>;
}

export function createMemorySettings(initial: StockSettingsSnapshot): StockSettings {
  const choices = new Map(
    Object.entries(initial.choices).map(([key, value]) => [key, { ...value }]),
  );
  const marks = new Map(Object.entries(initial.marks).map(([key, value]) => [key, [...value]]));
  const texts = new Map(Object.entries(initial.texts));
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
  const check = (key: string, options: number, index: number): void => {
    if (!Number.isInteger(index) || index < 0 || index >= options) {
      throw new Error(`Setting "${key}" has ${options} options; got index ${index}.`);
    }
  };
  return {
    choice: (key) => single(key).chosen,
    choose(key, index) {
      const setting = single(key);
      check(key, setting.options, index);
      setting.chosen = index;
      texts.delete(resolve(key));
    },
    marks: (key) => [...multi(key)],
    toggle(key, index) {
      const setting = multi(key);
      check(key, setting.length, index);
      setting[index] = !setting[index];
      texts.delete(resolve(key));
    },
    text: (key) => texts.get(resolve(key)),
  };
}

/** Every tree node with its path from the top level. */
function* nodes(
  level: readonly StockTreeNode[] = STOCK_TREE,
  parents: readonly StockTreeNode[] = [],
): Generator<readonly StockTreeNode[]> {
  for (const node of level) {
    const path = [...parents, node];
    yield path;
    yield* nodes(node.children ?? [], path);
  }
}

/**
 * The option labels of a setter level (`SETTER_LEVELS`: Info service, Screen saver), in the
 * setting's order; undefined for other nodes.
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
 * The pages that show a value, by key, with their option labels when they are single-choice
 * settings: every node whose page showed a value in the virgin capture (its value hint), and every
 * list that opens unset (its page shows the choice once made: Incoming call alert → `Ringing`).
 * Other pages show none (Erase recent call lists, Voice mailbox number).
 */
const VALUE_PAGES: ReadonlyMap<string, readonly string[]> = new Map(
  [...nodes()].flatMap((path) => {
    const node = path[path.length - 1]!;
    const spec = node.opens;
    const single = spec.kind === "option-list" && !spec.multi;
    if (node.valueHint === undefined && !(single && spec.opening === null)) return [];
    const labels = single ? spec.options.map((option) => option.label) : setterLabels(node);
    return [[settingKey(path), labels ?? []] as const];
  }),
);

/**
 * The captured virgin-EEPROM state (D10) from the generated tree: option lists open on their
 * captured value (null when unset), setter levels on their page value (Info service `Off`),
 * multi-select marks, page values as display text (the Clock
 * pages are the host's), info page values, and the free-text values of `VIRGIN_TEXTS`. Keys that
 * alias another (Tones → General) are stored once, under their target.
 */
export function virginSettings(): StockSettingsSnapshot {
  const choices: Record<string, { options: number; chosen: number | null }> = {};
  const marks: Record<string, boolean[]> = {};
  const texts: Record<string, string> = {};
  const byNumber = new Map<string, StockTreeNode>();
  for (const path of nodes()) {
    const node = path[path.length - 1]!;
    const key = settingKey(path);
    byNumber.set(node.number, node);
    if (node.valueHint !== undefined && HOST_VALUES[key] === undefined) {
      texts[key] = node.valueHint;
    }
    const spec = node.opens;
    const setter = setterLabels(node);
    if (setter !== undefined) {
      const chosen = setter.indexOf(node.valueHint ?? "");
      if (chosen < 0) throw new Error(`Setter level ${node.number} shows no option as its value.`);
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
  for (const entry of VIRGIN_TEXTS) {
    if ("text" in entry) {
      texts[entry.key] = entry.text;
      continue;
    }
    const opens = byNumber.get(entry.number)?.opens;
    const line = opens && "lines" in opens ? opens.lines[entry.line] : undefined;
    if (line === undefined) throw new Error(`No line ${entry.line} on tree node ${entry.number}.`);
    texts[entry.key] = line;
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
  return { choices, marks, texts, aliases };
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
