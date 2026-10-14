// Call divert (menu 7; plan 22 implements the divert flows): the copied subtrees, the number
// prompts, the lists' numbering, Set delay's return and Requesting's Quit.
import type { PromptLayout } from "../../widgets/prompt";
import type { StockFeature } from "./feature";

const PEN_BOX_END: PromptLayout = { icons: ["pen"], entry: "end" };

export const callDivertFeature: StockFeature = {
  name: "call-divert",
  // Divert when busy and Divert when phone off or no coverage are Divert all voice calls'
  // subtree (plan 14 S6).
  sameAs: { "7-2": "7-1", "7-4": "7-1" },
  widgets: {
    promptLayouts: {
      "7-1-1-2": PEN_BOX_END,
      "7-2-1-2": PEN_BOX_END,
      "7-3-1-2": PEN_BOX_END,
      "7-4-1-2": PEN_BOX_END,
    },
    // The Call divert lists show their parent level's path (`tree/07-call-divert/7-3-4.options`:
    // `7-3-0`, `7-3-1`).
    optionListNumbering: { "7-": "parent" },
    // OK on a Set delay choice returns at once to the Call divert page, no note (P13).
    exitLevels: { "7-3-4": 2 },
    // Requesting's Quit: `Request not confirmed`, then standby (P7; C on Requesting UNVERIFIED).
    progressQuits: {
      Requesting: { lines: ["Request", "not", "confirmed"], timeline: "request-not-confirmed" },
    },
  },
  settings: {
    factoryDefaults: [
      {
        key: "call-divert/divert-if-not-answered/set-delay",
        label: "30 seconds",
        evidence: "v6.39",
        capture: "plan15/factory/scroll/7-3-4/01.png",
      },
    ],
  },
};
