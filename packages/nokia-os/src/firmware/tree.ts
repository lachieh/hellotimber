// Paths, keys and patterns over the generated stock tree (src/firmware/generated/stock-tree.ts),
// shared by the menu, the leaves, the settings store and every feature (plan 14 D4).
import { STOCK_TREE, type StockTreeNode } from "./generated/stock-tree";

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
 * Whether menu number `number` matches a node pattern: a menu number whose segments may be `*`
 * (any one segment); a trailing `-**` also matches the node itself and everything below.
 */
export function matchesPattern(number: string, pattern: string): boolean {
  const deep = pattern.endsWith("-**");
  const want = (deep ? pattern.slice(0, -3) : pattern).split("-");
  const have = number.split("-");
  if (deep ? have.length < want.length : have.length !== want.length) return false;
  return want.every((segment, i) => segment === "*" || segment === have[i]);
}

/** The value of the first pattern in `table` that `number` matches. */
export function byPattern<T>(table: Readonly<Record<string, T>>, number: string): T | undefined {
  for (const [pattern, value] of Object.entries(table)) {
    if (matchesPattern(number, pattern)) return value;
  }
  return undefined;
}

/** The path from the top level to tree node `number`. */
export function treePath(number: string): StockTreeNode[] {
  const path: StockTreeNode[] = [];
  let level: readonly StockTreeNode[] = STOCK_TREE;
  for (const segment of number.split("-")) {
    const found = level.find((n) => n.number.split("-").at(-1) === segment);
    if (found === undefined) throw new Error(`No tree node ${number}.`);
    path.push(found);
    level = found.children ?? [];
  }
  return path;
}

/** The slug of the tree node after `number` among its siblings (circular). */
export function nextSibling(number: string): string {
  const segments = number.split("-");
  let level: readonly StockTreeNode[] = STOCK_TREE;
  for (const segment of segments.slice(0, -1)) {
    level = level.find((n) => n.number.split("-").at(-1) === segment)?.children ?? [];
  }
  const index = level.findIndex((n) => n.number === number);
  if (index < 0) throw new Error(`No tree node ${number}.`);
  return level[(index + 1) % level.length]!.slug;
}

/** Every tree node with its path from the top level, in tree order. */
export function* treePaths(
  level: readonly StockTreeNode[] = STOCK_TREE,
  parents: readonly StockTreeNode[] = [],
): Generator<readonly StockTreeNode[]> {
  for (const node of level) {
    const path = [...parents, node];
    yield path;
    yield* treePaths(node.children ?? [], path);
  }
}
