// Lookups in the generated stock tree for widget tests.
import { join } from "node:path";
import type { MenuIndicator } from "@hellotimber/phone-core";
import { readGoldenIndex, type GoldenIndexEntry } from "../../scripts/golden-index.ts";
import { settingKey } from "../../src/firmware/tree";
import { STOCK_TREE, type StockTreeNode } from "../../src/firmware/generated/stock-tree";

export type { GoldenIndexEntry as IndexEntry } from "../../scripts/golden-index.ts";

export const INDEX: readonly GoldenIndexEntry[] = readGoldenIndex(
  join(import.meta.dirname, "../../goldens"),
);

/** The tree node numbered `number` and the path to it from the top level. */
export function treePath(number: string): StockTreeNode[] {
  const path: StockTreeNode[] = [];
  let level: readonly StockTreeNode[] = STOCK_TREE;
  for (const segment of number.split("-")) {
    const node = level.find((n) => n.number.split("-").at(-1) === segment);
    if (!node) throw new Error(`No tree node ${number}.`);
    path.push(node);
    level = node.children ?? [];
  }
  return path;
}

/** The option list at `number`, its spec and its setting key. */
export function optionNode(number: string) {
  const path = treePath(number);
  const node = path.at(-1)!;
  if (node.opens.kind !== "option-list") throw new Error(`${number} is not an option list.`);
  return { node, spec: node.opens, key: settingKey(path) };
}

/** The kernel's indicator for an application at `number` (`5-2` → segments 5, 2). */
export function indicatorOf(number: string): MenuIndicator {
  return { segments: number.split("-").map(Number), awaitingNext: false };
}
