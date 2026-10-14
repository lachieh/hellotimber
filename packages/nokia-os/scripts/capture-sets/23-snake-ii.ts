// Plan 23's goldens (docs/plans/23-games-snake-ii.md "Capture set"): Snake II's game goldens and
// the period fixture, from the tables of scripts/game-capture-set.ts.
import type { PlanCaptureSet } from "../capture-set.ts";
import { gameCaptureSet, periodFixture } from "../game-capture-set.ts";

export const snakeII: PlanCaptureSet = {
  plan: "23",
  lcd: (io) => gameCaptureSet(io.game),
  ticks: (io) => [periodFixture(io.game)],
  notImported: {
    "game/": "the first Snake II recording (level 175); plan 23's recaptures (plan23/) replace it",
    "plan23/bot/*/after/score-ids, plan23/virgin/after/score-ids":
      "Last/Top score IDs after a game are codes the firmware derives (plan 23 Open question 4)",
    "plan23/bot/grace/try-*": "the grace window probes; bot-grace holds the saved run",
    "plan23/sound/, plan23/*.wav, plan23/*.events.csv":
      "cue timing: plan 23 Task 10 reads the measured edges (plan 23 Task 0 outcome)",
  },
};
