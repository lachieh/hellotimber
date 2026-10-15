// Profiles (menu 12; plan 17): a profile is its Personalise settings plus a name. The active
// profile is the stored choice `profiles/active` (D1), and Tones are its Personalise settings, so
// every effect of a profile (keypad tones, warning tones, previews, the vibrator, game shakes)
// follows it with no plan 16 change (D11). Names are the Rename texts (D2). Each profile's
// Personalise is General's subtree; Screen saver's setter level; the factory values.
import type { StockSettings } from "../settings";
import type { FactoryDefault, StockFeature } from "./feature";

/** The six v6.39 slots in order (P11: no Meeting, Outdoor or Pager profile). */
export const PROFILE_SLUGS = ["general", "silent", "discreet", "loud", "empty", "empty-2"] as const;
export type ProfileSlug = (typeof PROFILE_SLUGS)[number];

/** The active profile: a single choice over PROFILE_SLUGS; never written = General (P7). */
export const ACTIVE_PROFILE_KEY = "profiles/active";

/** A profile's name has at most this many characters (P6: the Rename counter starts at 10). */
export const PROFILE_NAME_LIMIT = 10;

/** The name an empty Rename restores: the slot's factory name (P6; slot 6: R5). */
const DEFAULT_NAMES: Readonly<Record<Exclude<ProfileSlug, "general">, string>> = {
  silent: "Silent",
  discreet: "Discreet",
  loud: "Loud",
  empty: "(empty)",
  "empty-2": "(empty)",
};

const TONES = "tones/";

/** The active profile (D1). */
export function activeProfile(settings: StockSettings): ProfileSlug {
  return PROFILE_SLUGS[settings.choice(ACTIVE_PROFILE_KEY) ?? 0]!;
}

/** Makes `slug` the active profile; stored at once. */
export function activateProfile(settings: StockSettings, slug: ProfileSlug): void {
  settings.choose(ACTIVE_PROFILE_KEY, PROFILE_SLUGS.indexOf(slug));
}

/** The Rename text of a profile (General has none, P11). */
function renameKey(slug: Exclude<ProfileSlug, "general">): string {
  return `profiles/${slug}/personalise/rename`;
}

/** A profile's name, wherever one is drawn (D2): General's is constant, the others' stored. */
export function profileName(settings: StockSettings, slug: ProfileSlug): string {
  if (slug === "general") return "General";
  return settings.text(renameKey(slug)) ?? DEFAULT_NAMES[slug];
}

/** Renames a profile (P6); an empty name restores the slot's factory name. */
export function renameProfile(settings: StockSettings, slug: ProfileSlug, name: string): void {
  if (slug === "general") throw new Error("General has no Rename (P11).");
  if (Array.from(name).length > PROFILE_NAME_LIMIT) {
    throw new Error(`A profile name has at most ${PROFILE_NAME_LIMIT} characters: "${name}".`);
  }
  settings.setText(renameKey(slug), name === "" ? DEFAULT_NAMES[slug] : name);
}

/** Tones' alias target with `active` the active profile (D1): `tones/x` → its Personalise `x`. */
export function profileAlias(key: string, active: ProfileSlug): string {
  return key.startsWith(TONES) ? `profiles/${active}/personalise/${key.slice(TONES.length)}` : key;
}

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
    "12-*-2-9-4": "18c", // Personalise › Screen saver › Screen saver: nothing in the virgin EEPROM
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
    // Personalise settings (D1); the virgin EEPROM's active profile is General. Composer has no
    // Personalise counterpart, so it keeps its own.
    aliases: [
      {
        prefix: TONES,
        target: (choice) => profileAlias(TONES, PROFILE_SLUGS[choice(ACTIVE_PROFILE_KEY) ?? 0]!),
      },
    ],
    choices: [{ key: ACTIVE_PROFILE_KEY, options: PROFILE_SLUGS.length }],
    // Restore gives slot 6 the name (empty), not the virgin boxes (plan 15 Task 0c).
    factoryTexts: [
      {
        key: renameKey("empty-2"),
        text: "(empty)",
        evidence: "v6.39",
        capture: "plan17/persist/after-restore/profiles-6.png",
      },
    ],
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
