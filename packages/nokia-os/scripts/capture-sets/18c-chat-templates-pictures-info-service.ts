// Plan 18c's goldens (docs/plans/18c-chat-templates-pictures-info-service.md "Golden pipeline
// additions"): Templates, Smileys and their insertion, Restore's lists, Chat, Info service ›
// Topics and the Service command editor, from Task 0's recaptures under
// `$REF/captures/6.39/plan18c/` (`gen_v639_plan18c.py`).
//
// An explicit table (`CONTENT_TABLE`): recordings become timelines (their trigger the first
// changed frame, plan 14 D8), shot and scroll directories stills. Every golden is asserted once
// its scenario passes (tests/acceptance/18c-chat-templates-pictures-info-service.test.ts) and
// `pending:<plan>` while an owner's work is missing (`PENDING`). Picture messages, the screen
// saver gallery and business cards have no verified v6.39 captures (plan 18c D4, Task 0 R/B):
// nothing of theirs is imported.
//
// Pure: imports only sibling scripts, reads captures through the injected io.
import type { CaptureSetEntry, PlanCaptureSet } from "../capture-set.ts";
import type { GoldenStatus } from "../golden-format.ts";
import { resources } from "../resource-inputs/18c-chat-templates-pictures-info-service.ts";
import { firstChangedFrame, type TreeCaptureIo } from "../tree-capture-set.ts";

const BASE = "plan18c";

export class ContentCaptureError extends Error {
  constructor(where: string, message: string) {
    super(`${where}: ${message}`);
    this.name = "ContentCaptureError";
  }
}

/** One golden of the table: a recording, named shots of one directory, or a scroll. */
export type ContentRow =
  | { readonly kind: "recording"; readonly id: string; readonly dir: string; readonly note: string }
  | {
      readonly kind: "shots";
      readonly id: string;
      /** `[file under plan18c/ without .png, image name]`. */
      readonly shots: readonly (readonly [string, string])[];
      readonly note: string;
    }
  | {
      readonly kind: "scroll";
      readonly id: string;
      readonly dir: string;
      /** Keep the first `keep` screens (the rest past the list's wrap). */
      readonly keep?: number;
      readonly note: string;
    };

const recording = (id: string, dir: string, note: string): ContentRow => ({
  kind: "recording",
  id,
  dir,
  note,
});
const shots = (
  id: string,
  files: readonly (readonly [string, string])[],
  note: string,
): ContentRow => ({ kind: "shots", id, shots: files, note });
const scroll = (id: string, dir: string, note: string, keep?: number): ContentRow => ({
  kind: "scroll",
  id,
  dir,
  note,
  ...(keep === undefined ? {} : { keep }),
});
const range = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, "0"));

