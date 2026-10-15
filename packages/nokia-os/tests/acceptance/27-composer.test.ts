// Plan 27's acceptance (docs/plans/27-composer.md Task 12): every asserted Composer golden. Until
// Task 12 the Composer goldens are `pending:27` (todos); Send's transmission is `pending:18c`.
import { acceptancePlan } from "../support/acceptance.ts";

acceptancePlan({ plan: "27", scenarios: {}, knownGaps: {} });
