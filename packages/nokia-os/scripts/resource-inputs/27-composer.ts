// Plan 27's resource evidence (plan 29 registration): the editor's three-note icon, the thin `B` and
// `C` of a saved tone's page value and the Composer's named notes. The notation's glyphs (`#`, `.`,
// `-` and the small digits) are already in the small face from plans 14 and 18.
import type { ResourceDeclarations } from "../resource-declarations.ts";

export const resources: ResourceDeclarations = {
  textRuns: {
    // OK on slot 3's entry: the Ringing tone page shows its name `C`, right-aligned in the thin
    // face at top 29 (`ringing/choose` e: ink x 73..76).
    "composer/ringing-choose": {
      e: [{ font: "thin", text: "C", top: 29, left: 68, right: 77 }],
    },
    // Slot 2's `B` as the stored ringing tone after a cold boot (`persist/ringing-page`: ink x
    // 73..76).
    "composer/persist": {
      "ringing-page": [{ font: "thin", text: "B", top: 29, left: 68, right: 77 }],
    },
  },
  glyphOverrides: [
    // The page value's `B` and `C` are only drawn alone and right-aligned: their advance is the
    // thin face's four ink columns and a blank one, as `G` (UNVERIFIED inside text).
    { kind: "advance", font: "thin", char: "B", advance: 5 },
    { kind: "advance", font: "thin", char: "C", advance: 5 },
  ],
  spriteBatches: [
    {
      order: 270,
      entries: [
        // The empty editor (`entry/empty`): the three notes top left, x 1..16, y 0..5.
        {
          id: "composer/icon",
          group: "composer",
          golden: "composer/entry",
          image: "empty",
          x0: 1,
          x1: 16,
          y0: 0,
          y1: 5,
        },
      ],
    },
  ],
  timelineBatches: [
    {
      order: 270,
      entries: [
        // Save's OK: `Tone saved` (the tick), then Options on Save (Task 0 N).
        { golden: "composer/save-ok", kind: "note", name: "composer-tone-saved" },
        // Tempo's OK: `Done` (the tick), then Options on Tempo (Task 0 O).
        { golden: "composer/tempo-done-40", kind: "note", name: "composer-tempo-done" },
      ],
    },
  ],
};
