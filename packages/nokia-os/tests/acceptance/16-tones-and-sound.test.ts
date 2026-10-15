// Plan 16's acceptance (docs/plans/16-tones-and-sound.md "Acceptance"): every sound golden's
// events, from the scenarios of tests/support/sound-scenarios.ts.
import { acceptancePlan } from "../support/acceptance.ts";
import { SOUND_SCENARIOS } from "../support/sound-scenarios.ts";

acceptancePlan({
  plan: "16",
  scenarios: SOUND_SCENARIOS,
  knownGaps: {
    "sound/keypad/pair":
      "the ▲ pressed 70 ms before the DSP powers down beeps for 77 ms in the capture (one " +
      "recording: the tone starts 93 ms after the key and stops where a 145 ms beep would); " +
      "nokia-os beeps 145 ms (plan 16 D8)",
    "sound/note/1-2":
      "Phone book › Search shows `No phone numbers` ≈150 ms after OK in the capture, so OK's " +
      "beep sounds before the note's tone replaces it; nokia-os opens the note at the key " +
      "(plan 14 D8), so its tone replaces the beep at once",
    "sound/alert/ascending-l5":
      "Ascending at Level 5: the Level 2 → 3 step and Nokia tune's last note race in this " +
      "recording (that note stays at Level 2; in the Level 4 recordings it steps, `ascendingAt`)",
  },
});
