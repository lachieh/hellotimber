import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import type { CaptureSetEntry } from "../scripts/capture-set.ts";
import {
  matchesPattern,
  placeholderOwner,
  sameResponse,
  treeCaptureSet,
  type RecordingFrame,
  type TreeCaptureIo,
  type TreeJson,
} from "../scripts/tree-capture-set.ts";

const TREE: TreeJson = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures/tree-mini.json"), "utf8"),
);
const TABLES = { sameAs: { "12-2-2": "12-1-2" }, placeholders: { "5-2": "16" } };

/** Frames from `[image, durationMs]` pairs, chained from 0. */
function frames(...steps: [string, number][]): RecordingFrame[] {
  let start = 0;
  return steps.map(([image, durationMs]) => {
    const frame = { image, startMs: start, durationMs };
    start += durationMs;
    return frame;
  });
}

const RECORDINGS: Record<string, RecordingFrame[]> = {
  "1-1": frames(["list-1-1", 60], ["name-prompt", 5000]),
  "1-2": frames(["list-1-2", 70], ["no-numbers", 2900], ["list-1-2", 2000]),
  "1-5": frames(["list-1-5", 55], ["no-numbers", 2902], ["list-1-5", 2000]),
  "1-3-2": frames(["page-1-3-2", 50], ["memory", 5000]),
  "1-3-1-1": frames(["options-1", 60], ["done-a", 700], ["done-b", 750], ["page-name-list", 3000]),
  "5-1-1": frames(["unset-1", 60], ["done-a", 700], ["done-b", 750], ["page-level-1", 3000]),
  "5-1-3": frames(["unset-3", 60], ["query", 5000]),
  "5-2": frames(["page-2-2", 60], ["editor", 5000]),
};

/** Every scroll holds its list's entries plus the two wrap images. */
const SCROLLS: Record<string, number> = {
  "1-3": 4,
  "1-3-1": 5,
  "5-1": 5,
  "12-1": 3,
  "12-1-2": 3,
  "12-1-2-1": 5,
  "12-2": 3,
  "12-2-2": 3,
};

function io(overrides: Partial<Record<string, RecordingFrame[] | undefined>> = {}): TreeCaptureIo {
  const recordings: Record<string, RecordingFrame[] | undefined> = { ...RECORDINGS, ...overrides };
  return {
    recording: (dir) => recordings[dir.replace("plan14/open/", "")],
    scrollImages: (dir) => {
      const count = SCROLLS[dir.replace("plan14/scroll/", "")];
      return count === undefined
        ? undefined
        : Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, "0"));
    },
  };
}

