// Plan 18c's resource evidence (plan 29 registration): the template row icon and the notes of
// Templates, Smileys, Topics and the Service command editor, each measured on the golden it names.
import type { ProbeTimeline, ResourceDeclarations, SpriteCrop } from "../resource-declarations.ts";

const sprites: SpriteCrop[] = [
  // A template row's icon, left of the band from the row's top + 1 (`content/templates-list` 01,
  // row 1: top 7).
  {
    id: "content/template",
    group: "content",
    golden: "content/templates-list",
    image: "01",
    x0: 1,
    x1: 6,
    y0: 8,
    y1: 14,
  },
];

/** Notes after a plan 18c action, by name (`WIDGET_TIMELINE_BY_NAME`). */
const NOTES: readonly ProbeTimeline[] = [
  // Options › Save in a slot's editor (≈1.5 s), then the editor.
  { golden: "content/templates-save", kind: "note", name: "template-saved" },
  { golden: "content/smileys-save", kind: "note", name: "smiley-saved" },
  // Read › Options › Erase: the bin's lid lifts (`Template erased`, ≈3 s); `Smiley erased` holds
  // one frame (≈2.9 s).
  { golden: "content/templates-erase-default", kind: "erased", name: "template-erased" },
  { golden: "content/smileys-erase-default", kind: "note", name: "smiley-erased" },
  // Info service › Topics: Add topic's `Topic added`, Edit's `Saved`, Erase's `Topic erased`.
  { golden: "topics/add-name-ok", kind: "note", name: "topic-added" },
  { golden: "topics/edit-name-ok", kind: "note", name: "topic-saved" },
  { golden: "topics/erase-1", kind: "note", name: "topic-erased" },
  // The Service command editor's Send: `Not done` after Requesting (frame 56), then standby.
  { golden: "service-command/send", kind: "note", name: "service-not-done", fromFrame: 56 },
];

export const resources: ResourceDeclarations = {
  spriteBatches: [{ order: 187, entries: sprites }],
  timelineBatches: [{ order: 187, entries: NOTES }],
};
