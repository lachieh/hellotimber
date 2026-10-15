// Plan 22's acceptance (docs/plans/22-call-register-divert-and-dialling.md Task 10): number entry,
// calls and the call register. Goldens stay pending until their scenario exists (plan 29's pending
// workflow, scripts/capture-sets/22-calls.ts PROMOTED); the harness lists them as todos.
import { acceptancePlan } from "../support/acceptance.ts";

acceptancePlan({ plan: "22", scenarios: {} });
