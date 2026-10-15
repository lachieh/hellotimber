// Plan 18 Task 12: what plan 18's acceptance covers. The leaves its features bind are covered by
// asserted goldens (MESSAGES_COVERS, collected by the coverage guard); every multi-tap Options
// entry has an asserted golden; the goldens plan 18 hands on name their plan.
import { describe, expect, it } from "vite-plus/test";
import { readPlanIndex } from "../scripts/golden-index.ts";
import { MESSAGES_LATER } from "../scripts/messages-capture-set.ts";
import { EDITOR_OPTIONS } from "../src/messages/bindings";
import { SCREENS } from "../src/firmware/stock";
import { GOLDENS } from "./support/acceptance.ts";
import { MESSAGES_COVERS } from "./support/messages.ts";

const OWN = readPlanIndex(GOLDENS, "18");
const ASSERTED = new Set(OWN.filter((e) => e.status === "asserted").map((e) => e.id));

/** The leaves plan 18 binds (Tasks 8, 10, 11). */
const BOUND = ["2-1", "2-2", "2-3", "2-7-1-1", "2-7-2-1", "2-9", "6-2-3"];

describe("plan 18's coverage", () => {
  it("binds its leaves, each covered by an asserted golden of its own", () => {
    for (const number of BOUND) expect(SCREENS[number], number).toBeDefined();
    const covered = Object.entries(MESSAGES_COVERS).flatMap(([id, numbers]) => {
      expect(ASSERTED.has(id), id).toBe(true);
      return numbers;
    });
    expect([...covered].sort()).toEqual([...BOUND].sort());
  });

  it("asserts a golden for every multi-tap Options entry; later owners are named", () => {
    for (const option of EDITOR_OPTIONS)
      expect(ASSERTED.has(option.golden), option.label).toBe(true);
    // The Cyrillic dictionaries are plan 26's (plan 18b D11).
    expect(EDITOR_OPTIONS.filter((o) => o.owner !== undefined).map((o) => o.owner)).toEqual([
      "19",
      "18c",
      "18c",
      "26",
    ]);
  });

  it("asserts every golden but the ones it hands on to a later plan", () => {
    const pending = OWN.filter((e) => e.status !== "asserted");
    expect(pending.map((e) => [e.id, e.status])).toEqual(
      Object.entries(MESSAGES_LATER)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([id, plan]) => [id, `pending:${plan}`]),
    );
  });
});
