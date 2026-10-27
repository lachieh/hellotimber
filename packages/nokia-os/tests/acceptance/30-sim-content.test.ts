// Plan 30's acceptance (docs/plans/30-sim-content-and-sim-services.md Task 10): SIM messages,
// sender names and SIM services. Every scenario replays its capture's command log
// (tests/support/replay.ts over scripts/generated/sim-content-scripts.ts) on a phone with the
// log's SIM fixture and toolkit, or drives the power-on stills by hand (tests/support/sim-content.ts).
// Goldens are pending until the task that implements them is done (plan 29 "Pending workflow").
import { readPlanIndex } from "../../scripts/golden-index.ts";
import { acceptancePlan, GOLDENS } from "../support/acceptance.ts";
import {
  SIM_CONTENT_KNOWN_GAPS,
  simContentScenarioOf,
  simImeiScenario,
} from "../support/sim-content.ts";

const ASSERTED = readPlanIndex(GOLDENS, "30").filter((entry) => entry.status === "asserted");

acceptancePlan({
  plan: "30",
  scenarios: {
    ...Object.fromEntries(ASSERTED.map(({ id }) => [id, simContentScenarioOf(id)])),
    "sim/imei-screen": simImeiScenario,
  },
  knownGaps: Object.fromEntries(
    Object.entries(SIM_CONTENT_KNOWN_GAPS).filter(([id]) => ASSERTED.some((e) => e.id === id)),
  ),
  // A replay runs its log from power-on: the longest take seconds, more under the full suite.
  timeoutsMs: Object.fromEntries(ASSERTED.map(({ id }) => [id, 60_000])),
});
