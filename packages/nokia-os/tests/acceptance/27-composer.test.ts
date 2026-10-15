// Plan 27's acceptance (docs/plans/27-composer.md Task 12): every asserted Composer golden. Stills
// replay their Task 0 cases (COMPOSER_CASES) from a fresh phone, one fixture per capture
// directory (the images listed in COMPOSER_IMAGE_GAPS are expected to fail, the others to pass);
// timelines replay their recording's keys; sound goldens their recording (Tasks 10, 11). Send's
// transmission (`composer/send-ok`) is plan 18c's. The Composer's tree leaves (5-4-1 … 5-4-7) and
// their Select beeps are plans 14's and 16's goldens.
import {
  COMPOSER_CASES,
  COMPOSER_RECORDING_KEYS,
  composerSoundId,
  composerTimelineId,
  lcdRecording,
  soundRecording,
  stillFixtureOf,
} from "../../scripts/capture-sets/27-composer.ts";
import { acceptancePlan, type Scenario } from "../support/acceptance.ts";
import { composerSound } from "../support/composer.ts";
import {
  PREVIEW_GAPS,
  previewScenario,
  restoreRunScenario,
  ringingChooseScenario,
  stillFixtureScenario,
  timelineScenario,
} from "../support/composer-scenarios.ts";

const STILL_IDS = [...new Set(COMPOSER_CASES.map((c) => stillFixtureOf(c.name).id))];

const SOUND_IDS = COMPOSER_RECORDING_KEYS.filter((r) => soundRecording(r.dir)).map((r) =>
  composerSoundId(r.dir),
);

const SCENARIOS: Record<string, Scenario> = {
  ...Object.fromEntries(STILL_IDS.map((id) => [id, stillFixtureScenario])),
  ...Object.fromEntries(
    COMPOSER_RECORDING_KEYS.filter((r) => lcdRecording(r.dir)).map((r) => [
      composerTimelineId(r.dir),
      timelineScenario,
    ]),
  ),
  "composer/ringing-choose": ringingChooseScenario,
  "composer/restore-run": restoreRunScenario,
  ...Object.fromEntries(
    SOUND_IDS.filter((id) => !id.startsWith("sound/composer/preview-")).map((id) => [
      id,
      (golden: string) => composerSound(golden, { otherRecording: true }),
    ]),
  ),
  ...Object.fromEntries(
    SOUND_IDS.filter((id) => id.startsWith("sound/composer/preview-")).map((id) => [
      id,
      previewScenario,
    ]),
  ),
  "sound/composer/preview-general-slot-3": previewScenario,
  "sound/composer/preview-silent-slot-3": previewScenario,
  "sound/composer/preview-overwritten": previewScenario,
  ...Object.fromEntries(
    [1, 2, 3, 4, 5].map((n) => [`sound/composer/preview-volume-${n}`, previewScenario]),
  ),
};

/** The still fixtures whose images replay long setups (50 tokens, then ▲/▼ key by key). */
const LONG_STILLS = ["composer/cursor-up", "composer/cursor-down", "composer/persist"];

acceptancePlan({
  plan: "27",
  scenarios: SCENARIOS,
  knownGaps: {
    "composer/hold-down":
      "held ▼'s repeated moves show 97-99 ms off the 778/196 ms repeat grid while the cursor " +
      "blinks in the capture (the repeat timer's phase; Task 0's hand fit)",
    "composer/hold-up":
      "held ▲'s repeated moves show off the 778/196 ms repeat grid while the cursor blinks in " +
      "the capture (the repeat timer's phase; Task 0's hand fit)",
    "composer/play-c-held":
      "standby is drawn in two passes in the capture (the operator name ≈85 ms later); nokia-os " +
      "draws it at once",
    "composer/save-c-held-empty":
      "standby is drawn in two passes in the capture (the operator name ≈82 ms later); nokia-os " +
      "draws it at once",
    "composer/play-virgin":
      "the cursor shows at Play's start in the virgin capture where the factory one hides it " +
      "(the blink's phase on a return after Options: no rule fits both)",
    "composer/send-number":
      "a 112 ms transitional frame (the Composer's icon and `OK`) before `Phone number:` in the " +
      "capture; nokia-os shows the prompt at once",
    "composer/send-number-c":
      "the editor's first blink step after C on Send's empty number is 418 ms in the capture, " +
      "not the 478 of every other showing",
    "sound/composer/pitch-level-5":
      "Level 5's jump to the fifth table follows a free-running timer, not the tone (Task 0: " +
      "3627-5309 ms); nokia-os jumps at levelStepMs (D9's nearest behaviour, UNVERIFIED)",
    "sound/composer/play-long-level-5":
      "Level 5's jump follows a free-running timer (D9); nokia-os jumps at levelStepMs",
    "sound/composer/play-long-ascending":
      "Ascending's steps follow a free-running timer (D9); nokia-os steps every levelStepMs",
    "sound/composer/tempo-225":
      "at 225 BPM a 32nd after a dotted 32nd sounds ≈1 ms in the capture (dropped from the " +
      "golden by normalisation); nokia-os sounds it for one timer unit (period less 2 units)",
    ...Object.fromEntries(
      Object.entries(PREVIEW_GAPS).map(([id, why]) => [
        id,
        `${why} (D9; nokia-os: level steps every levelStepMs, Play's periods, the vibrator to the tone's end)`,
      ]),
    ),
  },
  timeoutsMs: {
    ...Object.fromEntries(
      STILL_IDS.map((id) => [id, LONG_STILLS.includes(id) ? 600_000 : 120_000]),
    ),
    ...Object.fromEntries(SOUND_IDS.map((id) => [id, 60_000])),
  },
});
