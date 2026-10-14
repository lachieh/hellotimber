// Acceptance: the stock phone, driven by key presses on a virtual 1 ms clock, reproduces every
// asserted golden pixel for pixel, and every timeline within ±2 ms after aligning on the
// transition (D9). A golden marked `asserted` without a scenario here fails (coverage guard);
// `pending` goldens are listed as todos naming their plan.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import type { Golden, GoldenScenario } from "../scripts/golden-format.ts";
import {
  PLACEHOLDER_OWNERS as IMPORTER_PLACEHOLDER_OWNERS,
  SAME_AS as IMPORTER_SAME_AS,
} from "../scripts/tree-capture-set.ts";
import { PLACEHOLDER_OWNERS, placeholderOwner, SAME_AS } from "../src/firmware/bindings";
import { STOCK_TREE, type StockTreeNode } from "../src/firmware/generated/stock-tree";
import type { StockPhoneConfig } from "../src/index";
import {
  expectLcd,
  expectTimeline,
  lcdMismatch,
  TIMING_TOLERANCE_MS,
  type RecordedTimeline,
} from "./support/golden.ts";
import { goto, open } from "./support/drive.ts";
import { PROBE_SCENARIOS } from "./support/probes.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";
import { frameAt, standbyRig, stockRig, type Rig } from "./support/rig.ts";

interface IndexEntry {
  id: string;
  status: string;
  covers?: string[];
}

const INDEX: IndexEntry[] = JSON.parse(
  readFileSync(join(import.meta.dirname, "../goldens/index.json"), "utf8"),
);

/** The kernel's long press: power turns the phone on this long after the key goes down. */
const LONG_PRESS_MS = 800;

/** Menu, then ▼ to carousel item `number` (1-based), with the icon settled. */
function carouselRig(number: number): Rig {
  const rig = standbyRig();
  rig.press("navi");
  for (let i = 1; i < number; i++) rig.press("down");
  rig.advance(6000);
  return rig;
}

/** How long after the trigger a timeline golden ends (the last frame's end, or lower bound). */
function spanAfterTrigger(golden: Golden): number {
  const rows = golden.timeline!;
  const trigger = rows[golden.triggerFrame as number]!;
  const last = rows[rows.length - 1]!;
  return last.startMs + last.durationMs - trigger.startMs;
}

function recordTimeline(rig: Rig, golden: Golden, trigger: () => void): RecordedTimeline {
  return rig.record(spanAfterTrigger(golden) + 100, trigger);
}

const SLUGS = [
  "01-phone-book",
  "02-messages",
  "03-chat",
  "04-call-register",
  "05-tones",
  "06-settings",
  "07-call-divert",
  "08-games",
  "09-calculator",
  "10-reminders",
  "11-clock",
  "12-profiles",
] as const;

/**
 * When each carousel still was shot, in ms after its trigger (Menu for 01, ▼ for the rest).
 * `v639-all.cap` taps the key, records 3 s, then shoots; the recording starts when the tap
 * returns. Measured from REF by aligning each 3 s recording's first icon change with the same
 * change in `menu-anim-long` (whose frame 1 is the trigger), plus 3000 ms.
 */
const STILL_AT_MS: Readonly<Record<(typeof SLUGS)[number], number>> = {
  "01-phone-book": 3576,
  "02-messages": 3545,
  "03-chat": 3566,
  "04-call-register": 3557,
  "05-tones": 3550,
  "06-settings": 3549,
  "07-call-divert": 3544,
  "08-games": 3537,
  "09-calculator": 3551,
  "10-reminders": 3563,
  "11-clock": 3569,
  "12-profiles": 3553,
};

/** From the previous carousel item (or standby for 01), press the key that shows item `n`. */
function revealCarouselItem(n: number): { rig: Rig; trigger: () => void; context: string } {
  if (n === 1) {
    const rig = standbyRig();
    return { rig, trigger: () => rig.press("navi"), context: "standby, Menu" };
  }
  const rig = carouselRig(n - 1);
  return { rig, trigger: () => rig.press("down"), context: `Menu, ▼×${n - 2}, settle, ▼` };
}

