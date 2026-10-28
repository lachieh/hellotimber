import { acceptancePlan } from "../support/acceptance.ts";

// Every imported capture remains pending until its gameplay/session replay passes.
acceptancePlan({ plan: "24", scenarios: {} });
