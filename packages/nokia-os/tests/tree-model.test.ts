import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import type { TreeJson } from "../scripts/tree-capture-set.ts";
import {
  breakLike,
  buildStockTree,
  harvestRuns,
  linesOf,
  parseResult,
  siblingSlugs,
  type OcrRun,
  type TreeText,
} from "../scripts/tree-model.ts";
import type { StockTreeNode } from "../src/firmware/generated/stock-tree.ts";

const TREE: TreeJson = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures/tree-mini.json"), "utf8"),
);

function run(text: string, font: string, x: number, y: number, inverted = false): OcrRun {
  return { text, font, x, x1: x + 6 * text.length, y, inverted };
}
const index = (number: string): OcrRun => run(number, "tiny6", 84 - 6 * number.length, 0);
const softkey = (text: string): OcrRun => run(text, "bold8", 30, 40);

/** A rows screen with `selected` (of `labels`) inverted in its row band. */
function rows(labels: readonly string[], selected: number, key = "Select"): OcrRun[] {
  return [
    index(`${selected + 1}`),
    ...labels.slice(0, 3).map((label, r) => run(label, "bold8", 2, 8 + 10 * r, r === selected)),
    softkey(key),
  ];
}
/** A page: label lines at 7/16/25 and an optional value. */
function page(lines: readonly string[], value?: string): OcrRun[] {
  return [
    index("9"),
    ...lines.map((line, i) => run(line, "bold8", 0, [7, 16, 25][i]!)),
    ...(value ? [run(value, "plain8", 50, 29)] : []),
    softkey("Select"),
  ];
}
const note = (...lines: string[]): OcrRun[] =>
  lines.map((line, i) => run(line, "large13", 0, [3, 18, 33][i]!));
const unset: OcrRun[] = [index("0"), softkey("Quit")];
const levels = ["Level 1", "Level 2", "Level 3"];
const levelRows = levels.map((_, i) =>
  rows(levels.slice(Math.max(0, i - 2)), Math.min(i, 2), "OK"),
);

const SCROLLS: Record<string, OcrRun[][]> = {
  "1": [
    rows(["Search", "Service Nos.", "Options"], 0),
    rows(["Search", "Service Nos.", "Options"], 1),
    rows(["Search", "Service Nos.", "Options"], 2),
    rows(["Service Nos.", "Options", "Edit"], 2),
  ],
  "1-3": [page(["Type of view"], "Large font"), page(["Memory", "status"])],
  "1-3-1": [
    rows(["Name Iist", "Name, number", "Large font"], 2, "OK"),
    rows(["Name Iist", "Name, number", "Large font"], 0, "OK"),
    rows(["Name Iist", "Name, number", "Large font"], 1, "OK"),
  ],
  "5": [page(["Ringing", "volume"], "Level 1"), page(["Composer"])],
  "5-1": [unset, ...levelRows],
  "12": [rows(["General", "Silent"], 0), rows(["General", "Silent"], 1)],
  "12-1": [rows(["Personalise"], 0, "OK")],
  "12-1-2": [page(["Ringing", "volume"], "Level 1")],
  "12-1-2-1": [unset, ...levelRows],
  "12-2": [rows(["Personalise"], 0, "OK")],
  "12-2-2": [page(["Ringing", "volume"], "Level 1")],
  "12-2-2-1": [unset, ...levelRows],
};

const OPENS: Record<string, OcrRun[][]> = {
  "1-1": [rows(["Search"], 0), [run("Name:", "bold8", 0, 7), softkey("OK")]],
  "1-2": [rows(["Service Nos."], 0), [], note("No phone", "numbers"), rows(["Service Nos."], 0)],
  "1-5": [rows(["Edit"], 0), note("No phone", "numbers"), rows(["Edit"], 0)],
  "1-3-2": [page(["Memory", "status"]), [...note("SIM card:", "50 free"), softkey("Back")]],
  "1-3-1-1": [rows(["Name list"], 0, "OK"), note("Done"), page(["Type of view"], "Name list")],
  "5-1-3": [
    rows(levels, 2, "OK"),
    [
      run("Select maximum", "bold8", 0, 2),
      run("volume for", "bold8", 0, 12),
      run("ringing tone?", "bold8", 0, 22),
      softkey("OK"),
    ],
  ],
  "5-2": [page(["Composer"]), [softkey("Back")]],
};

const TEXT: TreeText = {
  scroll: (number) => SCROLLS[number],
  open: (number) => OPENS[number],
  pages: () => undefined,
};