/** Templates (2-5) and Smileys (2-6), the same flows on the factory image (Task 0 T). */
function contentRows(kind: "templates" | "smileys"): ContentRow[] {
  const what = kind === "templates" ? "Templates" : "Smileys";
  const id = (name: string) => `content/${kind}-${name}`;
  const dir = (name: string) => `${kind}/${name}`;
  const slots = range(8);
  return [
    recording(id("open"), dir("open"), `Messages › ${what} highlighted, Select: the list.`),
    scroll(id("list"), dir("list"), `${what}' list from the first slot, ▼ per image to the wrap.`),
    recording(id("read-1"), dir("read-1"), "The list on slot 1, Read: the text in the small face."),
    shots(
      id("read"),
      slots.flatMap((n) => [
        [`${dir("read")}/${n}`, n],
        [`${dir("read")}/${n}-down`, `${n}-down`],
      ]),
      "Read of each slot (▼ k-1 from the list), then ▼ (nothing moves).",
    ),
    recording(id("options-1"), dir("options-1"), "Read on slot 1, Options: Edit, Erase."),
    recording(id("options-6"), dir("options-6"), "Read on slot 6 (empty), Options."),
    scroll(id("options-1-list"), dir("options/01"), "Slot 1's Options, ▼ to the wrap."),
    scroll(id("options-6-list"), dir("options/06"), "Slot 6's Options, ▼ to the wrap."),
    recording(id("edit-1"), dir("edit-1"), "Options › Edit on slot 1: the editor on its text."),
    recording(id("edit-6"), dir("edit-6"), "Options › Edit on slot 6: the empty editor."),
    shots(
      id("edit"),
      range(6).map((n) => [`${dir("edit")}/${n}`, n]),
      "The editor on slots 1-6: the counter shows the characters left of the limit.",
    ),
    scroll(id("edit-options-1"), dir("edit-options/01"), "The editor's Options with text."),
    scroll(id("edit-options-6"), dir("edit-options/06"), "The editor's Options, empty text."),
    scroll(
      id("edit-options-empty"),
      dir("edit-options-empty"),
      "The empty editor's Options (slot 6 opened): no Save while the text is empty.",
    ),
    recording(id("list-c"), dir("list-c"), "C on the list: back to Messages."),
    recording(id("read-c"), dir("read-c"), "C on Read: back to the list."),
    recording(
      id("save"),
      dir("save"),
      "Slot 1 edited (a typed), Options › Save: the note, the editor.",
    ),
    recording(id("edit-exit"), dir("edit-exit"), "Options › Exit after Save: standby."),
    shots(
      id("edited"),
      [
        [dir("edit-typed"), "typed"],
        [dir("edited/list"), "list"],
        [dir("edited/read"), "read"],
        [dir("edited/erased-list"), "erased-list"],
        [dir("edited/erased-read"), "erased-read"],
      ],
      "Slot 1 edited and saved: the list and Read; Erase brings the default back.",
    ),
    recording(
      id("erase-edited"),
      dir("erase-edited"),
      "Erase of the edited slot 1: the note, the list.",
    ),
    recording(
      id("erase-default"),
      dir("erase-default"),
      "Erase of a default (slot 2): the note, the list.",
    ),
    shots(
      id("erase-default-read"),
      [[dir("erase-default-read"), "read"]],
      "Slot 2 read after its Erase: the default kept.",
    ),
    recording(id("fill-save"), dir("fill-save"), "Slot 6 filled (ok), Options › Save."),
    shots(
      id("filled"),
      [
        [dir("fill-typed"), "typed"],
        [dir("filled/list"), "list"],
        [dir("filled/read"), "read"],
        [dir("filled/erased-list"), "erased-list"],
      ],
      "Slot 6 filled and saved: the list and Read; Erase empties it again.",
    ),
    recording(
      id("erase-user"),
      dir("erase-user"),
      "Erase of the filled slot 6: the note, `(empty)`.",
    ),
    shots(
      id("limit"),
      [
        [dir("limit/full"), "full"],
        [dir("limit/extra"), "extra"],
      ],
      "Slot 7's editor typed to its limit, then one key more.",
    ),
  ];
}

/** Template and Insert smiley in Write messages (factory: multi-tap, Task 0 E). */
function insertRows(): ContentRow[] {
  return (["template", "smiley"] as const).flatMap((kind): ContentRow[] => {
    const id = (name: string) => `content/editor-${kind}-${name}`;
    const label = kind === "template" ? "Template" : "Insert smiley";
    return [
      recording(
        id("open"),
        `insert/${kind}-open`,
        `Write messages › Options › ${label}: the list.`,
      ),
      scroll(id("list"), `insert/${kind}-list`, `${label}'s list, ▼ to the wrap.`),
      recording(
        id("select"),
        `insert/${kind}-select`,
        "Slot 2 selected: the editor with it inserted.",
      ),
      shots(
        id("slots"),
        range(8).map((n) => [`insert/${kind}/${n}`, n]),
        `Each slot inserted into the empty editor (the counter: its length; (empty) slots: nothing).`,
      ),
      shots(
        id("placement"),
        [
          [`insert/${kind}-after-text`, "after-text"],
          [`insert/${kind}-mid-text`, "mid-text"],
          [`insert/${kind}-pending`, "pending"],
        ],
        "Slot 1 inserted after `hi`, between h and i, and after a pending A.",
      ),
      recording(id("c"), `insert/${kind}-c`, "C on the list: back to Options."),
    ];
  });
}

