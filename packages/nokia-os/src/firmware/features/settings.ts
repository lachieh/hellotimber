// Settings (menu 6; plan 15): the welcome note's stored text and Own number sending's factory
// value. Security settings and Restore factory settings are the security feature's.
import type { StockFeature } from "./feature";

/** The stored welcome note (a typed text; absent = no note). Plan 18's editor writes it. */
export const WELCOME_NOTE_KEY = "settings/phone-settings/welcome-note";

export const settingsFeature: StockFeature = {
  name: "settings",
  placeholders: {
    "6-2-3": "18", // Welcome note: text editor (plan 15 D12; plan 15 owns the stored note)
  },
  settings: {
    typedTexts: [WELCOME_NOTE_KEY],
    // Restore keeps the welcome note (v6.39 `plan15/accept/c4-*` then `factory/boot` shows `Hi`).
    restoreKeeps: [WELCOME_NOTE_KEY],
    factoryDefaults: [
      {
        key: "settings/call-settings/own-number-sending",
        label: "Set by network",
        evidence: "v6.39",
        capture: "plan15/factory/scroll/6-1-4/01.png",
      },
    ],
  },
};
