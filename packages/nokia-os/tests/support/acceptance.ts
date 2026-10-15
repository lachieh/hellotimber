// The acceptance harness (plan 13 "Scenario harness and coverage guard"). Each plan has one file,
// `tests/acceptance/<NN>-<slug>.test.ts`, that calls `acceptancePlan` with its scenarios and known
// gaps; it runs the goldens of `goldens/index/<NN>.json` (one `it` each, so plan files run in
// parallel). A golden marked `asserted` without a scenario fails; `pending` goldens are listed as
// todos naming their plan. `tests/acceptance/coverage-guard.test.ts` imports every plan file in
// collection mode (`collectAcceptancePlans`) and checks them together.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import type { Golden, GoldenScenario } from "../../scripts/golden-format.ts";
import {
  readGoldenIndex,
  readPlanIndex,
  type GoldenIndexEntry as IndexEntry,
} from "../../scripts/golden-index.ts";
import { expectLcd, expectTimeline, type RecordedTimeline } from "./golden.ts";
import { goto, open } from "./drive.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { standbyRig, type Rig } from "./rig.ts";

export type { IndexEntry };

export const GOLDENS = join(import.meta.dirname, "../../goldens");

/** Every plan's goldens, sorted by id. */
export const INDEX: readonly IndexEntry[] = readGoldenIndex(GOLDENS);

/** The kernel's long press: power turns the phone on this long after the key goes down. */
export const LONG_PRESS_MS = 800;

/** A golden's scenario: drives a phone and compares it with the golden `id`. */
export type Scenario = (id: string) => void;

/** One plan's acceptance: the scenarios and known gaps of the goldens it imports. */
export interface AcceptancePlan {
  /** The plan number; its goldens are `goldens/index/<plan>.json`. */
  readonly plan: string;
  /**
   * Hand-written scenarios by golden id. Generated tree goldens (they declare a `scenario` and
   * `covers`) run the generic tree scenario and need none.
   */
  readonly scenarios: Readonly<Record<string, Scenario>>;
  /**
   * Asserted goldens whose scenario cannot pass, each with its reason: a difference the fidelity
   * standard counts (a pixel, a frame of two display frames or longer, timing beyond its
   * tolerance), or a firmware quirk behind one. Their scenarios run as expected failures, so a gap
   * that starts passing must leave this table.
   */
  readonly knownGaps?: Readonly<Record<string, string>>;
  /** Scenarios that may outlast the default 5 s timeout on a loaded machine, by golden id. */
  readonly timeoutsMs?: Readonly<Record<string, number>>;
  /**
   * The tree nodes a hand-written golden covers, by golden id (plan 18: the leaves its features
   * bind), for the coverage guard; generated tree goldens declare their own `covers`.
   */
  readonly covers?: Readonly<Record<string, readonly string[]>>;
}

/** How long after the trigger a timeline golden ends (the last frame's end, or lower bound). */
function spanAfterTrigger(golden: Golden): number {
  const rows = golden.timeline!;
  const trigger = rows[golden.triggerFrame as number]!;
  const last = rows[rows.length - 1]!;
  return last.startMs + last.durationMs - trigger.startMs;
}

/** Records `trigger` and everything after it for as long as `golden`'s timeline runs. */
export function recordTimeline(rig: Rig, golden: Golden, trigger: () => void): RecordedTimeline {
  return rig.record(spanAfterTrigger(golden) + 100, trigger);
}

// ---------------------------------------------------------------- generic tree scenario (plan 14)

/**
 * After `goto`, the trigger comes one harness tap later, as in the captures (`key`: ≈42 ms down,
 * the 250 ms settle and the 300 ms key gap): Screen saver's entry indicator (≈2.9 s) is still on
 * screen when its leaves are selected (`tree/05-tones/5-9-1.leaf` frame 0).
 */
const SETTLE_MS = 592;

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

// ---------------------------------------------------------------- plans

/** The scenario of an asserted golden: the plan's hand-written one, or the generic tree one. */
export function scenarioOf(
  plan: AcceptancePlan,
  id: string,
  covers: readonly string[] | undefined,
): (() => void) | undefined {
  const scenario = plan.scenarios[id];
  if (scenario !== undefined) return () => scenario(id);
  if (covers !== undefined) return () => treeScenario(id, covers);
  return undefined;
}

/**
 * One `it` per golden of the plan's index: asserted ones run their scenario (a known gap as an
 * expected failure, so a gap that starts passing must leave `knownGaps`; one without a scenario
 * fails), pending ones are todos naming their plan.
 */
function describePlan(plan: AcceptancePlan): void {
  describe("stock phone against every asserted v6.39 golden", () => {
    for (const { id, status, covers } of readPlanIndex(GOLDENS, plan.plan)) {
      if (status !== "asserted") {
        it.todo(`${id} (${status.replace("pending:", "pending: plan ")})`);
        continue;
      }
      const scenario = scenarioOf(plan, id, covers);
      const gap = plan.knownGaps?.[id];
      if (gap !== undefined && scenario !== undefined) {
        it.fails(`${id} (known gap: ${gap})`, scenario);
        continue;
      }
      it(
        id,
        () => {
          if (scenario === undefined) throw new Error(`no scenario for ${id}`);
          scenario();
        },
        plan.timeoutsMs?.[id],
      );
    }
  });
}

/** Set while the coverage guard imports the plan files: plans are collected, not described. */
let collecting: AcceptancePlan[] | undefined;

/**
 * Declares a plan's acceptance. In its own test file this describes the plan's goldens; while
 * the coverage guard collects (`collectAcceptancePlans`), it only hands the plan over. A plan
 * file must call it once and register no other tests.
 */
export function acceptancePlan(plan: AcceptancePlan): void {
  if (collecting !== undefined) collecting.push(plan);
  else describePlan(plan);
}

/** The directory of the plan files. */
export const ACCEPTANCE_DIR = join(import.meta.dirname, "../acceptance");

/** A plan file's name: `<NN>-<slug>.test.ts`; group 1 is the plan number. */
export const PLAN_FILE = /^(\d+[a-z]?)-[a-z0-9-]+\.test\.ts$/;

/** The plan files, sorted. */
export function acceptancePlanFiles(): string[] {
  return readdirSync(ACCEPTANCE_DIR)
    .filter((file) => PLAN_FILE.test(file))
    .sort();
}

/**
 * Every plan file's plan, by file name. Each file is imported in collection mode, so it must not
 * have been imported before in this module graph (vitest isolates test files).
 */
export async function collectAcceptancePlans(): Promise<ReadonlyMap<string, AcceptancePlan>> {
  const plans = new Map<string, AcceptancePlan>();
  for (const file of acceptancePlanFiles()) {
    collecting = [];
    try {
      await import(/* @vite-ignore */ pathToFileURL(join(ACCEPTANCE_DIR, file)).href);
      if (collecting.length !== 1) {
        throw new Error(`${file} declares ${collecting.length} acceptance plans, not one.`);
      }
      plans.set(file, collecting[0]!);
    } finally {
      collecting = undefined;
    }
  }
  return plans;
}
