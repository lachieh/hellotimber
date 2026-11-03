// Call divert (menu 7; plan 22 implements the divert flows): the copied subtrees, the number
// prompts, the lists' numbering, Set delay's return and Requesting's Quit.
import { serviceRequest } from "../../widgets/service-request";
import { numberEntry } from "../../kit/ui/widgets/number-entry";
import type { ScreenBinding } from "./feature";
import type { PromptLayout } from "../../kit/ui/widgets/prompt";
import type { StockServices } from "./feature";
import type { StockFeature } from "./feature";

const PEN_BOX_END: PromptLayout = { icons: ["pen"], entry: "end" };

function activation(services: StockServices, code: string, number: string): string {
  const delay =
    code === "61"
      ? (services.settings.choice("call-divert/divert-if-not-answered/set-delay") ?? 5) * 5 + 5
      : undefined;
  return `**${code}*${number}*11${delay === undefined ? "" : `*${delay}`}#`;
}

const request =
  (text: string, levels = 2): ScreenBinding =>
  (services) =>
  () =>
    serviceRequest(services, text, false, false, levels);
const screens: Record<string, ScreenBinding> = {
  "7-6": request("##002#", 1),
  "6-1-3-1": request("*43#", 1),
  "6-1-3-2": request("#43#", 1),
  "6-1-3-3": request("*#43#", 1),
};
for (const [node, code] of [
  ["7-1", "21"],
  ["7-2", "67"],
  ["7-3", "61"],
  ["7-4", "62"],
] as const) {
  screens[`${node}-2`] = request(`#${code}**11#`);
  screens[`${node}-3`] = request(`*#${code}#`);
  screens[`${node}-1-1`] = (services) => () =>
    serviceRequest(
      services,
      activation(services, code, services.settings.text("messages/voice-mailbox-number") ?? ""),
      false,
      false,
      2,
    );
  screens[`${node}-1-2`] = (services) => () =>
    numberEntry({
      label: ["Phone number:"],
      counter: false,
      done: (number, flow) =>
        flow.replace(serviceRequest(services, activation(services, code, number), false, false, 2)),
    });
}

export const callDivertFeature: StockFeature = {
  name: "call-divert",
  screens,
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
