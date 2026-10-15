// Plan 19's acceptance (docs/plans/19-phone-book.md Task 11): the SIM phone book. Every plan 19
// golden is pending until its scenario exists (plan 29 "Pending workflow"); the harness lists
// them as todos. Tasks 7-11 add scenarios as scripts/capture-sets/19-phone-book.ts promotes them.
import { acceptancePlan } from "../support/acceptance.ts";

acceptancePlan({ plan: "19", scenarios: {} });
