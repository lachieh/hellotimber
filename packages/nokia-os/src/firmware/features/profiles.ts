// Profiles (menu 12; plan 17 implements activation): each profile's Personalise is General's
// subtree; Tones are the active profile's Personalise settings (the virgin EEPROM's active
// profile is General); Screen saver's setter level; Rename's prompt; the factory values.
import type { FactoryDefault, StockFeature } from "./feature";

function scroll(number: string): string {
  return `plan15/factory/scroll/${number}/01.png`;
}

/** The Personalise lists in their order (12-n-2-1…8, 9 Screen saver, 9-3 Timeout). */
const PERSONALISE = [
  ["ringing-tone", "1"],
  ["ringing-volume", "2"],
  ["incoming-call-alert", "3"],
  ["message-alert-tone", "5"],
  ["keypad-tones", "6"],
  ["warning-tones", "7"],
  ["vibrating-alert", "8"],
  ["screen-saver", "9"],
] as const;

/** One profile's factory Personalise values (the README "v6.39 factory values" table). */
function profile(slug: string, n: number, labels: readonly string[]): FactoryDefault[] {
  return [
    ...PERSONALISE.map(
      ([setting, k], i): FactoryDefault => ({
        key: `profiles/${slug}/personalise/${setting}`,
        label: labels[i]!,
        evidence: "v6.39",
        capture: scroll(`12-${n}-2-${k}`),
      }),
    ),
    {
      key: `profiles/${slug}/personalise/screen-saver/timeout`,
      label: "5 seconds",
      evidence: "v6.39",
      capture: scroll(`12-${n}-2-9-3`),
    },
  ];
}

export const profilesFeature: StockFeature = {
  name: "profiles",
  // Every profile's Personalise is General's (plan 14 S6).
  sameAs: { "12-3-2": "12-2-2", "12-4-2": "12-2-2", "12-5-2": "12-2-2", "12-6-2": "12-2-2" },
  placeholders: {
    "12-*-1": "17", // Profiles › Activate
    "12-*-2-9-4": "18", // Personalise › Screen saver › Screen saver: nothing in the virgin EEPROM
  },
  widgets: {
    promptLayouts: {
      // The name being edited is the profile's (Silent: 10 - 6 characters left).
      "12-2-2-10": {
        icons: ["pen", "abc-lower"],
        counter: "4",
        label: ["New name:"],
        value: "Silent",
        entry: "text",
        softkey: "OK",
      },
    },
    // Personalise › Screen saver sets its value like Tones' (`tree/12-profiles/12-1-2-9.sub`
    // image 01: the profile's own path in the entry indicator).
    setterLevels: { "12-*-2-9": ["off", "on"] },
    entryIndicatorLevels: ["12-*-2-9"],
    noteEnds: { "12-*-2-9-1": { levels: 2 }, "12-*-2-9-2": { levels: 2 } },
  },
  settings: {
    // Settings one menu shares with another (plan 14 D9, P11): Tones are the active profile's
    // Personalise settings, and the virgin EEPROM's active profile is General. Silent and the
    // other profiles keep their own. Plan 17 makes the active profile switchable.
    aliases: [{ prefix: "tones/", target: "profiles/general/personalise/" }],
    // What Restore factory settings writes (plan 15 D5): v6.39's own factory scrolls after
    // `accept/6-4-restore` (`$REF/captures/6.39/plan15/factory/scroll/`, README "v6.39 factory
    // values"). Tones are the General profile's (the alias above). Every list not named keeps its
    // virgin opening; every other text and number returns to virgin, profile names included
    // (`Silenth` became `Silent`).
    factoryDefaults: [
      ...profile("general", 1, [
        "Nokia tune",
        "Level 4",
        "Ringing",
        "Standard",
        "Level 2",
        "On",
        "On",
        "Off",
      ]),
      ...profile("silent", 2, [
        "Nokia tune",
        "Level 1",
        "Off",
        "No tone",
        "Off",
        "Off",
        "Off",
        "On",
      ]),
      ...profile("discreet", 3, [
        "Nokia tune",
        "Level 1",
        "Beep once",
        "Beep once",
        "Level 1",
        "Off",
        "On",
        "On",
      ]),
      ...profile("loud", 4, [
        "Nokia tune",
        "Level 5",
        "Ringing",
        "Special",
        "Level 3",
        "On",
        "On",
        "On",
      ]),
      ...profile("empty", 5, [
        "Get cool",
        "Level 3",
        "Ringing",
        "Standard",
        "Level 2",
        "On",
        "On",
        "On",
      ]),
      ...profile("empty-2", 6, [
        "Nokia tune",
        "Level 3",
        "Ringing",
        "Standard",
        "Level 2",
        "On",
        "On",
        "Off",
      ]),
    ],
  },
};