function byId(entries: readonly CaptureSetEntry[]): Map<string, CaptureSetEntry> {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

describe("tree capture set (plan 14 S1-S8)", () => {
  const entries = treeCaptureSet(TREE, io(), TABLES);
  const ids = byId(entries);

  it("selects one golden per rule, below the carousel, outside same-as subtrees", () => {
    expect([...ids.keys()].sort()).toEqual(
      [
        // S1: submenus below level 1 (same-as roots keep their own list)
        "tree/01-phone-book/1-3.sub",
        "tree/12-profiles/12-1.sub",
        "tree/12-profiles/12-1-2.sub",
        "tree/12-profiles/12-2.sub",
        "tree/12-profiles/12-2-2.sub",
        // S2: the first list of each signature; S3: later lists with that signature
        "tree/01-phone-book/1-3-1.options",
        "tree/05-tones/5-1.options",
        "tree/12-profiles/12-1-2-1.open",
        // S4: leaves, equal recordings shared; S8: placeholder leaves (pending)
        "tree/01-phone-book/1-1.leaf",
        "tree/01-phone-book/1-2.leaf",
        "tree/01-phone-book/1-3-2.leaf",
        "tree/05-tones/5-2.leaf",
        // S5: one ▼ from the opening state, plus results that differ from their siblings'
        "tree/01-phone-book/1-3-1-1.choose",
        "tree/05-tones/5-1-1.choose",
        "tree/05-tones/5-1-3.choose",
      ].sort(),
    );
  });

  it("gives lists their scenario, the node they cover, and omits the wrap images", () => {
    const sub = ids.get("tree/01-phone-book/1-3.sub")!;
    expect(sub).toMatchObject({
      kind: "still",
      status: "asserted",
      scenario: "list",
      covers: ["1-3"],
      prefer: {
        source: { kind: "scroll", dir: "plan14/scroll/1-3" },
        omitted: { "03": "past the wrap", "04": "past the wrap" },
      },
    });
    const options = ids.get("tree/01-phone-book/1-3-1.options")!;
    expect(options.scenario).toBe("options");
    expect(Object.keys(options.prefer.omitted!)).toEqual(["04", "05"]);
    // An unset list shows its no-highlight state first: one more image than entries.
    expect(Object.keys(ids.get("tree/05-tones/5-1.options")!.prefer.omitted!)).toEqual(["05"]);
    expect(ids.get("tree/12-profiles/12-1-2-1.open")).toMatchObject({
      scenario: "open",
      covers: ["12-1-2-1"],
      prefer: { source: { kind: "shot", file: "plan14/scroll/12-1-2-1/01.png" } },
    });
  });

  it("shares a leaf golden between leaves whose recordings match after the trigger", () => {
    expect(ids.get("tree/01-phone-book/1-2.leaf")).toMatchObject({
      kind: "timeline",
      scenario: "leaf",
      covers: ["1-2", "1-5"],
      prefer: { source: { kind: "recording", dir: "plan14/open/1-2" }, triggerFrame: 1 },
    });
    expect(ids.get("tree/01-phone-book/1-1.leaf")!.covers).toEqual(["1-1"]);
  });

  it("asserts an early placeholder leaf, keeping its first 40 frames (plan 23: 8-1-1)", () => {
    const long = frames(
      ["page-2-2", 60],
      ...Array.from({ length: 60 }, (_, i): [string, number] => [`game-${i}`, 8]),
    );
    const entry = byId(
      treeCaptureSet(TREE, io({ "5-2": long }), { ...TABLES, assertedEarly: { "5-2": "16" } }),
    ).get("tree/05-tones/5-2.leaf")!;
    expect(entry.status).toBe("asserted");
    expect(entry.prefer.source).toEqual({
      kind: "composite",
      parts: [{ dir: "plan14/open/5-2", from: 0, to: 39 }],
    });
    expect(entry.prefer.omitted).toEqual({
      "040-060": "after the first 40 frames; plan 16's game goldens assert the rest",
    });
  });

  it("marks placeholder leaves pending on their owner plan", () => {
    expect(ids.get("tree/05-tones/5-2.leaf")!.status).toBe("pending:16");
    expect(ids.get("tree/01-phone-book/1-1.leaf")!.status).toBe("asserted");
  });

  it("chooses options and covers the option numbers", () => {
    expect(ids.get("tree/05-tones/5-1-3.choose")).toMatchObject({
      scenario: "choose",
      covers: ["5-1-3"],
      prefer: { source: { kind: "recording", dir: "plan14/open/5-1-3" }, triggerFrame: 1 },
    });
  });

  it("chooses every option when no result repeats (each differs from its siblings')", () => {
    // 4-4 Erase recent call lists: All / Missed / Dialled / Received each name their own list.
    // Type of view with a distinct result per option, opening on its first option (which is then
    // not the one ▼ from the opening state).
    const tree: TreeJson = JSON.parse(JSON.stringify(TREE), (_key, value: unknown) => {
      const n = /^1-3-1-(\d)$/.exec((value as { number?: unknown } | null)?.number as string)?.[1];
      return n === undefined
        ? value
        : {
            ...(value as object),
            result: `timed-note "View ${n} set", then back`,
            highlighted_on_entry: n === "1",
          };
    });
    const recorded = {
      "1-3-1-2": frames(["options-2", 60], ["set-2", 1450], ["page-name-list", 3000]),
      "1-3-1-3": frames(["options-3", 60], ["set-3", 1450], ["page-name-list", 3000]),
    };
    const chosen = [...byId(treeCaptureSet(tree, io(recorded), TABLES)).keys()].filter((id) =>
      id.endsWith(".choose"),
    );
    expect(chosen.filter((id) => id.includes("/1-3-1-")).sort()).toEqual([
      "tree/01-phone-book/1-3-1-1.choose",
      "tree/01-phone-book/1-3-1-2.choose",
      "tree/01-phone-book/1-3-1-3.choose",
    ]);
  });

  it("does not share recordings whose steps differ by more than 2 ms", () => {
    const late = frames(["list-1-5", 55], ["no-numbers", 2903], ["list-1-5", 2000]);
    const split = byId(treeCaptureSet(TREE, io({ "1-5": late }), TABLES));
    expect(split.get("tree/01-phone-book/1-2.leaf")!.covers).toEqual(["1-2"]);
    expect(split.get("tree/01-phone-book/1-5.leaf")!.covers).toEqual(["1-5"]);
  });

  it("throws naming the node for a missing capture", () => {
    expect(() => treeCaptureSet(TREE, io({ "1-3-2": undefined }), TABLES)).toThrow(
      "tree node 1-3-2: missing capture plan14/open/1-3-2",
    );
  });

  it("throws naming the node for an unknown leaf kind", () => {
    const tree = JSON.parse(JSON.stringify(TREE).replace('"text-input"', '"hologram"'));
    expect(() => treeCaptureSet(tree, io(), TABLES)).toThrow(
      'tree node 1-1: unknown leaf kind "hologram"',
    );
  });
});

describe("recording equality", () => {
  it("ignores the starting screen and the return to it, but not whether it returns", () => {
    const a = frames(["x", 10], ["note", 1450], ["x", 100]);
    const b = frames(["y", 90], ["note", 1451], ["y", 100]);
    const stays = frames(["y", 90], ["note", 1451]);
    expect(sameResponse(a, b)).toBe(true);
    expect(sameResponse(a, stays)).toBe(false);
  });

  it("treats a recording with no change as nothing happening", () => {
    expect(sameResponse(frames(["x", 5000]), frames(["y", 5000]))).toBe(true);
    expect(sameResponse(frames(["x", 5000]), frames(["y", 10], ["z", 5000]))).toBe(false);
  });
});

describe("placeholder patterns", () => {
  it("match one segment per *, and everything below with -**", () => {
    expect(matchesPattern("12-3-1", "12-*-1")).toBe(true);
    expect(matchesPattern("12-3-1-1", "12-*-1")).toBe(false);
    expect(matchesPattern("2-8-4-1", "2-8-4-1-**")).toBe(true);
    expect(matchesPattern("2-8-4-1-3", "2-8-4-1-**")).toBe(true);
    expect(matchesPattern("2-8-4", "2-8-4-1-**")).toBe(false);
    expect(placeholderOwner("5-4-7")).toBeUndefined();
    expect(placeholderOwner("5-4")).toBeUndefined();
    expect(placeholderOwner("12-6-2-9-4")).toBe("18c");
  });
});

describe("plan 15 placeholder owners (D12)", () => {
  it("re-owns the Welcome note editor to plan 18 and the Cyrillic languages to plan 26", () => {
    expect(placeholderOwner("6-2-3")).toBe("18");
    expect(["6-2-1-3", "6-2-1-4", "6-2-1-5"].map((n) => placeholderOwner(n))).toEqual([
      "26",
      "26",
      "26",
    ]);
  });
});
