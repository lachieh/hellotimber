// Phone book (menu 1; plan 19 implements it): the prompts' measured layouts and the SIM's virgin
// memory status. Search, Add name and the rest keep plan 14's first screens.
import type { StockFeature } from "./feature";

export const phoneBookFeature: StockFeature = {
  name: "phone-book",
  widgets: {
    promptLayouts: {
      "1-1": { icons: ["pen", "abc"], entry: "box" },
      "1-3": {
        icons: ["pen", "abc"],
        counter: "16",
        label: ["Name:"],
        entry: "text",
        softkey: "OK",
      },
      "1-9": { icons: ["phone-book"], entry: "value" },
    },
  },
  settings: {
    // Phone book › Options › Memory status: `SIM card:` / `50 free` / `0 in use`.
    virginTexts: [
      { key: "phone-book/options/memory-status/free", number: "1-8-2", line: 1 },
      { key: "phone-book/options/memory-status/used", number: "1-8-2", line: 2 },
    ],
  },
};
