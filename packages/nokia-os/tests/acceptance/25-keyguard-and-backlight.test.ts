// Plan 25's acceptance (docs/plans/25-keyguard-and-backlight.md "Acceptance"): the keyguard's LCD
// goldens, the lights goldens and the keyguard's sound goldens. Every plan 25 golden is imported
// `pending:25` (plan 29's workflow) and listed here as a todo until the task that drives it adds
// its scenario and promotes it in scripts/capture-sets/25-keyguard-and-backlight.ts.
import { acceptancePlan } from "../support/acceptance.ts";

acceptancePlan({ plan: "25", scenarios: {} });
