// Plan 18's acceptance (docs/plans/18-messages-and-chat.md Task 12): text entry, the Welcome note
// and SMS. Every scenario replays its capture's command log (tests/support/replay.ts over
// scripts/generated/messages-scripts.ts) on a virgin phone and compares each shot, scroll and
// recording; the table is MESSAGES_SCENARIOS (tests/support/messages.ts).
import { acceptancePlan } from "../support/acceptance.ts";
import { MESSAGES_COVERS, MESSAGES_KNOWN_GAPS, MESSAGES_SCENARIOS } from "../support/messages.ts";

acceptancePlan({
  plan: "18",
  scenarios: MESSAGES_SCENARIOS,
  knownGaps: MESSAGES_KNOWN_GAPS,
  covers: MESSAGES_COVERS,
});
