// The golden index: one file per plan, `goldens/index/<NN>.json`, listing the fixtures that plan's
// capture set (`scripts/capture-sets/<NN>-<slug>.ts`) imports, sorted by id. The importer writes
// it; tests, the extractor and the tree importer read the union. Split by plan so imports in
// parallel worktrees touch disjoint files. Imports only node:*.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One fixture: its id, file (relative to goldens/), status and size. */
export interface GoldenIndexEntry {
  readonly id: string;
  readonly file: string;
  readonly status: string;
  readonly kind: "still" | "timeline" | "ticks" | "sound" | "lights";
  /** LCD goldens and tick fixtures (0). */
  readonly images?: number;
  readonly frames?: number;
  /** Sound and lights goldens. */
  readonly events?: number;
  /** Generated tree goldens (plan 14 D7): the tree nodes covered. */
  readonly covers?: readonly string[];
  /** Game goldens (plan 23): the keys pressed, by engine tick. */
  readonly input?: true;
}

/** The directory under goldens/ that holds the per-plan index files. */
export const GOLDEN_INDEX_DIR = "index";

/** A plan number as index files and capture sets name it: `13`, `18b`. */
export const PLAN_NUMBER = /^\d+[a-z]?$/;

export function compareIds(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The plans with an index file, in file-name order. */
export function indexedPlans(goldens: string): string[] {
  const dir = join(goldens, GOLDEN_INDEX_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .filter((plan) => PLAN_NUMBER.test(plan))
    .sort();
}

/** `goldens/index/<plan>.json`. */
export function planIndexPath(goldens: string, plan: string): string {
  return join(goldens, GOLDEN_INDEX_DIR, `${plan}.json`);
}

/** One plan's fixtures, sorted by id. */
export function readPlanIndex(goldens: string, plan: string): GoldenIndexEntry[] {
  return JSON.parse(readFileSync(planIndexPath(goldens, plan), "utf8")) as GoldenIndexEntry[];
}

/** Every plan's fixtures, sorted by id. */
export function readGoldenIndex(goldens: string): GoldenIndexEntry[] {
  return indexedPlans(goldens)
    .flatMap((plan) => readPlanIndex(goldens, plan))
    .sort(compareIds);
}

/** An index file's text: the entries sorted by id, two-space JSON, a final newline. */
export function serializePlanIndex(entries: readonly GoldenIndexEntry[]): string {
  return `${JSON.stringify([...entries].sort(compareIds), null, 2)}\n`;
}