function find(nodes: readonly StockTreeNode[], number: string): StockTreeNode {
  for (const node of nodes) {
    if (node.number === number) return node;
    if (number.startsWith(`${node.number}-`)) return find(node.children ?? [], number);
  }
  throw new Error(`no node ${number}`);
}

describe("stock tree model", () => {
  const tree = buildStockTree(TREE.root.children, TEXT);

  it("keeps the tree's structure, numbers and hidden gaps", () => {
    expect(tree.map((node) => node.number)).toEqual(["1", "5", "12"]);
    expect(find(tree, "1").children!.map((node) => node.number)).toEqual([
      "1-1",
      "1-2",
      "1-3",
      "1-5",
    ]);
  });

  it("reads rows labels from the selected band and page labels with their line breaks", () => {
    expect(find(tree, "1-2").label).toBe("Service Nos.");
    expect(find(tree, "1-3-2").label).toBe("Memory\nstatus");
    expect(find(tree, "5-1").label).toBe("Ringing\nvolume");
  });

  it("spells a reading that confuses I and l with the tree's characters", () => {
    const options = find(tree, "1-3-1").opens;
    expect(options.kind === "option-list" && options.options[0]!.label).toBe("Name list");
    expect(breakLike(["AII calls'", "duration"], "All calls' duration")).toEqual([
      "All calls'",
      "duration",
    ]);
  });

  it("refuses a reading that does not spell the label, naming the node", () => {
    const wrong: TreeText = {
      ...TEXT,
      scroll: (number) =>
        number === "1-3"
          ? [page(["Type of", "show"]), page(["Memory", "status"])]
          : TEXT.scroll(number),
    };
    expect(() => buildStockTree(TREE.root.children, wrong)).toThrow(
      'tree node 1-3-1: the captured text "Type of / show" (plan14/scroll/1-3) does not spell its label "Type of view"',
    );
  });

  it("gives submenus their presentation, soft key and opening, and pages their value hint", () => {
    expect(find(tree, "1").opens).toEqual({
      kind: "submenu",
      presentation: "rows",
      softkey: "Select",
    });
    expect(find(tree, "1-3").opens).toEqual({
      kind: "submenu",
      presentation: "pages",
      softkey: "Select",
    });
    expect(find(tree, "12-1").opens).toEqual({
      kind: "submenu",
      presentation: "rows",
      softkey: "OK",
    });
    expect(find(tree, "1-3-1").valueHint).toBe("Large font");
    expect(find(tree, "5-1").valueHint).toBe("Level 1");
  });

  it("gives option lists their opening (null when unset) and results with captured lines", () => {
    const view = find(tree, "1-3-1").opens;
    expect(view).toMatchObject({ kind: "option-list", softkey: "OK", opening: 2 });
    const volume = find(tree, "5-1").opens;
    expect(volume).toMatchObject({ kind: "option-list", opening: null });
    if (volume.kind !== "option-list") throw new Error("not a list");
    expect(volume.options.map((option) => option.label)).toEqual(levels);
    expect(volume.options[2]!.result).toEqual({
      kind: "confirm-query",
      lines: ["Select maximum", "volume for", "ringing tone?"],
      softkey: "OK",
    });
    // The same result text in another list reuses the captured lines.
    const copy = find(tree, "12-1-2-1").opens;
    expect(copy.kind === "option-list" && copy.options[2]!.result).toEqual(
      volume.options[2]!.result,
    );
  });

  it("reads leaf screens between the key and the return to a list", () => {
    expect(find(tree, "1-1").opens).toEqual({
      kind: "text-input",
      lines: ["Name:"],
      softkey: "OK",
    });
    expect(find(tree, "1-2").opens).toEqual({ kind: "timed-note", lines: ["No phone", "numbers"] });
    expect(find(tree, "1-3-2").opens).toEqual({
      kind: "info-screen",
      lines: ["SIM card:", "50 free"],
      softkey: "Back",
    });
  });

  it("drops crawl metadata: nodes carry only the documented fields", () => {
    const keys = new Set<string>();
    const walk = (nodes: readonly StockTreeNode[]): void => {
      for (const node of nodes) {
        for (const key of Object.keys(node)) keys.add(key);
        walk(node.children ?? []);
      }
    };
    walk(tree);
    expect([...keys].sort()).toEqual(["children", "label", "number", "opens", "slug", "valueHint"]);
  });

  it("applies label, value hint and kind overrides", () => {
    const fixed = buildStockTree(TREE.root.children, TEXT, {
      labels: { "12-2": "(empty)" },
      valueHints: { "5-1": "(empty)" },
      kinds: { "1-5": "static-note" },
    });
    expect(find(fixed, "12-2").label).toBe("(empty)");
    expect(find(fixed, "5-1").valueHint).toBe("(empty)");
    expect(find(fixed, "1-5").opens.kind).toBe("static-note");
  });

  it("marks a level with a splash intro", () => {
    const games = JSON.parse(
      JSON.stringify(TREE).replace(
        '"highlighted_on_entry":"Personalise"',
        '"highlighted_on_entry":"Personalise","splash_first":true',
      ),
    );
    expect(find(buildStockTree(games.root.children, TEXT), "12-1").opens).toMatchObject({
      intro: true,
    });
  });
});