function carouselStill(id: string, n: number): void {
  const slug = SLUGS[n - 1]!;
  const { rig, trigger, context } = revealCarouselItem(n);
  const at = STILL_AT_MS[slug];
  const recording = rig.record(at + TIMING_TOLERANCE_MS + 1, trigger);
  const golden = goldenImage(id, slug);
  // Within ±2 ms of a frame boundary either neighbouring frame may have been on screen.
  const shown = new Set(
    [at - TIMING_TOLERANCE_MS, at, at + TIMING_TOLERANCE_MS].map((t) =>
      frameAt(recording, recording.triggerMs + t),
    ),
  );
  if ([...shown].some((frame) => lcdMismatch(frame.pixels, golden, context) === undefined)) return;
  expectLcd(frameAt(recording, recording.triggerMs + at), golden, `${context}, ${at} ms later`);
}

function carouselAnim(id: string, n: number): void {
  const golden = loadGolden(id);
  const { rig, trigger, context } = revealCarouselItem(n);
  expectTimeline(recordTimeline(rig, golden, trigger), golden, context);
}

/** Menu, ▼ to item `n`, Select, then ▼ per image; each image is the screen after its key. */
function levelOne(id: string, n: number, config: Partial<StockPhoneConfig> = {}): void {
  const golden = loadGolden(id);
  const rig = standbyRig(config);
  rig.press("navi");
  rig.advance(100);
  for (let i = 1; i < n; i++) rig.press("down");
  rig.press("navi");
  golden.images.forEach((image, i) => {
    if (i > 0) rig.press("down");
    rig.advance(10);
    expectLcd(rig.paint(), { id, image }, `Menu, ▼×${n - 1}, Select, ▼×${i}`);
  });
}

const SCENARIOS: Record<string, (id: string) => void> = {
  "boot/power-on": (id) => {
    const golden = loadGolden(id);
    const rig = stockRig();
    rig.advance(100);
    rig.hold("power");
    rig.advance(LONG_PRESS_MS - 2);
    // The trigger is the tick on which the held power key turns the phone on.
    const recording = recordTimeline(rig, golden, () => {
      rig.advance(1);
      rig.release("power");
    });
    expectTimeline(recording, golden, "hold power until the phone turns on");
    expectLcd(rig.paint(), goldenImage("standby/standby", "01-standby"), "after boot");
  },
  "standby/standby": (id) => {
    expectLcd(standbyRig().paint(), goldenImage(id, "01-standby"), "power on (boot skipped)");
  },
  "standby/standby-1948": (id) => {
    const rig = standbyRig({ clock: () => "19:48" });
    expectLcd(rig.paint(), goldenImage(id, "standby"), "power on at 19:48");
  },
  "standby/standby-0759": (id) => {
    const rig = standbyRig({ clock: () => "07:59" });
    expectLcd(rig.paint(), goldenImage(id, "standby"), "power on at 07:59");
  },
  "standby/idle": (id) => {
    const rig = standbyRig();
    expectTimeline(rig.record(10_000), loadGolden(id), "standby, no key for 10 s");
  },
  "menu/revisit.anim": (id) => {
    const golden = loadGolden(id);
    const rig = carouselRig(12);
    expectTimeline(
      recordTimeline(rig, golden, () => rig.press("up")),
      golden,
      "Profiles, ▲",
    );
  },
  "menu/return.anim": (id) => {
    const golden = loadGolden(id);
    const rig = carouselRig(11);
    rig.press("navi");
    rig.advance(2000);
    expectTimeline(
      recordTimeline(rig, golden, () => rig.press("c")),
      golden,
      "Clock, Select, 2 s, C",
    );
  },
  "menu/01-phone-book.sub-up": (id) => {
    const golden = loadGolden(id);
    const rig = standbyRig();
    rig.press("navi");
    rig.advance(100);
    rig.press("navi");
    for (let i = 0; i < 5; i++) rig.press("down");
    golden.images.forEach((image, i) => {
      if (i > 0) rig.press("up");
      rig.advance(10);
      expectLcd(rig.paint(), { id, image }, `Phone book, ▼×5, ▲×${i}`);
    });
  },
  "menu/11-clock.sub-1948": (id) => levelOne(id, 11, { clock: () => "19:48" }),
  "menu/11-clock.sub-0759": (id) => levelOne(id, 11, { clock: () => "07:59" }),
};
Object.assign(SCENARIOS, PROBE_SCENARIOS);
SLUGS.forEach((slug, i) => {
  SCENARIOS[`menu/${slug}`] = (id) => carouselStill(id, i + 1);
  SCENARIOS[`menu/${slug}.anim`] = (id) => carouselAnim(id, i + 1);
  // Chat and Calculator open placeholders; their captured first screens are pending goldens.
  if (slug !== "03-chat" && slug !== "09-calculator") {
    SCENARIOS[`menu/${slug}.sub`] = (id) => levelOne(id, i + 1);
  }
});

