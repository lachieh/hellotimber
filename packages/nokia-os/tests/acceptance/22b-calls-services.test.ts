import { readPlanIndex } from "../../scripts/golden-index.ts";
import { acceptancePlan, GOLDENS } from "../support/acceptance.ts";
import { CALL_SERVICE_SCENARIOS } from "../support/call-services.ts";

import { CALL_SERVICE_KNOWN_GAPS } from "../support/call-services-gaps.ts";

const asserted = new Set(
  readPlanIndex(GOLDENS, "22b")
    .filter((entry) => entry.status === "asserted")
    .map((entry) => entry.id),
);

acceptancePlan({
  plan: "22b",
  knownGaps: CALL_SERVICE_KNOWN_GAPS,
  scenarios: Object.fromEntries(
    Object.entries(CALL_SERVICE_SCENARIOS).filter(([id]) => asserted.has(id)),
  ),
});
