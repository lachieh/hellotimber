// Plan 25's acceptance (docs/plans/25-keyguard-and-backlight.md "Acceptance"): the keyguard's LCD
// goldens, the lights goldens and the keyguard's sound goldens. Plan 25 goldens are imported
// `pending:25` (plan 29's workflow) and listed as todos until the task that drives one adds its
// scenario here and promotes it in scripts/capture-sets/25-keyguard-and-backlight.ts.
import { readPlanIndex } from "../../scripts/golden-index.ts";
import { acceptancePlan, GOLDENS, type Scenario } from "../support/acceptance.ts";
import { lightsScenario } from "../support/lights.ts";

/** Task 4: the timeout, key, boot and power-key lights goldens (D2, D3). */
const LIGHTS = /^lights\/(timeout|keys|boot)\/|^lights\/power-key\/(standby|menu|list)$/;

const scenarios: Record<string, Scenario> = Object.fromEntries(
  readPlanIndex(GOLDENS, "25")
    .filter((entry) => entry.status === "asserted" && LIGHTS.test(entry.id))
    .map((entry) => [entry.id, lightsScenario]),
);

acceptancePlan({
  plan: "25",
  scenarios,
  knownGaps: {
    "lights/timeout/virgin/tap-02":
      "the light tick's ±3 ms: this key-down lies 13631.1 ms before the fitted tick and the LEDs " +
      "stayed lit, while factory/tap-02 (13631.6 ms) and factory/fine-252 (13627.6 ms) went dark",
    "lights/boot/power-off":
      "the kernel switches the phone off 800 ms into the power key's hold, the firmware ≈1017 ms " +
      "(the power key's long press, plan 17)",
  },
});