/** After `goto`, the kernel's and the widgets' timers settle before the trigger. */
const SETTLE_MS = 3000;

/**
 * `golden` with every row that shows frame 0's image (the parent screen before the trigger, and
 * the same screen when the note returns) replaced by `parent`: a shared golden's image `a` is its
 * first covered node's parent, so the other covered nodes compare against their own (Task 2
 * deviation).
 */
function withOwnParent(golden: Golden, parent: Uint8Array): Golden {
  const rows = golden.timeline!;
  const frame0 = rows[(golden.triggerFrame as number) - 1]!.image;
  const name = "own-parent";
  return {
    ...golden,
    images: [...golden.images, { name, pixels: parent }],
    timeline: rows.map((row) => (row.image === frame0 ? { ...row, image: name } : row)),
  };
}

/** Opens `number` and compares one image per ▼ (`list`, `options`) or the first (`open`). */
function treeStills(id: string, number: string, scenario: "list" | "options" | "open"): void {
  const golden = loadGolden(id);
  const rig = standbyRig();
  open(rig, number);
  const images = scenario === "open" ? golden.images.slice(0, 1) : golden.images;
  images.forEach((image, i) => {
    if (i > 0) rig.press("down");
    rig.advance(10);
    expectLcd(rig.paint(), { id, image }, `open ${number}, ▼×${i}`);
  });
}

/**
 * Highlights `number` in its parent (an option in its open list), settles, then records Select
 * (OK) as the trigger. The first covered node also matches frame 0; the others compare frame 0's
 * rows with their own parent screen.
 */
function treeTimeline(id: string, number: string, first: boolean): void {
  const golden = loadGolden(id);
  const rig = standbyRig();
  goto(rig, number);
  rig.advance(SETTLE_MS);
  const parent = rig.paint().pixels;
  const context = `${number} highlighted, Select`;
  if (golden.triggerFrame === 0) {
    // The key changes nothing (Polish): the screen stays as long as the recording ran.
    const still = golden.timeline![0]!;
    if (first) expectLcd({ pixels: parent }, goldenImage(id, still.image), `${number} highlighted`);
    const recording = rig.record(still.durationMs, () => rig.press("navi"));
    expect(recording.frames.length, `${context}: the screen changed`).toBe(1);
    return;
  }
  const frame0 = golden.timeline![(golden.triggerFrame as number) - 1]!.image;
  if (first) expectLcd({ pixels: parent }, goldenImage(id, frame0), `${number} highlighted`);
  const recording = recordTimeline(rig, golden, () => rig.press("navi"));
  expectTimeline(recording, first ? golden : withOwnParent(golden, parent), context);
}

/** The generic scenario of a generated tree golden (plan 14 D7), per covered node. */
function treeScenario(id: string, covers: readonly string[]): void {
  const golden = loadGolden(id);
  const scenario: GoldenScenario | undefined = golden.scenario;
  if (scenario === undefined) throw new Error(`${id} declares no scenario.`);
  covers.forEach((number, i) => {
    if (scenario === "leaf" || scenario === "choose") treeTimeline(id, number, i === 0);
    else treeStills(id, number, scenario);
  });
}

