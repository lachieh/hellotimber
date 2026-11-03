// Plan 22's acceptance (docs/plans/22-call-register-divert-and-dialling.md Task 10): number entry,
// calls and the call register. Stills replay their Task 0 case (CALL_CASES), recordings and sound
// goldens their capture's script (tests/support/call-scripts.ts) over the synthetic cell
// (tests/support/calls.ts).
import { expect } from "vite-plus/test";
import { acceptancePlan } from "../support/acceptance.ts";
import {
  CALLS_COVERS,
  callRecording,
  callRig,
  callStill,
  play,
  scriptRig,
  type CallRig,
  CALLS_KNOWN_GAPS,
  CALLS_SCENARIOS,
  CALLS_TIMEOUTS_MS,
} from "../support/calls.ts";

import { describeStockScreen } from "../../src/kit/ui/display/describe";
import { CALL_SCRIPTS } from "../support/call-scripts.ts";

function saveAndCall(rig: CallRig, number: string): void {
  play(rig, "2 +1500 menu +4000 menu +3000");
  expect(rig.net.dialled.at(-1)).toEqual({
    number,
    name: "A",
    emergency: false,
    ownNumberSending: "show",
  });
}

acceptancePlan({
  plan: "22",
  scenarios: {
    ...CALLS_SCENARIOS,
    "calls/entry-save": (id) => {
      callStill(id);
      const rig = callRig();
      play(rig, "1 2 3 4 5 down menu +1500");
      saveAndCall(rig, "12345");
    },
    "calls/in-call-options-select-4": (id) => {
      const script = CALL_SCRIPTS[id]!;
      callRecording(id, script);
      const rig = scriptRig(script);
      play(rig, `${script.keys} +1500 menu`);
      expect(describeStockScreen(rig.phone.screen)).toContain("Name:");
      play(rig, "c down down down down down down down down down menu down menu");
      expect(describeStockScreen(rig.phone.screen)).toContain("No voice tags saved");
      play(rig, "c c c +1000");
      expect(describeStockScreen(rig.phone.screen)).toContain("Call 1");
    },
    "calls/register-save": (id) => {
      const script = CALL_SCRIPTS[id]!;
      callRecording(id, script);
      const rig = scriptRig(script);
      play(rig, script.keys);
      saveAndCall(rig, "0433333333");
    },
  },
  knownGaps: CALLS_KNOWN_GAPS,
  timeoutsMs: CALLS_TIMEOUTS_MS,
  covers: CALLS_COVERS,
});
