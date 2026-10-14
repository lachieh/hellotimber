// Real key presses to any node of the stock tree (plan 14 Task 13, D7): the generic tree
// scenarios derive their navigation from the generated tree, starting at a settled standby in
// the virgin-EEPROM state.
import type { PhoneKey } from "@hellotimber/phone-core";
import { STOCK_TREE, type StockTreeNode } from "../../src/firmware/generated/stock-tree";
import { WIDGET_TIMELINE_BY_NODE, WIDGET_TIMELINES } from "../../src/resources";
import type { Rig } from "./rig.ts";

export type DriveStep = { readonly key: PhoneKey } | { readonly waitMs: number };

export interface DriveOptions {
  /** How long a level's intro (game splash) runs after its Select. */
  readonly introMs: (number: string) => number;
}

/** Menu waits this long for the carousel (39 ms of standby, plan 13). */
const MENU_SETTLE_MS = 100;
/** An intro is waited out with this margin. */
const INTRO_MARGIN_MS = 100;

/** The stock splashes' lengths, from their generated timelines. */
export const STOCK_DRIVE: DriveOptions = {
  introMs(number) {
    const id = WIDGET_TIMELINE_BY_NODE[number];
    const timeline = id === undefined ? undefined : WIDGET_TIMELINES[id];
    if (timeline === undefined) throw new Error(`No intro timeline for ${number}.`);
    return timeline.timeline.durationMs;
  },
};

/** The index a level or list highlights on entry in the virgin state (null = unset). */
function openingIndex(node: StockTreeNode): number | null {
  const spec = node.opens;
  switch (spec.kind) {
    case "submenu": {
      const i = (node.children ?? []).findIndex((child) => child.slug === spec.opening);
      return i < 0 ? 0 : i;
    }
    case "option-list":
      return spec.opening;
    default:
      return 0;
  }
}

/** The number of entries ▼ moves through in the node's level or list. */
function entryCount(node: StockTreeNode): number {
  const spec = node.opens;
  if (spec.kind === "submenu") return node.children?.length ?? 0;
  if (spec.kind === "option-list") return spec.options.length;
  if (spec.kind === "info-pages") return spec.pages.length;
  throw new Error(`${node.number} has no entries to move through.`);
}

/** ▼ presses from the opening state to entry `index` (an unset list's first ▼ selects 0, P10). */
function downsTo(node: StockTreeNode, index: number): number {
  const opening = openingIndex(node);
  if (opening === null) return index + 1;
  const count = entryCount(node);
  return (index - opening + count) % count;
}

function repeat(key: PhoneKey, times: number): DriveStep[] {
  return Array.from({ length: times }, () => ({ key }));
}

/**
 * The keys that highlight node `number` in its parent from a settled standby: Menu, ▼ to the
 * top-level entry, then per level Select (waiting out an intro) and ▼ from the opening item by
 * visible position. An option choice (`1-8-1-2`) opens its list and ▼ to the option.
 */
export function gotoSteps(
  tree: readonly StockTreeNode[],
  number: string,
  options: DriveOptions,
): DriveStep[] {
  const segments = number.split("-");
  const steps: DriveStep[] = [{ key: "navi" }, { waitMs: MENU_SETTLE_MS }];
  let level = tree;
  let parent: StockTreeNode | undefined;
  for (let depth = 0; depth < segments.length; depth++) {
    const want = segments.slice(0, depth + 1).join("-");
    if (parent !== undefined) {
      steps.push({ key: "navi" });
      if (parent.opens.kind === "submenu" && parent.opens.intro) {
        steps.push({ waitMs: options.introMs(parent.number) + INTRO_MARGIN_MS });
      }
    }
    const entries =
      parent === undefined
        ? level.map((node) => ({ number: node.number, node }))
        : childEntries(parent);
    const index = entries.findIndex((entry) => entry.number === want);
    if (index < 0) throw new Error(`No tree node ${number}.`);
    steps.push(...repeat("down", parent === undefined ? index : downsTo(parent, index)));
    const entry = entries[index]!;
    parent = "node" in entry ? entry.node : undefined;
    level = parent?.children ?? [];
    if (parent === undefined && depth < segments.length - 1)
      throw new Error(`No tree node ${number}.`);
  }
  return steps;
}

/** The node's children, or an option list's options and an info list's pages, by number. */
function childEntries(node: StockTreeNode): { number: string; node?: StockTreeNode }[] {
  const spec = node.opens;
  if (spec.kind === "submenu") {
    return (node.children ?? []).map((child) => ({ number: child.number, node: child }));
  }
  const count =
    spec.kind === "option-list"
      ? spec.options.length
      : spec.kind === "info-pages"
        ? spec.pages.length
        : 0;
  return Array.from({ length: count }, (_, i) => ({ number: `${node.number}-${i + 1}` }));
}

/** `gotoSteps`, then Select (and the intro, for a level that has one). */
export function openSteps(
  tree: readonly StockTreeNode[],
  number: string,
  options: DriveOptions,
): DriveStep[] {
  const steps = [...gotoSteps(tree, number, options), { key: "navi" } as const];
  const node = findNode(tree, number);
  if (node?.opens.kind === "submenu" && node.opens.intro) {
    steps.push({ waitMs: options.introMs(number) + INTRO_MARGIN_MS });
  }
  return steps;
}

function findNode(tree: readonly StockTreeNode[], number: string): StockTreeNode | undefined {
  let level = tree;
  let found: StockTreeNode | undefined;
  for (const segment of number.split("-")) {
    found = level.find((n) => n.number.split("-").at(-1) === segment);
    if (found === undefined) return undefined;
    level = found.children ?? [];
  }
  return found;
}

/** Runs steps on a rig: each key is a short press, each wait advances the clock. */
export function drive(rig: Rig, steps: readonly DriveStep[]): void {
  for (const step of steps) {
    if ("key" in step) rig.press(step.key);
    else rig.advance(step.waitMs);
  }
}

/** Highlights stock node `number` in its parent (an option in its open list). */
export function goto(rig: Rig, number: string): void {
  drive(rig, gotoSteps(STOCK_TREE, number, STOCK_DRIVE));
}

/** Opens stock node `number`: `goto`, then Select (and its intro). */
export function open(rig: Rig, number: string): void {
  drive(rig, openSteps(STOCK_TREE, number, STOCK_DRIVE));
}
