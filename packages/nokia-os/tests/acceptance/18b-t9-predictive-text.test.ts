// Plan 18b's acceptance (docs/plans/18b-t9-predictive-text.md Task 8): T9 predictive text. Its
// goldens (goldens/index/18b.json) are imported `pending:18b` and run as todos until a scenario
// lands here and the golden is promoted (T9_PROMOTED in scripts/t9-capture-set.ts).
import { acceptancePlan } from "../support/acceptance.ts";

acceptancePlan({ plan: "18b", scenarios: {} });