function restoreRows(): ContentRow[] {
  return [
    shots(
      "content/restore-virgin",
      [
        ["restore/virgin-templates", "templates"],
        ["restore/virgin-smileys", "smileys"],
      ],
      "The virgin EEPROM (plan 15's code image): Menu 2 5 and 2 6 open nothing.",
    ),
    scroll(
      "content/restore-templates",
      "restore/templates",
      "After Restore factory settings: Templates.",
    ),
    scroll(
      "content/restore-smileys",
      "restore/smileys",
      "After Restore factory settings: Smileys.",
    ),
    shots(
      "content/restore-topics",
      [["restore/topics", "topics"]],
      "After Restore factory settings: Info service › Topics is `Add topic`.",
    ),
    ...(["5", "6"] as const).flatMap((n) => [
      scroll(
        `content/restore-edited-before-${n}`,
        `restore-edited/before-${n}`,
        "Slot 1 edited, slot 6 filled.",
      ),
      scroll(
        `content/restore-edited-after-${n}`,
        `restore-edited/after-${n}`,
        "Then Restore: the defaults.",
      ),
    ]),
  ];
}

function chatRows(): ContentRow[] {
  const r = (name: string, note: string) => recording(`chat/${name}`, `chat/${name}`, note);
  const one = (name: string, note: string) =>
    shots(`chat/${name}`, [[`chat/${name}`, name.split("/").at(-1)!]], note);
  return [
    r("open", "Menu, ▼▼ (Chat), Select: `Phone number:`."),
    shots(
      "chat/number",
      [
        ["chat/number/01", "01"],
        ["chat/number/10", "10"],
      ],
      "The partner's number typed: its first and tenth digit.",
    ),
    r("number-ok", "OK: `Chat name:`."),
    r("name-c", "C on the empty name: the number again."),
    r("search-empty", "Search on the empty number: the virgin phone book's note."),
    one("name-typed", "Bo typed."),
    r("name-ok", "OK: the editor, T9 (the virgin Dictionary), the chat counter 140/1."),
    one("editor-t9", "The T9 editor."),
    scroll("chat/options-t9", "chat/options-t9", "Options in T9 with no word: ten entries."),
    r("dictionary-off", "Options › Dictionary › Dictionary off: the note, the multi-tap editor."),
    one("editor", "The multi-tap editor."),
    one("typed", "Hi typed."),
    scroll("chat/options", "chat/options", "Options in multi-tap: seven entries."),
    r("send", "Options › Send: Sending message, Message sent, the history (`<Bo: Hi`)."),
    one("history-1", "The history after the first line."),
    r("reply", "The partner's SMS arrives on the history: `>Hey back` on top."),
    r("history-ok", "OK on the history: the empty editor."),
    one("history-3", "A second own line sent."),
    shots(
      "chat/history-4",
      [
        ["chat/history-4/00", "top"],
        ["chat/history-4/down-1", "down-1"],
        ["chat/history-4/down-2", "down-2"],
        ["chat/history-4/down-3", "down-3"],
        ["chat/history-4/up-1", "up-1"],
        ["chat/history-4/up-2", "up-2"],
        ["chat/history-4/up-3", "up-3"],
      ],
      "A long partner line wraps; ▼ scrolls to the end, ▲ to the top.",
    ),
    r("history-c", "C on the history: the editor."),
    r("arrive-editor", "The partner's SMS while the editor shows: the history."),
    r("arrive-options", "The partner's SMS while Options shows: the history."),
    one("arrive-options-after", "The history after it."),
    one("arrive-options-c", "C: the editor."),
    r("arrive-other", "Another number's SMS during the chat: nothing shows."),
    one("arrive-other-c", "C on the empty editor: Chat on the carousel."),
    r("chat-name", "Options › Chat name: the name prefilled."),
    r("chat-name-ok", "Renamed (Bal): the editor."),
    one("renamed-history", "A line sent under the new name."),
    r("erase", "Options › Erase: the editor emptied."),
    r("exit", "Options › Exit: Chat on the carousel."),
    one("after-exit-standby", "C: standby, no envelope."),
    r("inbox-after", "Inbox after the chat: the partner's lines are not there."),
    one("reopen", "Chat again: the number is not kept."),
    r("options-held-c", "C held on Options: the editor, then standby."),
    r("send-no-name", "No name: the line and the SMS start with `: `."),
    one("no-name-history", "Its history line."),
    shots(
      "chat/limit",
      [
        ["chat/limit/040", "040"],
        ["chat/limit/080", "080"],
        ["chat/limit/120", "120"],
        ["chat/limit/160", "160"],
        ["chat/limit/end", "end"],
      ],
      "40, 80, 120 and 160 keys typed: the counter stops at 0/1 (140 characters).",
    ),
    one("own-long", "A long own line wraps."),
    scroll(
      "chat/options-history",
      "chat/options-history",
      "Options once a line was sent: Chat history.",
    ),
    r("chat-history", "Options › Chat history: the history."),
    r("chat-history-ok", "OK: the editor."),
    r("other-arrival", "Another number's SMS during the chat (editor): nothing shows."),
    r("other-after-exit", "Exit, then C: standby with `1 message received`."),
    shots(
      "chat/reentry",
      [
        ["chat/reentry-number", "number"],
        ["chat/reentry-name", "name"],
        ["chat/reentry-editor", "editor"],
      ],
      "Chat again after Exit: the number empty, the name kept, the history gone.",
    ),
    scroll("chat/reentry-options", "chat/reentry-options", "Its Options: no Chat history."),
    shots(
      "chat/factory",
      [
        ["chat-factory/editor", "editor"],
        ["chat-factory/template-inserted", "template-inserted"],
        ["chat-factory/smiley-inserted", "smiley-inserted"],
      ],
      "The factory image (Dictionary off): Template and Insert smiley in Chat.",
    ),
    scroll("chat/factory-options", "chat-factory/options", "Its Options."),
    recording(
      "chat/factory-template-open",
      "chat-factory/template-open",
      "Options › Template: the list.",
    ),
    recording("chat/factory-send", "chat-factory/send", "Send: `Bo: Please call :-)`."),
  ];
}

