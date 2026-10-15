// Plan 19's acceptance (docs/plans/19-phone-book.md Task 11): the SIM phone book. Every scenario
// replays its capture's command log (tests/support/replay.ts over
// scripts/generated/phone-book-scripts.ts) on a phone with the log's SIM fixture and compares each
// shot, scroll, recording and sound; the table is PHONE_BOOK_SCENARIOS (tests/support/phone-book.ts).
// Goldens are pending until the task that implements them is done (plan 29 "Pending workflow").
import { acceptancePlan } from "../support/acceptance.ts";
import {
  PHONE_BOOK_KNOWN_GAPS,
  PHONE_BOOK_SCENARIOS,
  PHONE_BOOK_TIMEOUTS_MS,
} from "../support/phone-book.ts";

acceptancePlan({
  plan: "19",
  scenarios: PHONE_BOOK_SCENARIOS,
  knownGaps: PHONE_BOOK_KNOWN_GAPS,
  timeoutsMs: PHONE_BOOK_TIMEOUTS_MS,
});
