// The generated stock tree (plan 14 Task 3): checked as data, without REF.
import { describe, expect, it } from "vite-plus/test";
import { LEVEL1 } from "../scripts/text-runs.ts";
import { STOCK_TREE, type StockTreeNode } from "../src/firmware/generated/stock-tree.ts";

function walk(
  nodes: readonly StockTreeNode[],
  visit: (node: StockTreeNode, parent?: StockTreeNode) => void,
  parent?: StockTreeNode,
): void {
  for (const node of nodes) {
    visit(node, parent);
    walk(node.children ?? [], visit, node);
  }
}

function find(number: string): StockTreeNode {
  let found: StockTreeNode | undefined;
  walk(STOCK_TREE, (node) => {
    if (node.number === number) found = node;
  });
  if (found === undefined) throw new Error(`no node ${number}`);
  return found;
}

describe("generated stock tree", () => {
  it("has the 12 top-level entries in carousel order", () => {
    expect(STOCK_TREE.map((node) => node.label)).toEqual(LEVEL1.map((level) => level.title));
    expect(STOCK_TREE.map((node) => node.number)).toEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1)),
    );
  });

  it("equals plan 13's level-1 transcription", () => {
    LEVEL1.forEach((level, i) => {
      const top = STOCK_TREE[i]!;
      const children = top.children ?? [];
      if (level.labels.length === 0) {
        expect(children, level.slug).toEqual([]);
        return;
      }
      expect(top.opens.kind === "submenu" && top.opens.presentation, level.slug).toBe(
        level.presentation,
      );
      // Plan 13's golden omits Profiles slot 6; the tree keeps it as "(empty)" (D10).
      expect(
        children.slice(0, level.labels.length).map((child) => child.label),
        level.slug,
      ).toEqual(level.labels);
      const numbers = level.numbers ?? level.labels.map((_, j) => j + 1);
      expect(
        children.slice(0, level.labels.length).map((child) => Number(child.number.split("-")[1])),
        level.slug,
      ).toEqual(numbers);
      for (const [image, value] of Object.entries(level.values ?? {})) {
        expect(children[Number(image) - 1]!.valueHint, `${level.slug} ${image}`).toBe(value);
      }
    });
    expect(find("12-6").label).toBe("(empty)");
  });

  it("numbers every node uniquely under its parent's number", () => {
    const seen = new Set<string>();
    walk(STOCK_TREE, (node, parent) => {
      expect(seen.has(node.number), node.number).toBe(false);
      seen.add(node.number);
      if (parent) expect(node.number.startsWith(`${parent.number}-`), node.number).toBe(true);
      expect(node.number.split("-").length).toBe(parent ? parent.number.split("-").length + 1 : 1);
    });
    expect(seen.size).toBe(279);
  });

  it("keeps the hidden menu-number gaps", () => {
    const childNumbers = (number: string): string[] =>
      (find(number).children ?? []).map((child) => child.number);
    expect(childNumbers("6-2")).not.toContain("6-2-5");
    expect(childNumbers("6-2")).toContain("6-2-6");
    expect(childNumbers("6-3")).not.toContain("6-3-3");
    expect(childNumbers("7")).not.toContain("7-5");
    expect(childNumbers("8")).not.toContain("8-5");
    for (const profile of ["12-1", "12-2", "12-3", "12-4", "12-5", "12-6"]) {
      expect(childNumbers(`${profile}-2`)).not.toContain(`${profile}-2-4`);
      expect(childNumbers(`${profile}-2`)).toContain(`${profile}-2-5`);
    }
  });

  it("opens option lists on a valid entry or unset", () => {
    let lists = 0;
    walk(STOCK_TREE, (node) => {
      if (node.opens.kind !== "option-list") return;
      lists++;
      const { opening, options } = node.opens;
      expect(opening === null || (opening >= 0 && opening < options.length), node.number).toBe(
        true,
      );
    });
    expect(lists).toBeGreaterThan(90);
  });

  it("gives siblings unique kebab-case slugs and submenus a valid opening", () => {
    walk(STOCK_TREE, (node) => {
      const slugs = (node.children ?? []).map((child) => child.slug);
      expect(new Set(slugs).size, node.number).toBe(slugs.length);
      for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      if (node.opens.kind === "submenu" && node.opens.opening !== undefined) {
        expect(slugs, node.number).toContain(node.opens.opening);
      }
    });
    expect(find("2-1").slug).toBe("write");
    expect(find("8-1").slug).toBe("snake");
  });

  it("marks the four game menus with a splash intro", () => {
    walk(STOCK_TREE, (node) => {
      const intro = node.opens.kind === "submenu" && node.opens.intro === true;
      expect(intro, node.number).toBe(["8-1", "8-2", "8-3", "8-4"].includes(node.number));
    });
  });
});