function topicsRows(): ContentRow[] {
  const r = (name: string, note: string) => recording(`topics/${name}`, `topics/${name}`, note);
  const f = (name: string, note: string) =>
    recording(`topics/factory-${name}`, `topics-factory/${name}`, note);
  return [
    r("edit-open", "Virgin Edit on topic 1: `Topic number:` (empty)."),
    r("edit-number-ok", "OK on the empty number: nothing."),
    r("edit-number-typed-ok", "12 typed, OK: `Topic name:` on the topic's boxes."),
    shots(
      "topics/edit",
      [
        ["topics/edit-number", "number"],
        ["topics/edit-number-typed", "number-typed"],
        ["topics/edit-name", "name"],
        ["topics/edit-name-cleared", "name-cleared"],
        ["topics/edit-name-typed", "name-typed"],
        ["topics/edit-after", "after"],
      ],
      "Edit's prompts; the name cleared with C, NEWS typed; the level after `Saved`.",
    ),
    r("edit-name-ok", "OK: `Saved`, the Topics level."),
    scroll("topics/edit-after-list", "topics/edit-after-list", "Edit's list after it."),
    shots("topics/select-open", [["topics/select-open", "open"]], "Select's list (virgin marks)."),
    r("select-mark", "Mark on topic 2."),
    r("select-unmark", "Unmark."),
    r("select-mark-again", "Mark again."),
    r("select-c", "C: `Save changes?`."),
    scroll("topics/select-reopen", "topics/select-reopen", "The level after Yes."),
    r("erase-1", "Erase on topic 1: `Topic erased`, the level with Add topic."),
    scroll("topics/level-after-erase", "topics/level-after-erase", "The level with four topics."),
    shots(
      "topics/after-erase",
      [2, 3, 4, 5].map((n) => [`topics/after-erase-${n}`, String(n)]),
      "After each further Erase.",
    ),
    r("erase-last", "The last topic erased: only Add topic."),
    scroll("topics/level-empty", "topics/level-empty", "The empty level."),
    r("add-open", "Add topic (one erased): `Topic number:`."),
    r("add-number-ok", "77, OK: `Topic name:` (ABC)."),
    r("add-name-ok", "SPORT, OK: `Topic added`, the level without Add topic."),
    scroll("topics/level-after-add", "topics/level-after-add", "The full level again."),
    shots("topics/factory-level", [["topics-factory/level", "level"]], "Factory: Add topic only."),
    f("add-open", "Add topic: `Topic number:`."),
    f("number-empty-ok", "OK on the empty number: nothing."),
    f("number-0-ok", "0, OK: the name."),
    f("number-999-ok", "999, OK: the name."),
    f("number-1000-ok", "1000 typed (three digits kept), OK: the name."),
    shots(
      "topics/factory-numbers",
      [
        ["topics-factory/number-0", "0"],
        ["topics-factory/number-999", "999"],
        ["topics-factory/number-1000", "1000"],
        ["topics-factory/name", "name"],
        ["topics-factory/name-typed", "name-typed"],
      ],
      "The number prompt typed; the name prompt empty and typed.",
    ),
    f("name-empty-ok", "OK on the empty name: `Topic added`."),
    scroll(
      "topics/factory-level-unnamed",
      "topics-factory/level-unnamed",
      "The level with one topic.",
    ),
    f("add-ok", "ONE, OK: `Topic added`."),
    scroll("topics/factory-level-1", "topics-factory/level-1", "The level with one topic."),
    scroll("topics/factory-select-1", "topics-factory/select-1", "Select with one topic."),
    shots(
      "topics/factory-adds",
      [2, 3, 4, 5].flatMap((n) => [
        [`topics-factory/add-${n}-name`, `${n}-name`],
        [`topics-factory/add-${n}-after`, `${n}-after`],
      ]),
      "Topics 2-5 added (100 twice): the name prompt, the level after each.",
    ),
    scroll("topics/factory-level-full", "topics-factory/level-full", "Five topics: no Add topic."),
    scroll("topics/factory-select-full", "topics-factory/select-full", "Select with five."),
    scroll("topics/factory-edit-full", "topics-factory/edit-full", "Edit with five."),
  ];
}

