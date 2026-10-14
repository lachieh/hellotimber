// Corrections to what `tree-model.ts` reads from the plan 14 captures (plan 14 Task 3). Each entry
// names the capture that shows why the pixels or the crawl cannot be taken as they are.
import type { TreeOverrides } from "./tree-model.ts";

/** Six U+E000 undefined-character boxes: an uninitialised Info service topic name. */
const TOPIC = "\uE000".repeat(6);

export const TREE_OVERRIDES: TreeOverrides = {
  labels: {
    // plan14/scroll/12/06: slot 6 draws two undefined-character boxes (virgin EEPROM); plan 13
    // keeps the label "(empty)", UNVERIFIED until the profiles plan (D10).
    "12-6": "(empty)",
  },
  valueHints: {
    // plan14/scroll/12-6-2 (Rename): slot 6's name draws as two boxes like its label above; the
    // page shows the same "(empty)" (D10).
    "12-6-2-10": "(empty)",
  },
  optionLabels: {
    // plan14/scroll/2-8-4-1/01 (and 2-8-4-2, 2-8-4-3): each topic is six boxes (D10; Topics stays
    // a placeholder for plan 18).
    "2-8-4-1": TOPIC,
    "2-8-4-2": TOPIC,
    "2-8-4-3": TOPIC,
  },
  kinds: {
    // plan14/probe/games/top-score-wait: Top score animates and returns by itself after ≈5.84 s;
    // the crawl's 3.5 s window read it as a static note (D12).
    "8-1-4": "timed-note",
    "8-2-2": "timed-note",
    "8-4-1-3": "timed-note",
    "8-4-2-3": "timed-note",
  },
};
