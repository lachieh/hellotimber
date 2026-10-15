// Plan 19's resource evidence (docs/plans/19-phone-book.md Task 3): the text runs of its goldens
// (generated from Task 0's OCR), the `Please speak now` icon and the phone book's note probes.
// Every value below was measured on the golden it names. The notes' icons are the existing
// sprites: the tick (plan 14), the bin (`erased-*`) and the envelope (`message-sent-*`, plan 18),
// `!` and the octagon; `Erasing memory` and `Sending b'card` show plan 14's hatched bar.
import type { ResourceDeclarations, SpriteCrop } from "../resource-declarations.ts";
import { PHONE_BOOK_TEXT_RUNS } from "../generated/phone-book-text-runs.ts";

/** `Please speak now`'s face, its mouth opening and closing (`phone-book/voice-start` b, c). */
const SPEAK: Pick<SpriteCrop, "x0" | "x1" | "y0" | "y1"> = { x0: 62, x1: 83, y0: 4, y1: 17 };

const sprites: SpriteCrop[] = ["b", "c"].map((image, i) => ({
  id: `please-speak-${i + 1}`,
  group: "please-speak",
  golden: "phone-book/voice-start",
  image,
  ...SPEAK,
}));

/** Notes after a phone book action, by name (`WIDGET_TIMELINE_BY_NAME`), and their goldens. */
const NOTES: readonly [name: string, golden: string, fromFrame?: number][] = [
  ["saved", "phone-book/add-saved"],
  ["replaced", "phone-book/add-duplicate-ok"],
  ["nothing-to-save", "phone-book/add-nothing-to-save"],
  ["memory-full", "phone-book/add-full"],
  ["invalid-sim-char", "phone-book/add-invalid-char"],
  ["speed-dial-saved", "phone-book/speed-assign-2-saved"],
  ["tone-done", "phone-book/tone-ok"],
  // Erasing memory's bar ends (frame 8) with Memory erased's tick.
  ["memory-erased", "phone-book/erase-all-erasing", 8],
  // Start: Please speak now's face for 2.27 s, then Voice system error (frame 8).
  ["voice-system-error", "phone-book/voice-start", 8],
];

export const resources: ResourceDeclarations = {
  textRuns: PHONE_BOOK_TEXT_RUNS,
  glyphOverrides: [
    // `Kim` (phone-book/sim-second second-list): K's leg fills its blank column, as in `Keypad`
    // (plan 25), so it touches i: i's ink starts 8 columns after K's.
    { kind: "touch", font: "large", pair: "Ki", width: 8 },
  ],
  spriteBatches: [{ order: 190, entries: sprites }],
  timelineGroups: {
    "please-speak": ["please-speak"],
    // Erasing memory: plan 14's hatched bar, stepping irregularly once, not looping.
    "erasing-memory": ["progress-bar"],
  },
  timelineBatches: [
    {
      order: 190,
      entries: [
        ...NOTES.map(([name, golden, fromFrame]) => ({
          golden,
          kind: "note",
          name,
          ...(fromFrame === undefined ? {} : { fromFrame }),
        })),
        { golden: "phone-book/erase-large-first-ok", kind: "erased", name: "erased" },
        { golden: "phone-book/erase-last-name-ok", kind: "erased", name: "last-name-erased" },
        { golden: "phone-book/speed-erase-ok", kind: "erased", name: "speed-dial-erased" },
        { golden: "phone-book/erase-all-erasing", kind: "erasing-memory", name: "erasing-memory" },
        { golden: "phone-book/bcard-ok", kind: "message-sent", name: "bcard-sent" },
        { golden: "phone-book/voice-start", kind: "please-speak", name: "please-speak" },
      ],
    },
  ],
};