const SCREEN_SAVER_WINDOW =
  "entering Screen saver shows its number and dots for ≈2.9 s (D14); needs a kernel seam";
const TOP_SCORE_WINDOW =
  "Top score returns with the window rebuilt at Top score (`Top score / Score IDs / " +
  "Instructions`); the kernel's exit({ select }) puts the child on the bottom row";
const LATENCY =
  "kernel timers run from the key, the firmware's from its jittered redraw (a typed entry " +
  "opens 1431-1477 ms after its digit's redraw; `8` draws a 16 ms partial frame), D8";
const STANDBY_DIGITS =
  "after Invalid shortcut, digits and C at standby start a number (out of scope, D14)";
const TOP_SCORE_JITTER =
  "this recording's Top score steps run 3-16 ms off tree/08-games/8-1-4.leaf, whose timeline " +
  "the note plays (same Select path)";

/**
 * Asserted goldens whose scenario cannot pass yet, each with its reason: a kernel seam beyond
 * plan 14's contracts, capture jitter between recordings of the same path that exceeds ±2 ms,
 * the key-to-redraw latency D8 does not reproduce, or behaviour outside plan 14. Their scenarios
 * run as expected failures, so a gap that starts passing must leave this table.
 */
const KNOWN_GAPS: Readonly<Record<string, string>> = {
  "tree/05-tones/5-9.sub": SCREEN_SAVER_WINDOW,
  "tree/05-tones/5-9-1.leaf": SCREEN_SAVER_WINDOW,
  "tree/12-profiles/12-1-2-9.sub": SCREEN_SAVER_WINDOW,
  "tree/12-profiles/12-1-2-9-1.leaf": SCREEN_SAVER_WINDOW,
  "tree/12-profiles/12-2-2-9.sub": SCREEN_SAVER_WINDOW,
  "tree/12-profiles/12-2-2-9-1.leaf": SCREEN_SAVER_WINDOW,
  "tree/08-games/8-2-2.leaf": TOP_SCORE_WINDOW,
  "tree/08-games/8-4-1-3.leaf": TOP_SCORE_WINDOW,
  "tree/08-games/8-4-2-3.leaf": TOP_SCORE_WINDOW,
  "probe/games-top-score-wait": TOP_SCORE_JITTER,
  "probe/games-top-score-c-2s": TOP_SCORE_JITTER,
  "probe/games-top-score-down-2s": `${TOP_SCORE_JITTER}; ▼ also returns to New game and then moves to Level (two moves)`,
  "probe/games-splash-skip-c":
    "the first splash step lasts 252 ms here, 248 ms in probe/games-splash-8-1 (same Select path)",
  "probe/games-splash-skip-down":
    "the first splash step lasts 252 ms here, 248 ms in probe/games-splash-8-1 (same Select path)",
  "probe/games-splash-skip-menu":
    "the first splash step lasts 252 ms here, 248 ms in probe/games-splash-8-1 (same Select path)",
  "probe/progress-6-2-4-2-c":
    "this recording's bar steps run 7-22 ms off tree/06-settings/6-2-4-2.leaf's (same path)",
  "probe/note-keys-done-down-300":
    "the 16 ms partial draw before Done covers fewer LCD bytes than in tree/01-phone-book/1-8-1-1.choose",
  "probe/reenter":
    "Phone book's carousel return (after C) has no captured timeline; ≈2.1 s later the icon shows another frame",
  "probe/confirm-10-3-2-yes":
    "after Erase › All the firmware hides View all and Erase (image d): reminder data, plan 21",
  "probe/shortcut-m1": LATENCY,
  "probe/shortcut-m1-1-0": LATENCY,
  "probe/shortcut-m1-2": LATENCY,
  "probe/shortcut-m1-wait-9": LATENCY,
  "probe/shortcut-m8-1": LATENCY,
  "probe/shortcut-m8-1-2": LATENCY,
  "probe/shortcut-m8-6": LATENCY,
  "probe/shortcut-m8-6-3": LATENCY,
  "probe/shortcut-m1-8-1": STANDBY_DIGITS,
  "probe/shortcut-m1-8-1-2": STANDBY_DIGITS,
  "probe/shortcut-m1-9-c": STANDBY_DIGITS,
};

