import type { ResourceDeclarations } from "../resource-declarations.ts";
import type { TextRun } from "../harvest-glyphs.ts";
const softkey = (text: string): TextRun => ({ font: "small", text, top: 40 });
/** Plan 15's security-code prompt: the label, the `*` mask (small, from x 0, top 29) and OK. */
function codePrompt(mask: string, right: number): TextRun[] {
  return [
    { font: "small", text: "Security", top: 7, left: 0, right: 40 },
    { font: "small", text: "code:", top: 16, left: 0, right: 25 },
    ...(mask === "" ? [] : [{ font: "small" as const, text: mask, top: 29, left: 0, right }]),
    softkey("OK"),
  ];
}

/** A plan 15 note's two large lines from x 0 at tops 3 and 18; the icon is right of `right`s. */
function codeNote(second: string, secondRight: number): TextRun[] {
  return [
    { font: "large", text: "Code", top: 3, left: 0, right: 28 },
    { font: "large", text: second, top: 18, left: 0, right: secondRight },
  ];
}

/** The welcome note `Hi` (plan 15 A6): large, from x 1, top 7. */
const WELCOME_HI: readonly TextRun[] = [{ font: "large", text: "Hi", top: 7, left: 1, right: 11 }];

export const resources: ResourceDeclarations = {
  textRuns: {
    // Plan 15 (checked against plan15/text.json): the power-on prompt and its mask, the boot's
    // Code error and Code accepted notes, and the welcome notes.
    "boot/security-gate": {
      d: codePrompt("", 0),
      i: codePrompt("*****", 29),
      j: codeNote("error", 31),
      k: codeNote("accepted", 53),
    },
    "boot/security-gate-keys": { "12-digits-10": codePrompt("**********", 59) },
    "boot/welcome-note": { m: WELCOME_HI },
    "boot/welcome-note-ungated": { d: WELCOME_HI },
    "boot/welcome-note-long": {
      m: [
        { font: "large", text: "Welcome to", top: 7, left: 1, right: 66 },
        { font: "large", text: "my phone", top: 22, left: 1, right: 54 },
      ],
    },
  },
  timelineBatches: [
    {
      order: 20,
      entries: [
        // Plan 15 A4: a wrong security code in Restore factory settings' prompt (2904 ms; the other
        // in-menu prompts' 2902-2905 ms), then the empty prompt.
        { golden: "probe/code-wrong-6-4", kind: "note", name: "code-error" },
        // Plan 15 Task 8: the power-on prompt's own notes. A wrong code: `Code error` (2889 ms), then
        // the empty prompt. The right one: `Code accepted` (689/232/582 ms), then the hands (from
        // frame 12, the prompt after Code error); with a welcome note, `Code accepted` (689/247/491
        // ms) gives way to the note instead.
        { golden: "boot/security-gate", kind: "note", name: "boot-code-error" },
        { golden: "boot/security-gate", kind: "note", name: "code-accepted", fromFrame: 12 },
        { golden: "boot/welcome-note", kind: "note", name: "code-accepted-welcome" },
        // Plan 15 0c: the notes after an accepted security code (the security feature's accept flows).
        { golden: "probe/accept-6-3-5-off", kind: "note", name: "phone-security-done" },
        { golden: "probe/accept-6-3-6-1-match", kind: "note", name: "security-code-changed" },
        { golden: "probe/accept-c7-restore", kind: "note", name: "settings-restored" },
        { golden: "probe/accept-4-5-5", kind: "note", name: "timers-cleared" },
      ],
    },
  ],
};
