// Plan 18's goldens (docs/plans/18-messages-and-chat.md "Golden pipeline additions"): text entry,
// the Welcome note and SMS, from the table of scripts/messages-capture-set.ts.
import type { PlanCaptureSet } from "../capture-set.ts";
import { resources } from "../resource-inputs/18-messages-and-chat.ts";
import {
  messagesCaptureSet,
  MESSAGES_NOT_IMPORTED,
  type GlyphShot,
} from "../messages-capture-set.ts";

export const messagesAndChat: PlanCaptureSet = {
  plan: "18",
  resources,
  lcd: (io) =>
    messagesCaptureSet({
      recording: (dir) => io.frames.recording(dir),
      scrollImages: (dir) => io.frames.scrollImages(dir),
      manifest: (face) =>
        io.json(`plan18/glyphs/${face}/manifest.json`) as readonly GlyphShot[] | undefined,
    }),
  notImported: MESSAGES_NOT_IMPORTED,
};
