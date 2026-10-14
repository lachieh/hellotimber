import type { PlanCaptureSet } from "./capture-set.ts";
import * as registered from "./capture-sets/index.ts";
import { PLAN_NUMBER } from "./golden-index.ts";

export function captureSets(
  sets: readonly PlanCaptureSet[] = Object.values(registered),
): PlanCaptureSet[] {
  const plans = new Set<string>();
  for (const set of sets) {
    if (!PLAN_NUMBER.test(set.plan))
      throw new Error(`capture set plan "${set.plan}" is not a plan number`);
    if (plans.has(set.plan)) throw new Error(`two capture sets for plan ${set.plan}`);
    plans.add(set.plan);
  }
  return [...sets].sort(
    (a, b) =>
      Number.parseInt(a.plan, 10) - Number.parseInt(b.plan, 10) || a.plan.localeCompare(b.plan),
  );
}
