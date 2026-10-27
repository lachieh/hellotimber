// Plan 22's acceptance (docs/plans/22-call-register-divert-and-dialling.md Task 10): number entry,
// calls and the call register. Stills replay their Task 0 case (CALL_CASES), recordings and sound
// goldens their capture's script (tests/support/call-scripts.ts) over the synthetic cell
// (tests/support/calls.ts).
import { acceptancePlan } from "../support/acceptance.ts";
import {
  CALLS_COVERS,
  CALLS_KNOWN_GAPS,
  CALLS_SCENARIOS,
  CALLS_TIMEOUTS_MS,
} from "../support/calls.ts";

acceptancePlan({
  plan: "22",
  scenarios: CALLS_SCENARIOS,
  knownGaps: CALLS_KNOWN_GAPS,
  timeoutsMs: CALLS_TIMEOUTS_MS,
  covers: CALLS_COVERS,
});
