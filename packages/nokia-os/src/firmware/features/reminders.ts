// Reminders (menu 10; plan 21 implements the reminder data): the note prompt, View all's return
// and Erase › All's result.
import type { StockFeature } from "./feature";

export const remindersFeature: StockFeature = {
  name: "reminders",
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
    // View all returns to the carousel without drawing anything (`tree/10-reminders/10-2.leaf`).
    exitLevels: { "10-2": 2 },
    // Erase › All empties the reminder memory (probe/confirm-10-3-2-yes image c). The firmware
    // then hides View all and Erase (image d), which needs reminder data (plan 21).
    queryResults: {
      "Are you": {
        kind: "note",
        lines: ["Reminder", "memory", "empty"],
        timeline: "reminder-memory-empty",
      },
    },
  },
};
