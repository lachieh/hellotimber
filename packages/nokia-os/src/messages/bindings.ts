// Plan 18's tables for Write messages (Task 10): the multi-tap editor's Options as Task 0
// recorded them (with the golden that shows each, or the plan that owns it), the flows composed
// without a capture, and the virgin values plan 18 overrides.

/** One entry of the multi-tap editor's Options (`text/options`: nine). */
export interface EditorOption {
  readonly label: string;
  /** The golden that shows what OK on it does. */
  readonly golden: string;
  /** The plan that owns what it does beyond the virgin capture (names, content, T9). */
  readonly owner?: string;
}

/**
 * The multi-tap editor's Options, in order (`text/options`, Task 0: nine entries, without
 * Insert word, Insert number and Insert symbol, which only the T9 editor lists: plan 18b).
 */
export const EDITOR_OPTIONS: readonly EditorOption[] = [
  { label: "Send", golden: "sms/send" },
  // The virgin phone book's note; with names, plan 19's list (Send to many with names).
  { label: "Send to many", golden: "sms/send-to-many", owner: "19" },
  // No response in the captured state; templates are plan 18c's.
  { label: "Template", golden: "sms/template", owner: "18c" },
  { label: "Insert smiley", golden: "sms/insert-smiley", owner: "18c" },
  // Dictionary off and its note; English, Русский and Български are plan 18b's.
  { label: "Dictionary", golden: "text/dictionary-off", owner: "18b" },
  { label: "Send by set", golden: "sms/send-by-set-numeric" },
  { label: "Save", golden: "sms/save" },
  { label: "Erase", golden: "sms/erase" },
  { label: "Exit", golden: "sms/exit" },
];

/** The Dictionary list (`text/dictionary-off` frame 10); the T9 entries are plan 18b's. */
export const DICTIONARY_LABELS: readonly string[] = [
  "Dictionary off",
  "English",
  "Русский",
  "Български",
];

/** Messages › Write messages' Dictionary choice. */
export const DICTIONARY_KEY = "messages/dictionary";

/**
 * Virgin values plan 18 overrides (D3): the virgin phone writes with the English T9 dictionary
 * (`tree/02-messages/2-1.leaf`, `text/dictionary-off` frame 9); without T9 (plan 18b) the editor
 * starts with Dictionary off. Plan 18b removes this.
 */
export const VIRGIN_OVERRIDES: Readonly<Record<string, number>> = {
  [DICTIONARY_KEY]: DICTIONARY_LABELS.indexOf("Dictionary off"),
};

/**
 * Flows no capture shows, composed from the firmware's strings and a captured class of note
 * (UNVERIFIED, D14): a send the host fails shows `Message sending failed` (string 0x480) as an
 * error note, as `Code error` plays (≈2.9 s), then the editor with its text.
 */
export const COMPOSED_FLOWS = {
  sendFailed: { lines: ["Message", "sending", "failed"], timeline: "code-error" },
} as const;
