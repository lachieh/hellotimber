// Plan 27's resource evidence (plan 29 registration): the editor's three-note icon and the
// Composer's named notes. The notation's glyphs (`#`, `.`, `-` and the small digits) are already in
// the small face from plans 14 and 18, so no text run is needed.
import type { ResourceDeclarations } from "../resource-declarations.ts";

export const resources: ResourceDeclarations = {
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
