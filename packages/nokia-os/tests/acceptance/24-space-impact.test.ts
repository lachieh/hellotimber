import { acceptancePlan } from "../support/acceptance.ts";
import { spaceImpactScenarios } from "../support/game.ts";

acceptancePlan({ plan: "24", scenarios: spaceImpactScenarios });
