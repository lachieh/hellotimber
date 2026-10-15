// Tones (menu 5; plan 16) and the same settings in every profile's Personalise: the option lists
// that beep or preview what they highlight, Ringing volume's Level 5 query, and Screen saver's
// setter level. The sound itself is the sounder's (src/sound/sounder.ts).
import { PREVIEW_LISTS } from "../../sound/sounder";
import type { StockFeature } from "./feature";

/**
 * A profile setting's key split into its profile prefix (`tones`, the active profile's through
 * the profiles feature's alias, or `profiles/<profile>/personalise`) and its setting slug;
 * undefined for other keys.
 */
export function profileSetting(key: string): { prefix: string; setting: string } | undefined {
  const match = /^(tones|profiles\/[a-z0-9-]+\/personalise)\/([a-z0-9-]+)$/.exec(key);
  return match === null ? undefined : { prefix: match[1]!, setting: match[2]! };
}

export const tonesFeature: StockFeature = {
  name: "tones",
  placeholders: {
    "5-9-4": "18c", // Screen saver › Screen saver: nothing in the virgin EEPROM
  },
  // Plan 16 (Tones and every Personalise): the Keypad tones list's keys beep at the option
  // highlighted (▲/▼ at the one they move to), C at the stored one (Task 0); the preview lists
  // preview it (D9), except the first move out of an unset list (S9), and stop when the list
  // closes.
  optionLists(key, { sounder }) {
    const profile = profileSetting(key);
    if (profile === undefined) return undefined;
    if (profile.setting === "keypad-tones") {
      return {
        keyDown: (pressed, highlighted) => {
          if (pressed !== "c") sounder.keyBeepLevel(highlighted);
        },
      };
    }
    const list = PREVIEW_LISTS.find((slug) => slug === profile.setting);
    if (list === undefined) return undefined;
    return {
      highlight: (index, previous) => {
        if (previous === null) sounder.stopPreview();
        else sounder.preview(list, index, profile.prefix);
      },
      close: () => sounder.stopPreview(),
    };
  },
  widgets: {
    // Ringing volume › Level 5 stores the choice only after OK, then `Done` (P8).
    queryResults: {
      "Select maximum": { kind: "note", lines: ["Done"], timeline: "level-5-done" },
    },
    // Screen saver's leaves set its value (no option list); the page shows the label and the
    // level opens on it. Opening on the stored value after On is UNVERIFIED (virgin: Off).
    setterLevels: { "5-9": ["off", "on"] },
    // Screen saver's Select-entry shows `5-9-` and the awaiting dots (`tree/05-tones/5-9.sub`
    // image 01) for the stock shortcut window (D14: ≈2.9 s; no capture runs it to its end). Keys
    // work meanwhile (▼ shows `5-9-2`, image 02; OK on Off opens its note, `5-9-1.leaf` frame 0).
    entryIndicatorLevels: ["5-9"],
    // The setters return to their page (`tree/05-tones/5-9-2.leaf` image e).
    noteEnds: { "5-9-1": { levels: 2 }, "5-9-2": { levels: 2 } },
  },
};
