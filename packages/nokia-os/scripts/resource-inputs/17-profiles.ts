// Plan 17's resource evidence (plan 29 registration): the thin face's missing characters from
// the Rename pages, the large face's U+E000 box from slot 6's virgin Activate note, the standby
// silent icon, and the profiles' notes (Activate per slot, Rename's `Done`, the power list's
// `Invalid shortcut`).
import type { ResourceDeclarations } from "../resource-declarations.ts";
import type { TextRun } from "../harvest-glyphs.ts";

/** The thin glyph pages' characters (`plan17/glyphs/thin/manifest.json`, Task 0 G). */
export const THIN_GLYPH_PAGES: readonly string[] = [
  "BCÄÀÁÂÃÇÈÉ",
  "ËÊHÎÏÌÍİĞJ",
  "ÖÔÒÓØÑQVÜÙ",
  "ÛÚWXZ",
  "äàáâãæèéëê",
  "îïìíığjöôò",
  "óøñqßüùûúz",
];

/** A Rename page's value: the thin face at top 29, right-aligned before the rail (plan 13). */
const pageValue = (text: string): TextRun => ({ font: "thin", text, top: 29, right: 79 });

export const resources: ResourceDeclarations = {
  textRuns: {
    // `plan17/glyphs/thin/NN.png`: Rename pages spelling the typeable characters the thin face
    // lacked, ten per page (Task 0 G, the manifest in the golden's note).
    "profiles/glyphs-thin": Object.fromEntries(
      THIN_GLYPH_PAGES.map((page, i) => [`0${i + 1}`, [pageValue(page)]]),
    ),
    // Slot 6's virgin name, two U+E000 boxes on the note's third line (large face, top 33).
    "tree/12-profiles/12-6-1.leaf": {
      d: [{ font: "large", text: "\uE000\uE000", top: 33 }],
    },
  },
  glyphOverrides: [
    // Glyphs whose ink fills their thin cell touch the next one (plan17/text.json cells of the
    // glyph pages: Î 56 w3, Ï 59 w3, Ì 62 w2, Í 64 w3; Ã 58 w5, Ç 63; ñ 38 w5, q 43; the lower
    // case î ï ì í draw as their capitals): the second's ink starts `width` columns after the
    // first's.
    { kind: "touch", font: "thin", pair: "ÎÏ", width: 3 },
    { kind: "touch", font: "thin", pair: "ÏÌ", width: 3 },
    { kind: "touch", font: "thin", pair: "ÌÍ", width: 2 },
    { kind: "touch", font: "thin", pair: "îï", width: 3 },
    { kind: "touch", font: "thin", pair: "ïì", width: 3 },
    { kind: "touch", font: "thin", pair: "ìí", width: 2 },
    { kind: "touch", font: "thin", pair: "ÃÇ", width: 5 },
    { kind: "touch", font: "thin", pair: "ñq", width: 5 },
    // Only seen at a page's end: the stock spacing (bearing, ink, one blank column), which their
    // OCR cells confirm (J 4 columns, the others 5).
    ...["É", "J", "Ù", "Z", "ê", "ò", "z"].map((char) => ({
      kind: "spacing" as const,
      font: "thin" as const,
      char,
    })),
  ],
  spriteBatches: [
    {
      order: 170,
      entries: [
        // The standby icon while the active profile's Incoming call alert is Off (Task 0 A3):
        // top left, between the signal ladder's icon and the clock.
        {
          id: "profiles/silent",
          group: "profiles",
          golden: "profiles/icon",
          image: "silent",
          x0: 7,
          x1: 13,
          y0: 0,
          y1: 5,
        },
      ],
    },
  ],
  timelineBatches: [
    {
      order: 170,
      entries: [
        // Activate's `Selected profile:` note per slot (virgin recordings, the tree goldens).
        ...["1", "2", "3", "4", "5", "6"].map((n) => ({
          golden: `tree/12-profiles/12-${n}-1.leaf`,
          kind: "note",
          node: `12-${n}-1`,
        })),
        // OK on a new name: `Done` (687-700 / 218-240 / 534-545 ms), then the Rename page.
        { golden: "profiles/rename-silent-ok", kind: "note", name: "rename-done" },
        // 8 in the power list: `Invalid shortcut` (2886 ms), two partial draws, standby.
        {
          golden: "profiles/power-general-digit-8",
          kind: "note",
          name: "power-invalid-shortcut",
        },
      ],
    },
  ],
};
