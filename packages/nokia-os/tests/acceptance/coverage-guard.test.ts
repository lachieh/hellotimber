// The coverage guard (plan 13 "Scenario harness and coverage guard", plan 14 D7) over every
// plan's acceptance file: each plan file declares the scenarios and known gaps of its goldens
// (`goldens/index/<NN>.json`); this file collects them all and checks them together. Adding a
// plan means adding `tests/acceptance/<NN>-<slug>.test.ts`; nothing here changes.
import { describe, expect, it } from "vite-plus/test";
import { MENU_SLUGS } from "../../scripts/capture-set.ts";
import { indexedPlans, readPlanIndex } from "../../scripts/golden-index.ts";
import {
  PLACEHOLDER_OWNERS as IMPORTER_PLACEHOLDER_OWNERS,
  SAME_AS as IMPORTER_SAME_AS,
} from "../../scripts/tree-capture-set.ts";
import { PLACEHOLDER_OWNERS, placeholderOwner, SAME_AS } from "../../src/firmware/stock";
import { STOCK_TREE, type StockTreeNode } from "../../src/firmware/generated/stock-tree";
import { stockMenu } from "../../src/index";
import {
  collectAcceptancePlans,
  GOLDENS,
  INDEX,
  PLAN_FILE,
  scenarioOf,
  type AcceptancePlan,
  type IndexEntry,
} from "../support/acceptance.ts";

const PLAN_FILES = await collectAcceptancePlans();
const PLANS = [...PLAN_FILES.values()];

/** Every plan's known gaps. */
const KNOWN_GAPS: Readonly<Record<string, string>> = Object.assign(
  {},
  ...PLANS.map((plan) => plan.knownGaps ?? {}),
);

/** The plan whose index lists each golden. */
const PLAN_OF = new Map<string, AcceptancePlan>(
  PLANS.flatMap((plan) => readPlanIndex(GOLDENS, plan.plan).map((e) => [e.id, plan] as const)),
);

describe("acceptance plans", () => {
  it("has one plan file per golden index, named after its plan", () => {
    for (const [file, plan] of PLAN_FILES) expect(PLAN_FILE.exec(file)![1], file).toBe(plan.plan);
    expect(PLANS.map((plan) => plan.plan).sort()).toEqual(indexedPlans(GOLDENS));
  });

  for (const plan of PLANS) {
    const own = readPlanIndex(GOLDENS, plan.plan);
    const asserted = new Set(own.filter((e) => e.status === "asserted").map((e) => e.id));

    it(`plan ${plan.plan}: declares covers only for its asserted goldens`, () => {
      expect(Object.keys(plan.covers ?? {}).filter((id) => !asserted.has(id))).toEqual([]);
    });

    it(`plan ${plan.plan}: lists only its asserted goldens as known gaps`, () => {
      expect(Object.keys(plan.knownGaps ?? {}).filter((id) => !asserted.has(id))).toEqual([]);
    });

    it(`plan ${plan.plan}: has no scenario for a golden that is not its own or not asserted`, () => {
      expect(Object.keys(plan.scenarios).filter((id) => !asserted.has(id))).toEqual([]);
    });

    it(`plan ${plan.plan}: has a scenario for every asserted golden`, () => {
      const missing = own.filter(
        (e) => e.status === "asserted" && scenarioOf(plan, e.id, e.covers) === undefined,
      );
      expect(missing.map((e) => e.id)).toEqual([]);
    });
  }
});

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

function treeNode(number: string): StockTreeNode | undefined {
  let level: readonly StockTreeNode[] = STOCK_TREE;
  let found: StockTreeNode | undefined;
  for (const segment of number.split("-")) {
    found = level.find((n) => n.number.split("-").at(-1) === segment);
    if (found === undefined) return undefined;
    level = found.children ?? [];
  }
  return found;
}

/** A subtree's shape without numbers; profile names (Rename's value) compared as "the profile". */
function shape(node: StockTreeNode, profile: string | undefined): unknown {
  const { number: _number, valueHint, children, ...rest } = node;
  return {
    ...rest,
    valueHint: valueHint !== undefined && valueHint === profile ? "<profile>" : valueHint,
    children: children?.map((child) => shape(child, profile)),
  };
}

/** The scenario of an asserted golden, from the plan that lists it. */
function scenarioFor(e: IndexEntry): (() => void) | undefined {
  const plan = PLAN_OF.get(e.id);
  return plan === undefined ? undefined : scenarioOf(plan, e.id, e.covers);
}

