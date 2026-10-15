// Plan 18b's promotion pre-flight (plan 29's pending workflow, clean-room hand-off): goldens whose
// id is in T9_PROMOTED but whose index still says `pending:18b` (the importer, which reads the
// dirty-room captures, has not run since) play their acceptance scenario here, so a promotion is
// known to pass before the bridge re-imports. Once it has, the acceptance file runs them and
// nothing is left here. The same holds for Write messages' tree golden (PENDING_LATER).
import { describe, expect, it } from "vite-plus/test";
import { readPlanIndex } from "../scripts/golden-index.ts";
import { T9_PROMOTED } from "../scripts/t9-capture-set.ts";
import { PENDING_LATER } from "../scripts/tree-capture-set.ts";
import { GOLDENS, scenarioOf } from "./support/acceptance.ts";
import { t9Scenario, T9_KNOWN_GAPS } from "./support/t9.ts";

const OWN = readPlanIndex(GOLDENS, "18b");
const WAITING = OWN.filter((entry) => T9_PROMOTED.has(entry.id) && entry.status !== "asserted");
const LEAF = readPlanIndex(GOLDENS, "14").find((e) => e.id === "tree/02-messages/2-1.leaf")!;

describe("T9 goldens promoted, awaiting the re-import", () => {
  it("promotes only imported goldens", () => {
    const ids = new Set(OWN.map((entry) => entry.id));
    expect([...T9_PROMOTED].filter((id) => !ids.has(id))).toEqual([]);
  });

  for (const { id } of WAITING) {
    const gap = T9_KNOWN_GAPS[id];
    (gap === undefined ? it : it.fails)(`${id}${gap === undefined ? "" : " (known gap)"}`, () =>
      t9Scenario(id),
    );
  }

  if (LEAF.status !== "asserted" && PENDING_LATER["2-1"] === undefined) {
    it(LEAF.id, () => {
      const scenario = scenarioOf({ plan: "14", scenarios: {} }, LEAF.id, LEAF.covers);
      expect(scenario).toBeDefined();
      scenario!();
    });
  }
});
