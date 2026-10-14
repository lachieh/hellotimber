// Generic key-driven navigation for the tree goldens (plan 14 Task 13, D7).
import { describe, expect, it } from "vite-plus/test";
import type { StockTreeNode } from "../src/firmware/generated/stock-tree";
import { gotoSteps, openSteps, type DriveStep } from "./support/drive.ts";

const note = { kind: "timed-note", lines: ["Done"], after: "back" } as const;
const leaf = (number: string, slug: string): StockTreeNode => ({
  number,
  slug,
  label: slug,
  opens: note,
});
const options = (labels: readonly string[]) =>
  labels.map((label) => ({ label, result: note }) as const);

/** A dozen nodes: rows and pages levels, a hidden gap, openings, an intro and option lists. */
const TREE: readonly StockTreeNode[] = [
  {
    number: "1",
    slug: "book",
    label: "Book",
    opens: { kind: "submenu", presentation: "rows", softkey: "Select" },
    children: [
      leaf("1-1", "search"),
      leaf("1-2", "add"),
      {
        number: "1-3",
        slug: "opts",
        label: "Opts",
        opens: { kind: "submenu", presentation: "pages", softkey: "Select", opening: "view" },
        children: [
          leaf("1-3-1", "size"),
          {
            number: "1-3-2",
            slug: "view",
            label: "View",
            opens: {
              kind: "option-list",
              softkey: "OK",
              opening: 2,
              options: options(["A", "B", "C"]),
            },
          },
          {
            number: "1-3-3",
            slug: "tone",
            label: "Tone",
            opens: {
              kind: "option-list",
              softkey: "OK",
              opening: null,
              options: options(["X", "Y"]),
            },
          },
        ],
      },
    ],
  },
  {
    number: "2",
    slug: "games",
    label: "Games",
    opens: { kind: "submenu", presentation: "rows", softkey: "Select" },
    children: [
      {
        number: "2-1",
        slug: "snake",
        label: "Snake",
        opens: { kind: "submenu", presentation: "rows", softkey: "Select", intro: true },
        children: [leaf("2-1-1", "new-game"), leaf("2-1-2", "level")],
      },
      // Menu number 3 follows 1: number 2 is hidden.
      leaf("2-3", "settings"),
    ],
  },
];

const introMs = (number: string) => (number === "2-1" ? 2500 : 0);
const keys = (steps: readonly DriveStep[]) =>
  steps.map((step) => ("key" in step ? step.key : `wait ${step.waitMs}`));

describe("gotoSteps: real keys from a settled standby to the node highlighted in its parent", () => {
  it("highlights a top-level entry on the carousel", () => {
    expect(keys(gotoSteps(TREE, "2", { introMs }))).toEqual(["navi", "wait 100", "down"]);
  });

  it("selects through rows and pages levels, ▼ from the opening item", () => {
    expect(keys(gotoSteps(TREE, "1-2", { introMs }))).toEqual(["navi", "wait 100", "navi", "down"]);
    // Opts opens on View (index 1): ▼ wraps from View past Tone to Size.
    expect(keys(gotoSteps(TREE, "1-3-1", { introMs }))).toEqual([
      "navi",
      "wait 100",
      "navi",
      "down",
      "down",
      "navi",
      "down",
      "down",
    ]);
    expect(keys(gotoSteps(TREE, "1-3-3", { introMs })).slice(-1)).toEqual(["down"]);
  });

  it("counts visible positions, not menu numbers, across a hidden gap", () => {
    expect(keys(gotoSteps(TREE, "2-3", { introMs }))).toEqual([
      "navi",
      "wait 100",
      "down",
      "navi",
      "down",
    ]);
  });

  it("waits out a level's intro after Select", () => {
    expect(keys(gotoSteps(TREE, "2-1-2", { introMs }))).toEqual([
      "navi",
      "wait 100",
      "down",
      "navi",
      "navi",
      "wait 2600",
      "down",
    ]);
  });

  it("opens an option list and ▼ to the option, from its opening value or the unset state", () => {
    // Opts opens on View; View opens on C (index 2): ▼ wraps to A.
    expect(keys(gotoSteps(TREE, "1-3-2-1", { introMs }))).toEqual([
      "navi",
      "wait 100",
      "navi",
      "down",
      "down",
      "navi",
      "navi",
      "down",
    ]);
    // Tone opens unset: the first ▼ selects X (P10).
    expect(keys(gotoSteps(TREE, "1-3-3-2", { introMs })).slice(-3)).toEqual([
      "navi",
      "down",
      "down",
    ]);
  });

  it("opens the node with Select (openSteps)", () => {
    expect(keys(openSteps(TREE, "1-2", { introMs }))).toEqual([
      "navi",
      "wait 100",
      "navi",
      "down",
      "navi",
    ]);
    expect(keys(openSteps(TREE, "2-1", { introMs })).slice(-2)).toEqual(["navi", "wait 2600"]);
  });

  it("names a node that does not exist", () => {
    expect(() => gotoSteps(TREE, "1-4", { introMs })).toThrow("No tree node 1-4");
    expect(() => gotoSteps(TREE, "1-2-1", { introMs })).toThrow("No tree node 1-2-1");
  });
});