describe("coverage guard (plan 14 D7)", () => {
  const asserted = INDEX.filter((e) => e.status === "asserted");
  const plan13Menus: Readonly<Record<string, string>> = Object.fromEntries(
    MENU_SLUGS.map((slug, i) => [`menu/${slug}.sub`, String(i + 1)]),
  );
  /**
   * Golden → the tree nodes it covers (plan 13's level lists cover the top-level nodes; a plan
   * declares what its hand-written goldens cover).
   */
  const coversOf = (e: IndexEntry): readonly string[] =>
    e.covers ??
    PLAN_OF.get(e.id)?.covers?.[e.id] ??
    (plan13Menus[e.id] === undefined ? [] : [plan13Menus[e.id]!]);

  it("has a scenario for every asserted golden", () => {
    expect(asserted.filter((e) => scenarioFor(e) === undefined).map((e) => e.id)).toEqual([]);
  });

  it("accounts for every node of the stock tree", () => {
    const passing = new Set<string>();
    const gapsOnly = new Set<string>();
    for (const e of asserted) {
      for (const number of coversOf(e)) (KNOWN_GAPS[e.id] ? gapsOnly : passing).add(number);
    }
    const pendingFor = new Map<string, string[]>();
    for (const e of INDEX.filter((x) => x.status.startsWith("pending:"))) {
      for (const number of coversOf(e)) {
        pendingFor.set(number, [...(pendingFor.get(number) ?? []), e.status.slice(8)]);
      }
    }
    const sameAsRoot = (number: string) =>
      Object.keys(SAME_AS).find((root) => number.startsWith(`${root}-`));
    // An option choice or info page is covered by its list's `.options`/`.open` golden (S2/S3:
    // the list's entries; the choice's result is the list signature's `.choose`), asserted, or
    // pending for the plan that owns the choice (Topics, plan 18c).
    const listCovered = (number: string): boolean => {
      const list = number.split("-").slice(0, -1).join("-");
      const node = treeNode(list);
      if (node?.opens.kind !== "option-list" && node?.opens.kind !== "info-pages") return false;
      const owner = placeholderOwner(number);
      return INDEX.some(
        (e) =>
          /\.(options|open)$/.test(e.id) &&
          e.covers?.includes(list) &&
          ((e.status === "asserted" && !KNOWN_GAPS[e.id]) || e.status === `pending:${owner}`),
      );
    };
    const unaccounted: string[] = [];
    const gapNodes: string[] = [];
    for (const number of treeNumbers()) {
      if (passing.has(number) || sameAsRoot(number) !== undefined) continue;
      const owner = placeholderOwner(number);
      if (owner !== undefined && pendingFor.get(number)?.includes(owner)) continue;
      if (listCovered(number)) continue;
      if (gapsOnly.has(number)) gapNodes.push(number);
      else unaccounted.push(number);
    }
    expect(unaccounted, "tree nodes no golden accounts for").toEqual([]);
    // No node may be covered only by known gaps (KNOWN_GAPS holds probes only).
    expect(gapNodes, "tree nodes covered only by known gaps").toEqual([]);
  });

  it("covers Snake II's Continue (added by the bindings, not in the tree) with pause goldens", () => {
    expect(stockMenu.paths()).toContain("menu/games/snake/continue");
    const pause = asserted.filter((e) => e.id.startsWith("game/snake/pause-") && !KNOWN_GAPS[e.id]);
    expect(pause.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        "game/snake/pause-nav",
        "game/snake/pause-list",
        "game/snake/pause-continue",
        "game/snake/pause-continue-turn",
        "game/snake/pause-reenter",
      ]),
    );
    for (const e of pause) expect(scenarioFor(e), e.id).toBeDefined();
  });

  it("covers Snake II's New game (8-1-1) with asserted goldens that pass", () => {
    const covering = asserted.filter((e) => coversOf(e).includes("8-1-1") && !KNOWN_GAPS[e.id]);
    expect(covering.map((e) => e.id)).toEqual(["tree/08-games/8-1-1.leaf"]);
    expect(placeholderOwner("8-1-1")).toBeUndefined();
  });

  it("proves every same-as subtree equal to its model (labels aside from profile names)", () => {
    for (const [copy, model] of Object.entries(SAME_AS)) {
      const a = treeNode(copy)!;
      const b = treeNode(model)!;
      // Profiles' Personalise: the profile's own name (Rename's value) may differ.
      const profileOf = (n: string) => treeNode(n.split("-").slice(0, 2).join("-"))?.label;
      const profileA = copy.startsWith("12-") ? profileOf(copy) : undefined;
      const profileB = model.startsWith("12-") ? profileOf(model) : undefined;
      expect(
        (a.children ?? []).map((child) => shape(child, profileA)),
        `${copy} as ${model}`,
      ).toEqual((b.children ?? []).map((child) => shape(child, profileB)));
    }
  });

  it("shares the importer's placeholder owners and same-as table with the firmware features", () => {
    expect(PLACEHOLDER_OWNERS).toEqual(IMPORTER_PLACEHOLDER_OWNERS);
    expect(SAME_AS).toEqual(IMPORTER_SAME_AS);
  });
});
