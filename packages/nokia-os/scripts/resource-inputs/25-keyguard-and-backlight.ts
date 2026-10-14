// Plan 25's resource evidence (plan 29): the keyguard texts' runs for the glyph harvester (checked
// against plan25/text.json) and (Tasks 5-6) the keyguard sprites and widget timelines.
import type { TextRun } from "../harvest-glyphs.ts";
import type { ResourceDeclarations } from "../resource-declarations.ts";

/** A keyguard note's large lines from x 0 at the note tops; its icon lies right of `right`. */
const noteLines = (...lines: readonly string[]): TextRun[] =>
  lines.map((text, i) => ({ font: "large", text, top: 3 + 15 * i, left: 0, right: 62 }));
const softkey = (text: string): TextRun => ({ font: "small", text, top: 40 });

export const resources: ResourceDeclarations = {
  textRuns: {
    // `Keypad locked` (K1) and `Keypad active` (K5): two large lines, the icon at the right.
    "keyguard/lock": { d: noteLines("Keypad", "locked") },
    // `Now press *` (small, from x 6 at tops 7 and 16, in place of the operator) and the
    // `Keypad active` note.
    "keyguard/unlock": {
      b: [
        { font: "small", text: "Now", top: 7, left: 5, right: 40 },
        { font: "small", text: "press *", top: 16, left: 5, right: 50 },
      ],
      d: noteLines("Keypad", "active"),
    },
    // The hint (K3): three large lines.
    "keyguard/hint": { c: noteLines("Press", "Unlock", "and then *") },
    // The locked standby's soft key; the emergency display's number and `Call` (K6).
    "keyguard/standby": { standby: [softkey("Unlock")] },
    "keyguard/emergency/112": {
      d: [{ font: "large", text: "112", top: 24, left: 45, right: 79 }, softkey("Call")],
    },
  },
  glyphOverrides: [
    // `Keypad`: K's leg touches e (keyguard/lock d); e's ink starts 8 columns after K's.
    { kind: "touch", font: "large", pair: "Ke", width: 8 },
    // `*` ends `and then *` (7 columns of ink): one blank column, as the large face's others.
    { kind: "advance", font: "large", char: "*", advance: 8 },
  ],
};
