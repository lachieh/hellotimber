// Plan 18's acceptance (docs/plans/18-messages-and-chat.md Task 12): text entry, the Welcome note
// and SMS. Every plan 18 golden is pending until its scenario exists (plan 29 "Pending
// workflow"); the harness lists them as todos. Later tasks add scenarios here as they promote
// goldens through scripts/messages-capture-set.ts.
import { acceptancePlan } from "../support/acceptance.ts";

acceptancePlan({ plan: "18", scenarios: {} });
