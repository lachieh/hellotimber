// Plan 18c's acceptance (docs/plans/18c-chat-templates-pictures-info-service.md Task 10):
// Templates, Smileys, their insertion, Chat, Info service › Topics and the Service command editor.
// Every scenario replays its capture's command log (tests/support/replay.ts over
// scripts/generated/content-scripts.ts) on a phone in the log's state and compares each shot,
// scroll and recording; the table is CONTENT_SCENARIOS (tests/support/18c-content.ts).
import { acceptancePlan } from "../support/acceptance.ts";
import { CONTENT_COVERS, CONTENT_KNOWN_GAPS, CONTENT_SCENARIOS } from "../support/18c-content.ts";

acceptancePlan({
  plan: "18c",
  scenarios: CONTENT_SCENARIOS,
  knownGaps: CONTENT_KNOWN_GAPS,
  covers: CONTENT_COVERS,
});
