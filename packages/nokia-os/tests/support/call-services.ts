import { expectTimeline } from "./golden.ts";
import { loadGolden } from "./goldens.ts";
import { recordTimeline, type Scenario } from "./acceptance.ts";
import { callRig, callRecording, play } from "./calls.ts";
import { CALL_SCRIPTS } from "./call-scripts.ts";

const IN_CALL_SELECTIONS = [1, 2, 3] as const;

export const IN_CALL_SERVICE_SCENARIOS: Readonly<Record<string, Scenario>> = Object.fromEntries(
  IN_CALL_SELECTIONS.map((selection) => {
    const id = `calls/in-call-options-select-${selection}`;
    return [id, () => callRecording(id, CALL_SCRIPTS[id]!)];
  }),
);

const UNANSWERED = {
  "divert-status": "menu 7 1 +1200 down down +300",
  "divert-cancel": "menu 7 1 +1200 down +300",
  "divert-mailbox": "menu 7 1 +1200 menu +1200",
  "divert-other": "menu 7 1 +1200 menu down menu +1200 0 4 1 2 3 4 5 6 7 8",
  "divert-all-cancel": "menu 7 +1200 down down down down",
  "waiting-activate": "menu 6 1 3 +1200",
  "waiting-cancel": "menu 6 1 3 +1200 down",
  "waiting-status": "menu 6 1 3 +1200 down down",
  "string-0": "0 4",
  "string-1": "#",
  "string-2": "* 1 2 3 #",
  "string-3": "* 2 1 * 0 4 1 2 3 4 5 6 7 8 #",
  "string-4": "# # 0 0 2 #",
  "string-5": "* # 2 1 #",
};

export const CALL_SERVICE_SCENARIOS: Readonly<Record<string, Scenario>> = Object.fromEntries(
  Object.entries(UNANSWERED).map(([name, setup]) => {
    const id = `calls-services/none-${name}`;
    return [
      id,
      () => {
        const rig = callRig();
        play(rig, setup);
        const golden = loadGolden(id);
        const recording = recordTimeline(rig, golden, () => rig.press("navi", 60));
        expectTimeline(recording, golden, `${name}: unanswered host request`);
      },
    ];
  }),
);
