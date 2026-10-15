// Plan 17's acceptance (docs/plans/17-profiles.md Task 9): every asserted profiles golden. Its
// goldens are `pending:17` until the task that drives them lands (plan 29 "Pending workflow").
import { acceptancePlan } from "../support/acceptance.ts";

acceptancePlan({ plan: "17", scenarios: {} });
