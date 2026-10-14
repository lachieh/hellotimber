// The stock features (src/firmware/features/) as `stock.ts` composes them: every binding names a
// node of the stock tree, and no two patterns of one table match the same node, so the order in
// which features register never matters.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { STOCK_TREE, type StockTreeNode } from "../src/firmware/generated/stock-tree";
import {
  EXIT_LEVELS,
  LEADS,
  LEVEL_BARS,
  PLACEHOLDER_OWNERS,
  placeholderOwner,
  PROMPT_LAYOUTS,
  SCREENS,
  STOCK_FEATURES,
} from "../src/firmware/stock";
import { matchesPattern } from "../src/firmware/tree";

/** Every number of the stock tree: entries, option choices and info pages (`<list>-<k>`). */
function treeNumbers(nodes: readonly StockTreeNode[] = STOCK_TREE): string[] {
  return nodes.flatMap((node) => {
    const spec = node.opens;
    const choices =
      spec.kind === "option-list"
        ? spec.options.length
        : spec.kind === "info-pages"
          ? spec.pages.length
          : 0;
    return [
      node.number,
      ...Array.from({ length: choices }, (_, i) => `${node.number}-${i + 1}`),
      ...treeNumbers(node.children ?? []),
    ];
  });
}

const NUMBERS = treeNumbers();

describe("stock features", () => {
  it("registers every module under features/ once, by its file name", () => {
    const files = readdirSync(join(import.meta.dirname, "../src/firmware/features"))
      .filter((file) => file.endsWith(".ts") && file !== "index.ts" && file !== "feature.ts")
      .map((file) => file.slice(0, -".ts".length));
    expect(STOCK_FEATURES.map((feature) => feature.name)).toEqual([...files].sort());
  });

  it("binds screens, lead entries, prompt layouts, exits and level bars to tree nodes", () => {
    const bound = [SCREENS, LEADS, PROMPT_LAYOUTS, EXIT_LEVELS, LEVEL_BARS].flatMap(Object.keys);
    expect(bound.filter((number) => !NUMBERS.includes(number))).toEqual([]);
  });

  it("implements no screen that a later plan's placeholder owns", () => {
    expect(Object.keys(SCREENS).filter((n) => placeholderOwner(n) !== undefined)).toEqual([]);
  });

  const patternTables: Readonly<Record<string, readonly string[]>> = {
    placeholders: Object.keys(PLACEHOLDER_OWNERS),
    ...Object.fromEntries(
      (["noteEnds", "noteMoves", "setterLevels"] as const).map((table) => [
        table,
        STOCK_FEATURES.flatMap((feature) => Object.keys(feature.widgets?.[table] ?? {})),
      ]),
    ),
    entryIndicatorLevels: STOCK_FEATURES.flatMap((f) => f.widgets?.entryIndicatorLevels ?? []),
  };
  for (const [table, patterns] of Object.entries(patternTables)) {
    it(`matches every pattern of ${table} to a tree node, and no node to two patterns`, () => {
      const unmatched = patterns.filter((p) => !NUMBERS.some((n) => matchesPattern(n, p)));
      expect(unmatched, "patterns that match no node").toEqual([]);
      const twice = NUMBERS.filter((n) => patterns.filter((p) => matchesPattern(n, p)).length > 1);
      expect(twice, "nodes two patterns match").toEqual([]);
    });
  }
});