/** The scenario of an asserted golden: hand-written (plan 13, probes) or generic (tree). */
function scenarioOf(id: string, covers: readonly string[] | undefined): (() => void) | undefined {
  const scenario = SCENARIOS[id];
  if (scenario !== undefined) return () => scenario(id);
  if (covers !== undefined) return () => treeScenario(id, covers);
  return undefined;
}

describe("stock phone against every asserted v6.39 golden", () => {
  for (const { id, status, covers } of INDEX) {
    if (status !== "asserted") {
      it.todo(`${id} (${status.replace("pending:", "pending: plan ")})`);
      continue;
    }
    const scenario = scenarioOf(id, covers);
    const gap = KNOWN_GAPS[id];
    if (gap !== undefined && scenario !== undefined) {
      it.fails(`${id} (known gap: ${gap})`, scenario);
      continue;
    }
    it(id, () => {
      if (scenario === undefined) throw new Error(`no scenario for ${id}`);
      scenario();
    });
  }

  it("lists only asserted goldens as known gaps", () => {
    const asserted = new Set(INDEX.filter((e) => e.status === "asserted").map((e) => e.id));
    expect(Object.keys(KNOWN_GAPS).filter((id) => !asserted.has(id))).toEqual([]);
  });

  it("has no scenario for a golden that is missing or not asserted", () => {
    const asserted = new Set(INDEX.filter((e) => e.status === "asserted").map((e) => e.id));
    expect(Object.keys(SCENARIOS).filter((id) => !asserted.has(id))).toEqual([]);
  });
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

describe("coverage guard (plan 14 D7)", () => {
  const asserted = INDEX.filter((e) => e.status === "asserted");
  const plan13Menus: Readonly<Record<string, string>> = Object.fromEntries(
    SLUGS.map((slug, i) => [`menu/${slug}.sub`, String(i + 1)]),
  );
  /** Golden → the tree nodes it covers (plan 13's level lists cover the top-level nodes). */
  const coversOf = (e: IndexEntry): readonly string[] =>
    e.covers ?? (plan13Menus[e.id] === undefined ? [] : [plan13Menus[e.id]!]);

  it("has a scenario for every asserted golden", () => {
    expect(
      asserted.filter((e) => scenarioOf(e.id, e.covers) === undefined).map((e) => e.id),
    ).toEqual([]);
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
    // pending for the plan that owns the choice (Topics, plan 18).
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
    // Nodes whose only goldens are known gaps (KNOWN_GAPS): listed so they cannot grow silently.
    expect(gapNodes).toEqual([
      "5-9",
      "5-9-1",
      "8-2-2",
      "8-4-1-3",
      "8-4-2-3",
      "12-1-2-9",
      "12-1-2-9-1",
      "12-2-2-9",
      "12-2-2-9-1",
    ]);
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

  it("shares the importer's placeholder owners and same-as table with the firmware bindings", () => {
    expect(PLACEHOLDER_OWNERS).toEqual(IMPORTER_PLACEHOLDER_OWNERS);
    expect(SAME_AS).toEqual(IMPORTER_SAME_AS);
  });
});

describe("scenario rig", () => {
  it("starts a frame at power-on although boot's first image is as blank as off", () => {
    const rig = stockRig();
    rig.hold("power");
    rig.advance(LONG_PRESS_MS - 2);
    const recording = rig.record(10, () => rig.advance(1));
    expect(recording.frames.map((frame) => frame.startMs)).toEqual([LONG_PRESS_MS - 2, 800]);
    expect(recording.frames[1]!.pixels).toEqual(recording.frames[0]!.pixels);
    expect(recording.triggerMs).toBe(LONG_PRESS_MS);
  });

  it("keeps only frames whose pixels change", () => {
    // A placeholder application marks the screen dirty on every tick.
    const rig = standbyRig();
    rig.phone.navigate("menu/phone-book/search");
    const recording = rig.record(500);
    expect(recording.frames).toHaveLength(1);
  });
});
