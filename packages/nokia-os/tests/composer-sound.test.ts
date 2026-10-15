// Plan 27 Task 11: the Composer's sound goldens through the phone: entry sounds, holds, the limit,
// pitches, tempi and Play (gating, levels, keys during Play), each replayed from its recording's
// setup (`COMPOSER_RECORDING_KEYS`) with plan 16's tolerances. The previews are Task 10's.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { composerRecording, composerSound } from "./support/composer";

const IDS = readdirSync(join(import.meta.dirname, "../goldens/sound/composer"))
  .map((file) => `sound/composer/${file.replace(/\.sound\.txt$/, "")}`)
  .filter((id) => !id.startsWith("sound/composer/preview-"));

/**
 * Goldens nokia-os does not reproduce (Task 12 lists them as known gaps), by id: why.
 */
export const SOUND_GAPS: Readonly<Record<string, string>> = {
  "sound/composer/pitch-level-5":
    "Level 5's jump to the fifth table follows a free-running timer (D9: nokia-os at levelStepMs)",
  "sound/composer/play-long-level-5":
    "Level 5's jump follows a free-running timer (D9: nokia-os at levelStepMs)",
  "sound/composer/play-long-ascending":
    "Ascending's steps follow a free-running timer (D9: nokia-os every levelStepMs)",
  "sound/composer/tempo-225":
    "a 32nd after a dotted 32nd sounds ≈1 ms at 225 BPM (dropped from the golden), one unit here",
};

describe("the Composer's sound goldens on the phone", () => {
  it("has a recording for every golden", () => {
    expect(IDS.length).toBe(134);
    for (const id of IDS) expect(composerRecording(id)).toBeDefined();
  });
  for (const id of IDS) {
    if (id in SOUND_GAPS) continue;
    it(id, () => composerSound(id, { otherRecording: true }), 60_000);
  }
});
