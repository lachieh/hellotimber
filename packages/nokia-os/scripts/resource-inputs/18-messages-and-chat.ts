// Plan 18's resource evidence (docs/plans/18-messages-and-chat.md Task 3): the text runs of its
// goldens, glyph resolutions, the editor and message sprites and the note probes. Every value
// below was measured on the golden it names.
import type { FontName, GlyphOverride, TextRun } from "../harvest-glyphs.ts";
import type { ResourceDeclarations, SpriteCrop } from "../resource-declarations.ts";
import { MESSAGES_TEXT_RUNS } from "../generated/messages-text-runs.ts";

/** The symbol table in order (plan 18 Task 0: rows of 11/11/9). */
export const SYMBOL_GRID = ". , ? ! : ; - + # * ( ) \\ ' \" _ @ & $ £ % / < > ¿ ¡ § = ¤ € ¥".split(
  " ",
);

/**
 * The symbol table's cells as thin runs: cell k at column k mod 11, row k div 11, its glyph from
 * x 2 + 7 × column at top 7 + 10 × row (`text/symbols-down`; every symbol's ink starts one column
 * into its 8-column cell). Image `01` has the last cell selected, `02` the one before it.
 */
function symbolRuns(cells: readonly number[]): TextRun[] {
  return cells.map((k) => {
    const left = 2 + 7 * (k % 11);
    return {
      font: "thin",
      text: SYMBOL_GRID[k]!,
      top: 7 + 10 * Math.floor(k / 11),
      left,
      right: Math.min(83, left + 6),
    };
  });
}

/**
 * The editor header's counter in the digits face, right-aligned to x 83 (`glyphs/digits`). The
 * mode text left of it is art: `123`'s digits are not the digits face's (a bitmap conflict with
 * the menu indicator), so the four mode texts are sprites.
 */
function counter(text: string): TextRun[] {
  return [{ font: "digits", text, top: 0, left: 50, right: 83 }];
}

/**
 * Characters the goldens show only alone (a glyph sheet, a key press, a symbol cell, the end of
 * the header's mode text): their advance is their ink plus one blank column, as for every
 * measured glyph of the fonts but the digits and four large ones (`tests/harvest.test.ts`).
 */
const SPACING: Readonly<Record<FontName, string>> = {
  small: "$%&/;<=>@Z\\_\"'¡£¤¥§¿ÀÁÂÃÄÆÇÈÉÊËÌÍÎÏÑÒÓÔÖØÙÚÛÜßàáâãäæèéëìíîïòóôöøùúûĞğİı€",
  large:
    "\"$%&'*+,/;<=>?@BFJKQUVXZ\\_¡£¤¥§¿ÀÁÂÃÄÆÇÈÉÊËÌÍÎÏÑÒÓÔÖØÙÚÛÜßàáâãäæçèéêëìíîïñòóôöøùúûüĞğİı€",
  digits: "",
  thin: '!"$%&+-/;<=>?@\\_¡£¤¥§¿€',
};

const glyphOverrides: GlyphOverride[] = [
  // `"` is two strokes with a blank column between them (glyphs/small 168, glyphs/large 168,
  // text/symbols-down 01 cell 14).
  { kind: "span", font: "small", char: '"', width: 3 },
  { kind: "span", font: "large", char: '"', width: 5 },
  { kind: "span", font: "thin", char: '"', width: 3 },
  // glyphs/large 175: `+`'s ink starts at x 3 of Name:'s box, every other glyph's cell at x 2.
  { kind: "bearing", font: "large", char: "+", bearing: 1 },
  ...(Object.entries(SPACING) as [FontName, string][]).flatMap(([font, chars]) =>
    Array.from(chars, (char): GlyphOverride => ({ kind: "spacing", font, char })),
  ),
];

type Rect = Pick<SpriteCrop, "x0" | "x1" | "y0" | "y1">;

/** The editor header's mode text (`prompt/abc` holds Abc, `prompt/abc-lower` abc). */
const MODE: Rect = { x0: 14, x1: 30, y0: 0, y1: 5 };
/** `Erased`'s waste bin, its lid lifting (`sms/inbox-option-erase` d..i). */
const BIN: Rect = { x0: 64, x1: 83, y0: 2, y1: 22 };
/** `Message sent`'s envelope flying off to the top right (`sms/send` l..r). */
const MESSAGE_SENT: Rect = { x0: 63, x1: 83, y0: 0, y1: 24 };

