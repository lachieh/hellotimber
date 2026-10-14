// Plan 16's acceptance (docs/plans/16-tones-and-sound.md "Acceptance"): every sound golden's
// events, from the scenarios of tests/support/sound-scenarios.ts.
import { acceptancePlan } from "../support/acceptance.ts";
import { SOUND_SCENARIOS } from "../support/sound-scenarios.ts";

/** Badinerie's Level 4 recording (its program) rests 8 ms where other recordings do not. */
const BADINERIE_REST =
  "Badinerie's Level 4 recording, the program, rests 8 ms between two 831 Hz notes ≈2.28 s " +
  "into the preview; this recording plays them as one";

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
    "sound/alert/ascending/15-badinerie": BADINERIE_REST,
    "sound/ringing-tone/level-3/15-badinerie": BADINERIE_REST,
    "sound/ringing-tone/level-5/33-mangrove":
      "this recording lacks Mangrove's 27th 7 ms chirp (≈25.7 s into the preview; 35 of the 36 " +
      "the Level 4 recording, the program, plays)",
  },
});
