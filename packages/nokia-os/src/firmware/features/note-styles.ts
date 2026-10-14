// Notes no golden recorded at their own node play a representative recording of the same note
// class (plan 14 D8), by note text. Timelines are keyed by their first covered node
// (`WIDGET_TIMELINE_BY_NODE`).
import type { StockFeature } from "./feature";

export const noteStylesFeature: StockFeature = {
  name: "note-styles",
  widgets: {
    noteStyles: {
      // A tick confirmation (box 684, half 232, full 540 ms).
      Done: "2-7-3-3-2",
      // A long confirmation (full ≈1978 ms).
      "Timeout selected": "5-9-3-1",
      // The looping progress bar.
      Requesting: "7-6",
    },
  },
};
