// Plan 20's resource evidence (plan 29 registration): the small face's `/`, the one glyph the
// calculator draws that no other golden shows, and the calculator's named notes.
import type { ResourceDeclarations } from "../resource-declarations.ts";

export const resources: ResourceDeclarations = {
  textRuns: {
    // `12 / 3`: the operator line, right-aligned in the small face at top 18 (plan20/text.json:
    // `/` at x 80, y 18).
    "calculator/operators": {
      "digit-after-divide": [{ font: "small", text: "/", top: 18, left: 79, right: 83 }],
    },
  },
  glyphOverrides: [
    // `/` is only drawn alone and right-aligned (its ink 3 columns, ending one column before the
    // cell's end, as every small glyph's): the advance cannot be measured inside a word, and any
    // advance with bearing 0 draws it the same right-aligned. 4 keeps the trailing blank column
    // of the small face's narrow glyphs (`.`). UNVERIFIED inside text.
    { kind: "advance", font: "small", char: "/", advance: 4 },
  ],
  timelineBatches: [
    {
      order: 200,
      entries: [
        // OK on Equals: the note (2906 ms), then the screen before Equals (plan 20 Task 0 N).
        { golden: "calculator/out-of-range", kind: "note", name: "calculator-out-of-range" },
        { golden: "calculator/divide-by-zero", kind: "note", name: "calculator-divide-by-zero" },
        // OK on the rate prompt: the tick (694/232/523 ms), then the calculator (Task 0 X).
        { golden: "calculator/rate-saved", kind: "note", name: "calculator-rate-saved" },
      ],
    },
  ],
};
