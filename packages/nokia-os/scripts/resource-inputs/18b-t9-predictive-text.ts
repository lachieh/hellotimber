// Plan 18b's resource evidence: the note English shows when it switches T9 back on
// (`t9/dictionary-off-on/19-on`: `T9 dictionary activated`, the tick note's phases, then the T9
// editor), by name (`WIDGET_TIMELINE_BY_NAME`).
import type { ResourceDeclarations } from "../resource-declarations.ts";

export const resources: ResourceDeclarations = {
  timelineBatches: [
    {
      order: 185,
      entries: [
        { golden: "t9/dictionary-off-on/19-on", kind: "note", name: "t9-dictionary-activated" },
      ],
    },
  ],
};
