// Plan 18b's goldens (docs/plans/18b-t9-predictive-text.md "Golden pipeline additions"): T9
// predictive text, from the table of scripts/t9-capture-set.ts over `captures/plan18b/`.
import type { PlanCaptureSet } from "../capture-set.ts";
import { T9_BASE, T9_NOT_IMPORTED, t9CaptureSet, type T9Manifest } from "../t9-capture-set.ts";

export const t9PredictiveText: PlanCaptureSet = {
  plan: "18b",
  lcd: (io) =>
    t9CaptureSet({
      manifest: (scenario) =>
        io.json(`${T9_BASE}/${scenario}/manifest.json`) as T9Manifest | undefined,
      recording: (dir) => io.frames.recording(dir),
    }),
  notImported: T9_NOT_IMPORTED,
};