describe("result summaries", () => {
  it("parse every tree.json form", () => {
    expect(parseResult('timed-note "Done", then back', "x")).toEqual({
      kind: "timed-note",
      lines: ["Done"],
      after: "back",
    });
    expect(parseResult('confirm-query "Are you sure?" [Yes]', "x")).toEqual({
      kind: "confirm-query",
      lines: ["Are you sure?"],
      softkey: "Yes",
    });
    // tree.json writes the firmware's line breaks as " / " (8-1-3-2 `Maze 1` / `selected`).
    expect(parseResult('timed-note "Maze 1 / selected", then back', "x")).toEqual({
      kind: "timed-note",
      lines: ["Maze 1", "selected"],
      after: "back",
    });
    expect(parseResult("returns immediately", "x")).toEqual({ kind: "returns-immediately" });
    expect(parseResult("not probed", "x")).toEqual({ kind: "not-probed" });
    expect(parseResult("option-list", "x")).toEqual({ kind: "option-list" });
    expect(() => parseResult("hologram", "tree node 9-9")).toThrow(
      'tree node 9-9: cannot read the result "hologram"',
    );
  });
});

describe("slugs", () => {
  it("follow plan 13: label slugs, its overrides, and -2… on collisions", () => {
    expect(
      siblingSlugs([
        { number: "2-1", label: "Write\nmessages" },
        { number: "1-7", label: "Send b'card" },
        { number: "5-4-1", label: "(empty)" },
        { number: "5-4-2", label: "(empty)" },
        { number: "8-1", label: "Snake II" },
      ]),
    ).toEqual(["write", "send-bcard", "empty", "empty-2", "snake"]);
  });
});

describe("harvester runs", () => {
  it("map OCR faces to stock fonts with exact bounds and drop lone-glyph noise", () => {
    expect(
      harvestRuns(
        [
          run("Search", "bold8", 2, 8, true),
          run("I", "large13", 51, 7),
          run("1-1", "tiny6", 66, 0),
          run("Level 1", "plain8", 47, 29),
          run("Done", "large13", 0, 3),
        ],
        "x",
      ),
    ).toEqual([
      { font: "small", text: "Search", top: 8, inverted: true, left: 2, right: 37 },
      { font: "digits", text: "1-1", top: 0, left: 66, right: 83 },
      { font: "thin", text: "Level 1", top: 29, left: 47, right: 83 },
      { font: "large", text: "Done", top: 3, left: 0, right: 23 },
    ]);
    expect(() => harvestRuns([run("x", "bold13", 0, 0)], "probe/x a")).toThrow(
      'probe/x a: OCR face "bold13" has no stock font',
    );
  });

  it("drop art read as text: runs with no letter or digit, or only I/l/i/' readings", () => {
    expect(
      harvestRuns(
        [
          run("' '", "large13", 65, 3), // the Clock pages' icon
          run("'I", "bold8", 11, 11), // splash art
          run("_.", "plain8", 43, 0), // splash art
          run(".\u2026\u2026", "plain8", 17, 17), // gameplay dots
          run("\ue000\ue000\ue000", "plain8", 2, 8), // uninitialised-EEPROM boxes
          run("Are you", "bold8", 0, 4),
          run("12", "large13", 61, 24),
        ],
        "x",
      ).map((r) => r.text),
    ).toEqual(["Are you", "12"]);
  });

  it("join runs on one row into a line", () => {
    expect(linesOf([run("Key 2:", "bold8", 0, 7), run("(empty)", "large13", 0, 16)])).toEqual([
      "Key 2:",
      "(empty)",
    ]);
  });
});