const sprites: SpriteCrop[] = [
  // The editor header (plan 18 S6): the multi-tap pen is `prompt/pen`; Abc and abc are
  // `prompt/abc` and `prompt/abc-lower` (pixel-identical, tests/resources.test.ts).
  {
    id: "editor/mode-upper",
    group: "editor",
    golden: "text/key-modes",
    image: "mode-upper",
    ...MODE,
  },
  { id: "editor/mode-123", group: "editor", golden: "glyphs/digits", image: "004", ...MODE },
  // The symbol table's header mode text.
  { id: "editor/mode-symbols", group: "editor", golden: "text/symbols-down", image: "01", ...MODE },
  // The T9 editor's pen with its bars (plan 18b; the virgin Write messages, D3).
  {
    id: "editor/t9-pen",
    group: "editor",
    golden: "tree/02-messages/2-1.leaf",
    image: "b",
    x0: 0,
    x1: 17,
    y0: 0,
    y1: 5,
  },
  // The standby envelope: the received notice and the unread indicator (the same pixels).
  {
    id: "message/envelope",
    group: "message-icon",
    golden: "sms/notice",
    image: "count-1",
    x0: 7,
    x1: 18,
    y0: 0,
    y1: 5,
  },
  // Inbox rows: an unread message (row 1 of the list, top 8) and a read or saved one (row 2,
  // top 18).
  {
    id: "message/unread",
    group: "message-icon",
    golden: "sms/inbox-list",
    image: "01",
    x0: 0,
    x1: 5,
    y0: 9,
    y1: 14,
  },
  {
    id: "message/read",
    group: "message-icon",
    golden: "sms/inbox-list-one-read",
    image: "02",
    x0: 1,
    x1: 6,
    y0: 18,
    y1: 24,
  },
  ...["l", "m", "n", "o", "p", "q", "r"].map(
    (image, i): SpriteCrop => ({
      id: `message-sent-${i + 1}`,
      group: "message-sent",
      golden: "sms/send",
      image,
      ...MESSAGE_SENT,
    }),
  ),
  ...["d", "e", "f", "g", "h", "i"].map(
    (image, i): SpriteCrop => ({
      id: `erased-${i + 1}`,
      group: "erased",
      golden: "sms/inbox-option-erase",
      image,
      ...BIN,
    }),
  ),
];

/** Notes after a plan 18 action, by name (`WIDGET_TIMELINE_BY_NAME`). */
const NOTES: readonly [name: string, golden: string][] = [
  ["t9-dictionary-deactivated", "text/dictionary-off"],
  ["message-saved", "sms/save"],
  ["centre-number-saved", "sms/centre-1-ok"],
  ["voice-mailbox-saved", "sms/voice-mailbox-ok"],
  ["welcome-note-saved", "welcome/save-hi"],
  ["welcome-note-erased", "welcome/erase-empty"],
  ["no-more-messages-inbox", "sms/inbox-erase-last"],
  ["no-more-messages-outbox", "sms/outbox-erase-last"],
  ["no-phone-numbers", "text/number-search-empty"],
  ["message-memory-full", "sms/full-save"],
];

export const resources: ResourceDeclarations = {
  textRuns: {
    ...MESSAGES_TEXT_RUNS,
    "glyphs/digits": {
      "001": counter("459/1"),
      "002": counter("459/1"),
      "003": counter("459/1"),
      "004": counter("459/1"),
      "005": counter("284/2"),
    },
    "text/symbols-down": {
      ...MESSAGES_TEXT_RUNS["text/symbols-down"],
      "01": [
        ...(MESSAGES_TEXT_RUNS["text/symbols-down"]?.["01"] ?? []),
        ...symbolRuns(SYMBOL_GRID.map((_, k) => k).slice(0, 30)),
      ],
      "02": [...(MESSAGES_TEXT_RUNS["text/symbols-down"]?.["02"] ?? []), ...symbolRuns([30])],
    },
  },
  glyphOverrides,
  spriteBatches: [{ order: 180, entries: sprites }],
  timelineGroups: { "message-sent": ["message-sent"], erased: ["erased"] },
  timelineBatches: [
    {
      order: 180,
      entries: [
        ...NOTES.map(([name, golden]) => ({ golden, kind: "note", name })),
        { golden: "sms/send", kind: "message-sent", name: "message-sent" },
        { golden: "sms/inbox-option-erase", kind: "erased", name: "message-erased" },
      ],
    },
  ],
};
