// Plan 25's resource evidence (plan 29): the keyguard texts' runs for the glyph harvester (checked
// against plan25/text.json) and (Tasks 5-6) the keyguard sprites and widget timelines.
import type { TextRun } from "../harvest-glyphs.ts";
import type { ResourceDeclarations, SpriteCrop } from "../resource-declarations.ts";

/** A keyguard note's large lines from x 0 at the note tops; its icon lies right of `right`. */
const noteLines = (...lines: readonly string[]): TextRun[] =>
  lines.map((text, i) => ({ font: "large", text, top: 3 + 15 * i, left: 0, right: 62 }));
const softkey = (text: string): TextRun => ({ font: "small", text, top: 40 });
const crop = (
  id: string,
  group: string,
  golden: string,
  image: string,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): SpriteCrop => ({ id, group, golden, image, x0, x1, y0, y1 });

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
  spriteBatches: [
    {
      order: 250,
      entries: [
        // The locked standby's key icon (K2), left of the envelope.
        crop("keyguard/key", "keyguard-key", "keyguard/standby", "standby", 7, 19, 0, 5),
        // `Keypad locked`'s keypad, crossed out over four steps (keyguard/lock d-g).
        ...["d", "e", "f", "g"].map((image, i) =>
          crop(`keyguard/lock-${i + 1}`, "keyguard-lock", "keyguard/lock", image, 62, 83, 0, 25),
        ),
        // The hint's keypad and pressing finger (keyguard/hint c-i; the eighth step repeats c).
        ...["c", "d", "e", "f", "g", "h", "i"].map((image, i) =>
          crop(`keyguard/hint-${i + 1}`, "keyguard-hint", "keyguard/hint", image, 62, 83, 0, 25),
        ),
        // `Now press *` in place of the operator (keyguard/unlock-alone b): its timeline's marker.
        crop(
          "keyguard/now-press",
          "keyguard-now-press",
          "keyguard/unlock-alone",
          "b",
          6,
          40,
          7,
          23,
        ),
        // The emergency display's `Call` (keyguard/emergency/112 d): its timeline's marker.
        crop(
          "keyguard/emergency-call",
          "keyguard-emergency",
          "keyguard/emergency/112",
          "d",
          33,
          49,
          40,
          46,
        ),
      ],
    },
  ],
  timelineGroups: {
    "keyguard-lock": ["keyguard-lock"],
    "keyguard-hint": ["keyguard-hint"],
    "keyguard-now-press": ["keyguard-now-press"],
    "keyguard-emergency": ["keyguard-emergency"],
  },
  timelineBatches: [
    {
      order: 250,
      entries: [
        // K1: 442/232/240/1972 ms and the 9 ms partial draw before the locked standby.
        { golden: "keyguard/lock", kind: "keyguard-lock", name: "keypad-locked", fromFrame: 3 },
        // K3: 564/595/179/202/194/195/579/401 ms and the 8 ms partial (digits, `*`, `#`) ...
        { golden: "keyguard/hint", kind: "keyguard-hint", name: "keyguard-hint" },
        // ... and C, ▲, ▼ (and held keys): the last step 23 ms shorter, a 23 ms partial.
        { golden: "keyguard/hint/up", kind: "keyguard-hint", name: "keyguard-hint-scroll" },
        // K4: `Now press *`, 1448 ms: the unlock window.
        { golden: "keyguard/unlock-alone", kind: "keyguard-now-press", name: "keyguard-now-press" },
        // K5: `Keypad active` with `Done`'s box and tick (683/232/521 ms, the 9 ms partial).
        { golden: "keyguard/unlock", kind: "note", name: "keypad-active", fromFrame: 3 },
        // K6: the emergency display, 3879 ms.
        {
          golden: "keyguard/emergency/112",
          kind: "keyguard-emergency",
          name: "keyguard-emergency",
          fromFrame: 3,
        },
      ],
    },
  ],
  glyphOverrides: [
    // `Keypad`: K's leg fills its blank column, as large R's does, so it touches e (keyguard/lock
    // d); e's ink starts 8 columns after K's. K's advance is 8 everywhere (not plan 18's spacing).
    { kind: "touch", font: "large", pair: "Ke", width: 8 },
    // `*` ends `and then *` (7 columns of ink): one blank column, as the large face's others.
    { kind: "advance", font: "large", char: "*", advance: 8 },
  ],
};
