// Reminders (menu 10; plan 21): Add new, View all and Erase over the reminder memory
// (`reminders/store.ts`), its alerts (`reminders/service.ts`), and the level's children listed
// while the memory holds a reminder (D8, D9).
import type { StockFeature } from "./feature";
import { addNew, erase, viewAll } from "./reminders/flows";
import { phoneReminders } from "./reminders/service";

export const remindersFeature: StockFeature = {
  name: "reminders",
  screens: {
    "10-1": (services, place) => addNew(services, place.numbering),
    "10-2": (services) => viewAll(services),
    "10-3": (services, place) => erase(services, place.numbering),
  },
  // View all and Erase only while the memory holds a reminder (or the virgin junk one, D8).
  levels: {
    "10": (services) => ({
      shown: (child) => child === "add-new" || phoneReminders(services).store.any(),
    }),
  },
  // View all returns to the carousel at once with no reminder to show (the virgin junk one,
  // `tree/10-reminders/10-2.leaf`).
  exitsWhen: {
    "10-2": (services) => phoneReminders(services).store.list().length === 0,
  },
  widgets: {
    promptLayouts: {
      "10-1": {
        icons: ["pen", "abc"],
        counter: "35",
        label: ["Remind about:"],
        entry: "text",
        softkey: "OK",
      },
    },
    exitLevels: { "10-2": 2 },
  },
};
