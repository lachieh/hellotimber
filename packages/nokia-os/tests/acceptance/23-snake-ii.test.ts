// Plan 23's acceptance (docs/plans/23-games-snake-ii.md "Acceptance"): Snake II's game goldens,
// from the scenarios of tests/support/game.ts.
import { acceptancePlan } from "../support/acceptance.ts";
import { SNAKE_SCENARIOS } from "../support/game.ts";

acceptancePlan({
  plan: "23",
  scenarios: SNAKE_SCENARIOS,
  knownGaps: {
    "game/snake/keys-c-hold":
      "C held through the suspend goes on to standby in the capture, but the kernel swallows the " +
      "keys held when an application exits, so the held C's long press never fires (phone-core; " +
      "the game suspends on C's key-down, as the capture shows the menu while C is held)",
  },
  // `game/snake/periods` plays New game at all 166 captured levels on one phone (≈1.6 s alone,
  // the longest scenario, ≈5× any other).
  timeoutsMs: { "game/snake/periods": 20_000 },
});
