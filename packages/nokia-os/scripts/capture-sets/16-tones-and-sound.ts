// Plan 16's goldens (docs/plans/16-tones-and-sound.md "Golden pipeline"): every sound golden,
// from the table and the shared note recordings of scripts/sound-capture-set.ts.
import type { PlanCaptureSet } from "../capture-set.ts";
import { SOUND_NOT_IMPORTED, soundCaptureSet } from "../sound-capture-set.ts";

export const tonesAndSound: PlanCaptureSet = {
  plan: "16",
  sounds: (io) => soundCaptureSet(io.sound),
  notImported: SOUND_NOT_IMPORTED,
};
