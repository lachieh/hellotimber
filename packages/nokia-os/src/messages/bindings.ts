// Plan 18's tables for Write messages (Task 10): the multi-tap editor's Options as Task 0
// recorded them (with the golden that shows each, or the plan that owns it), the flows composed
// without a capture, and the virgin values plan 18 overrides. Plan 18b adds the T9 editor's
// Options and the Dictionary's virgin choice with and without a T9 dictionary.

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
  // Dictionary off and its note, English (plan 18b); Русский and Български are plan 26's (18b D11).
  { label: "Dictionary", golden: "text/dictionary-off", owner: "26" },
  { label: "Send by set", golden: "sms/send-by-set-numeric" },
  { label: "Save", golden: "sms/save" },
  { label: "Erase", golden: "sms/erase" },
  { label: "Exit", golden: "sms/exit" },
];

/** One entry of the T9 editor's Options (plan 18b, spec 10.1). */
export interface T9EditorOption {
  readonly label: string;
  /** The golden that shows what OK on it does; none: UNVERIFIED (the crawl's tree only). */
  readonly golden?: string;
  /** The plan that owns what it does beyond the captures. */
  readonly owner?: string;
  /** Listed only while a word is composing (Matches). */
  readonly composing?: true;
}

/**
 * The T9 editor's Options, in order (spec 10.1: `t9/options-empty` twelve, `t9/g-options`
 * thirteen with Matches after Insert smiley while a word is composing).
 */
export const T9_EDITOR_OPTIONS: readonly T9EditorOption[] = [
  { label: "Send", golden: "sms/send" },
  { label: "Send to many", golden: "sms/send-to-many", owner: "19" },
  { label: "Template", golden: "sms/template", owner: "18c" },
  { label: "Insert smiley", golden: "sms/insert-smiley", owner: "18c" },
  { label: "Matches", golden: "t9/g-matches/10-used", composing: true },
  { label: "Insert word", golden: "t9/g-insert-word/07-after-ok" },
  // The menu-tree crawl: `Insert number:` with OK, and the symbol table (no golden, UNVERIFIED).
  { label: "Insert number" },
  { label: "Insert symbol" },
  // Русский and Български are plan 26's (18b D11).
  { label: "Dictionary", golden: "t9/dictionary-off-on/19-on", owner: "26" },
  { label: "Send by set", golden: "sms/send-by-set-numeric" },
  { label: "Save", golden: "sms/save" },
  { label: "Erase", golden: "sms/erase" },
  { label: "Exit", golden: "sms/exit" },
];

/** The Dictionary list (`text/dictionary-off` frame 10, `t9/dictionary-list`). */
export const DICTIONARY_LABELS: readonly string[] = [
  "Dictionary off",
  "English",
  "Русский",
  "Български",
];

/** Messages › Write messages' Dictionary choice. */
export const DICTIONARY_KEY = "messages/dictionary";

/** The virgin phone writes with the English T9 dictionary (`tree/02-messages/2-1.leaf`, 18b D6). */
export const VIRGIN_DICTIONARY = DICTIONARY_LABELS.indexOf("English");

/**
 * The virgin choices of a phone without a T9 dictionary (plan 18b D5): Dictionary off, the editor
 * multi-tap, as after plan 18 (its D3).
 */
export const NO_T9_VIRGIN_CHOICES: Readonly<Record<string, number>> = {
  [DICTIONARY_KEY]: DICTIONARY_LABELS.indexOf("Dictionary off"),
};

/**
 * The Dictionary entries that open a later owner's placeholder: the Cyrillic dictionaries (plan
 * 26, 18b D11), and English on a phone without a T9 dictionary (the host's `config.t9`, D5).
 */
export const DICTIONARY_OWNERS: Readonly<Record<string, string>> = {
  Русский: "26",
  Български: "26",
  English: "config",
};

/**
 * Flows no capture shows, composed from the firmware's strings and a captured class of note
 * (UNVERIFIED, D14): a send the host fails shows `Message sending failed` (string 0x480) as an
 * error note, as `Code error` plays (≈2.9 s), then the editor with its text.
 */
export const COMPOSED_FLOWS = {
  sendFailed: { lines: ["Message", "sending", "failed"], timeline: "code-error" },
} as const;
