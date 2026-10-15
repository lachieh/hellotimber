// Plan 18b's acceptance (docs/plans/18b-t9-predictive-text.md Task 8): T9 predictive text. Every
// asserted golden of goldens/index/18b.json plays its note's keys on a stock phone with the
// shipped English dictionary (tests/support/t9.ts); a golden is asserted once its id is in
// T9_PROMOTED (scripts/t9-capture-set.ts) and the importer ran, pending goldens are todos.
import { acceptancePlan } from "../support/acceptance.ts";
import { T9_ASSERTED_KNOWN_GAPS, T9_SCENARIOS } from "../support/t9.ts";

acceptancePlan({
  plan: "18b",
  scenarios: T9_SCENARIOS,
  knownGaps: T9_ASSERTED_KNOWN_GAPS,
});
