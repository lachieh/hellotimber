// The phone book's timings that no single golden fixes (plan 19 Task 0's medians over several
// captures; one of each is imported). The notes' timelines are generated
// (`WIDGET_TIMELINE_BY_NAME`, scripts/resource-inputs/19-phone-book.ts).
import type { SoundProgram } from "@hellotimber/nokia-kit/ui/sound/program";

/**
 * Standby ▲/▼ show standby with the ladders erased this long before their target (16 presses
 * in `plan19/standby/`: 22-37 ms, median 23; `phone-book/standby-delay` is one).
 */
export const STANDBY_KEY_DELAY_MS = 23;

/**
 * `Sending b'card` lasts at least this long before `Business card sent` (six sends in
 * `plan19/bcard/`: 3237.4-3358.5 ms, median 3240; the synthetic cell's link time, plan 18 D10's
 * policy; UNVERIFIED on a live network).
 */
export const BCARD_LINK_MS = 3240;

/**
 * Assign tone's `No tone` preview: a 1750 Hz tone for 339 ms on the tone generator's word 0x9104
 * (`sound/phone-book/tone-preview-no-tone`, 999-1338 ms after ▲), at the list's preview delay.
 */
export const NO_TONE_PREVIEW: SoundProgram = {
  id: "phone-book/no-tone",
  steps: [{ ms: 339, tone: { hz: 1750, volume: 0x9104 } }],
};

/**
 * Voice tags' Start beeps on the voice DSP's words: 900 Hz on 0x7008 for 14 ms, then 0x99B4
 * (`sound/phone-book/voice-system-error` 33-178 ms; the keypad beep's 145 ms).
 */
export const VOICE_START_BEEP: SoundProgram = {
  id: "phone-book/voice-start",
  steps: [
    { ms: 14, tone: { hz: 900, volume: 0x7008 } },
    { ms: 131, tone: { hz: 900, volume: 0x99b4 } },
  ],
};

/**
 * `Voice system error`'s three 675 Hz DSP beeps on word 0x99B5 from the note's start
 * (`sound/phone-book/voice-system-error`: 2310-2455, 2494-2711, 2749-2896 ms).
 */
export const VOICE_ERROR_BEEPS: SoundProgram = {
  id: "phone-book/voice-system-error",
  steps: [
    { ms: 145, tone: { hz: 675, volume: 0x99b5 } },
    { ms: 39, tone: null },
    { ms: 217, tone: { hz: 675, volume: 0x99b5 } },
    { ms: 38, tone: null },
    { ms: 147, tone: { hz: 675, volume: 0x99b5 } },
  ],
};

/**
 * Send on a name draws the list's icon and `OK` alone this long before `Phone number:`
 * (`phone-book/bcard-send` frame 1: 114 ms).
 */
export const BCARD_OK_MS = 114;

/**
 * Write messages › Options › Send to many with names draws `OK` alone this long before the list
 * (`phone-book/pick-send-to-many` frame 1: 146 ms; plan 18's 168 before the empty SIM's note).
 */
export const SEND_TO_MANY_LIST_OK_MS = 146;