function serviceRows(): ContentRow[] {
  return [
    recording("service-command/open", "service/open", "Messages ▼9, Select: the editor, Back."),
    shots(
      "service-command/typed",
      [
        ["service/empty", "empty"],
        ...[1, 2, 3, 4, 5].map((n) => [`service/typed/0${n}`, `0${n}`] as const),
        ["service/typed/settled", "settled"],
        ["service/letter", "letter"],
      ],
      "*100# typed key by key (Send once not empty); then 2.",
    ),
    recording(
      "service-command/send",
      "service/send",
      "Send: Requesting (Quit), `Not done`, standby.",
    ),
    shots(
      "service-command/after",
      [
        ["service/after-send", "standby"],
        ["service/after-send-key", "menu"],
        ["service/after-send-c", "c"],
      ],
      "Standby after the request; Menu; C.",
    ),
  ];
}

export const CONTENT_TABLE: readonly ContentRow[] = [
  ...contentRows("templates"),
  ...contentRows("smileys"),
  ...insertRows(),
  ...restoreRows(),
  ...chatRows(),
  ...topicsRows(),
  ...serviceRows(),
];

/** Goldens whose scenario another plan's work still lacks, by id: the owner plan. */
export const PENDING: Readonly<Record<string, string>> = {};

/**
 * The id prefixes whose scenarios pass (tests/support/18c-content.ts): asserted. The rest stay
 * `pending:18c` until their task supplies the scenario (Task 2).
 */
