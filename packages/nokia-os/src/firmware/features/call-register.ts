// Call register (menu 4; plan 22 implements the lists, durations and costs): Clear timers behind
// the security code, and Prepaid credit's page results.
import { infoPages } from "../../widgets/info-pages";
import { OptionListWidget } from "../../widgets/option-list";
import type { StockFeature } from "./feature";
import { securityCodeScreen } from "./security";

export const callRegisterFeature: StockFeature = {
  name: "call-register",
  screens: {
    // Show call duration › Clear timers (a page result): probe/accept-4-5-5 image h
    // (689/245/511 ms). Erasing the timers is plan 22's.
    "4-5-5": securityCodeScreen({
      kind: "note",
      note: { lines: ["Timers", "cleared"], timeline: "timers-cleared" },
    }),
    // Prepaid credit › Credit info display opens an On/Off list on its page value (P15). Whether
    // a choice changes the page is UNVERIFIED (the probe only scrolled it), so OK goes back
    // without storing.
    "4-8-1": ({ settings }, { key }) => {
      const labels = ["On", "Off"];
      return () => {
        const value = settings.text(key);
        const opening = labels.findIndex((label) => label === value);
        return new OptionListWidget({
          labels,
          softkey: "OK",
          opening: opening < 0 ? null : opening,
          choose: (_index, flow) => flow.back(),
        });
      };
    },
    // Prepaid credit › Recharge status: two info pages (P15).
    "4-8-4": () => {
      const pages = [
        { label: "Last recharge:", value: () => "0", softkey: "Back" },
        { label: "Expiry date:", value: () => "0", softkey: "Back" },
      ];
      return () => infoPages({ pages });
    },
  },
};
