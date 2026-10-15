// Plan 19 Task 11: the Phone book's coverage. Every node of menu 1 is covered by an asserted
// golden in each state it has: the virgin empty SIM (plan 14's tree goldens) and, where names
// change the screen, a SIM with names (plan 19's, `PHONE_BOOK_COVERS`). Nothing waits for plan 19.
import { describe, expect, it } from "vite-plus/test";
import { PLACEHOLDER_OWNERS as IMPORTER_PLACEHOLDER_OWNERS } from "../scripts/tree-capture-set.ts";
import { STOCK_TREE, type StockTreeNode } from "../src/firmware/generated/stock-tree";
import { PLACEHOLDER_OWNERS } from "../src/firmware/stock";
import { EDITOR_OPTIONS } from "../src/messages/bindings";
import { INDEX } from "./support/acceptance.ts";
import { PHONE_BOOK_COVERS, PHONE_BOOK_KNOWN_GAPS } from "./support/phone-book.ts";

/** Menu 1's numbers: its entries and their option choices. */
function numbers(node: StockTreeNode): string[] {
  const spec = node.opens;
  const choices = spec.kind === "option-list" ? spec.options.length : 0;
  return [
    node.number,
    ...Array.from({ length: choices }, (_, i) => `${node.number}-${i + 1}`),
    ...(node.children ?? []).flatMap(numbers),
  ];
}

const PHONE_BOOK = numbers(STOCK_TREE.find((node) => node.number === "1")!);

/** The nodes whose screen a name on the SIM changes (D13: the empty SIM's are plan 14's). */
const WITH_NAMES = [
  "1-1",
  "1-2",
  "1-3",
  "1-4-1",
  "1-4-2",
  "1-5",
  "1-6",
  "1-7",
  "1-8-1-1",
  "1-8-1-2",
  "1-8-1-3",
  "1-8-2",
  "1-9",
  "1-10-1",
  "1-10-2",
  "1-10-3",
  "1-10-4",
];

const ASSERTED = new Set(INDEX.filter((e) => e.status === "asserted").map((e) => e.id));

describe("the Phone book's coverage (plan 19 Task 11)", () => {
  it("covers every node of menu 1 with an asserted tree golden (the empty SIM)", () => {
    const covered = new Set(
      INDEX.filter((e) => e.status === "asserted").flatMap((e) => e.covers ?? []),
    );
    // Plan 13's level list covers menu 1 itself.
    if (ASSERTED.has("menu/01-phone-book.sub")) covered.add("1");
    // Option choices are covered by their list's `.options` golden.
    const listed = (number: string) => covered.has(number.split("-").slice(0, -1).join("-"));
    expect(PHONE_BOOK.filter((n) => !covered.has(n) && !listed(n))).toEqual([]);
  });

  it("covers every node names change with an asserted plan 19 golden that passes", () => {
    const covered = new Set(
      Object.entries(PHONE_BOOK_COVERS)
        .filter(([id]) => ASSERTED.has(id) && PHONE_BOOK_KNOWN_GAPS[id] === undefined)
        .flatMap(([, nodes]) => nodes),
    );
    expect(WITH_NAMES.filter((n) => !covered.has(n))).toEqual([]);
    expect(WITH_NAMES.every((n) => PHONE_BOOK.includes(n))).toBe(true);
  });

  it("leaves nothing pending for plan 19, in goldens or placeholders", () => {
    expect(INDEX.filter((e) => e.status === "pending:19").map((e) => e.id)).toEqual([]);
    expect(Object.entries(PLACEHOLDER_OWNERS).filter(([, plan]) => plan === "19")).toEqual([]);
    expect(Object.entries(IMPORTER_PLACEHOLDER_OWNERS).filter(([, plan]) => plan === "19")).toEqual(
      [],
    );
    expect(EDITOR_OPTIONS.filter((option) => option.owner === "19")).toEqual([]);
  });

  it("hands calls on to plan 22 (D11)", () => {
    const pending = INDEX.filter((e) => e.id.startsWith("phone-book/") && e.status !== "asserted");
    expect(new Set(pending.map((e) => e.status))).toEqual(new Set(["pending:22"]));
  });
});