export const ASSERTED: readonly string[] = [];

/** The status of golden `id`: pending on the plan PENDING names, asserted once promoted. */
export function statusOf(id: string): GoldenStatus {
  const plan = PENDING[id];
  if (plan !== undefined) return `pending:${plan}`;
  return ASSERTED.some(
    (prefix) => id === prefix || id.startsWith(`${prefix}-`) || id.startsWith(`${prefix}/`),
  )
    ? "asserted"
    : "pending:18c";
}

function rowEntry(io: TreeCaptureIo, row: ContentRow): CaptureSetEntry {
  const status = statusOf(row.id);
  if (row.kind === "recording") {
    const dir = `${BASE}/${row.dir}`;
    const frames = io.recording(dir);
    if (frames === undefined || frames.length === 0) {
      throw new ContentCaptureError(row.id, `missing capture ${dir}`);
    }
    return {
      id: row.id,
      kind: "timeline",
      status,
      prefer: {
        source: { kind: "recording", dir },
        triggerFrame: firstChangedFrame(frames),
        note: row.note,
      },
    };
  }
  if (row.kind === "shots") {
    const names = row.shots.map(([, name]) => name);
    const repeated = names.find((name, i) => names.indexOf(name) !== i);
    if (repeated !== undefined) throw new ContentCaptureError(row.id, `two images ${repeated}`);
    return {
      id: row.id,
      kind: "still",
      status,
      prefer: {
        source: {
          kind: "shots",
          files: row.shots.map(([file, name]) => ({ file: `${BASE}/${file}.png`, name })),
        },
        note: row.note,
      },
    };
  }
  const dir = `${BASE}/${row.dir}`;
  const names = io.scrollImages(dir);
  if (names === undefined || names.length === 0) {
    throw new ContentCaptureError(row.id, `missing capture ${dir}`);
  }
  if (row.keep === undefined) {
    return {
      id: row.id,
      kind: "still",
      status,
      prefer: { source: { kind: "scroll", dir }, note: row.note },
    };
  }
  if (row.keep < 1 || row.keep >= names.length) {
    throw new ContentCaptureError(row.id, `keeps ${row.keep} of ${names.length} images`);
  }
  const rest = names.slice(row.keep);
  return {
    id: row.id,
    kind: "still",
    status,
    prefer: {
      source: { kind: "shots", files: names.slice(0, row.keep).map((n) => `${dir}/${n}.png`) },
      note: row.note,
      omitted: { [rest.length === 1 ? rest[0]! : `${rest[0]}-${rest.at(-1)}`]: "past the wrap" },
    },
  };
}

/** Every plan 18c LCD golden, in table order. Throws naming a row whose capture is missing. */
export function contentCaptureSet(io: TreeCaptureIo, table = CONTENT_TABLE): CaptureSetEntry[] {
  const entries = table.map((row) => rowEntry(io, row));
  const ids = entries.map((entry) => entry.id);
  const repeated = ids.find((id, i) => ids.indexOf(id) !== i);
  if (repeated !== undefined) throw new ContentCaptureError(repeated, "listed twice");
  for (const id of Object.keys(PENDING)) {
    if (!ids.includes(id)) throw new ContentCaptureError(id, "pending but not in the table");
  }
  return entries;
}

export const chatAndContent: PlanCaptureSet = {
  plan: "18c",
  resources,
  lcd: (io) => contentCaptureSet(io.frames),
  notImported: {
    "plan18c/text.json, recordings.json, mo-sms.json, logs/**":
      "Task 0's OCR, recording parents and the emulator's MO SMS log (the on-air Chat texts)",
    "plan18c/**/*@8x.png": "previews",
    "scratch-plan18c/**":
      "planning probes, never imported (plan 18c); v5.79 picture views are comparative research",
    "picture messages, screen saver gallery, business cards":
      "no verified v6.39 captures: the picture folder needs Task 0 R's repaired image (D4), card receipt plan 19's phone book (D6)",
  },
};
