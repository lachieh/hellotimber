// Inbox (2-2) and Outbox (2-3), plan 18 Task 11: `Opening`, then the list of messages (the
// empty boxes keep plan 14's note), a message's pages and its Options (D8, D13; Task 0 I, O).
import { MESSAGE_PAGE_LINES, drawable } from "../display/widgets/message";
import type { MessageListModel, MessagePageModel } from "../display/widgets";
import type { StockServices } from "../firmware/features/feature";
import { nodeTimeline, timelineByName } from "../firmware/timelines";
import { wrapText } from "../text/layout";
import type { PhoneKey } from "@hellotimber/phone-core";
import { confirmQuery } from "../widgets/confirm";
import { HeldC } from "../widgets/held-c";
import type { Flow, Widget } from "../widgets/flow";
import { interlude } from "../widgets/interlude";
import { note } from "../widgets/note";
import { OptionListWidget } from "../widgets/option-list";
import { moveRows, rowsIndicator, type RowsCursor } from "../widgets/rows";
import { chatWith } from "../chat/screens";
import { messageDate, messageTime } from "./timestamp";
import { smsEditor } from "./write";
import { numberEntry } from "../firmware/features/dialling";

export type MessageBox = "inbox" | "outbox";

/** The boxes' tree nodes: their `Opening` and empty notes are plan 14's recordings. */
const BOX_NODES: Readonly<Record<MessageBox, string>> = { inbox: "2-2", outbox: "2-3" };

/** `Erasing message` shows the bar's first frame this long (`sms/inbox-option-erase` frame 2). */
export const ERASING_MS = 261;

/**
 * A message's text lines run x 0..83 (`sms/inbox-view-2`), and a word stays on a line while its
 * cells fit them, its last blank column included (`scroll. the toolkit` takes all 84, plan 30
 * `sim/stk-text-text-240-pages`; `right here with a` 83, `sim/sms-read-1`); `wrapText` keeps the
 * editor's two columns free, so pages wrap at 86.
 */
const PAGE_WIDTH = 86;

/** The phone book name of `number`, if it has one (plan 30 D7, Task 0 N). */
function nameOf(services: StockServices, number: string): { readonly name?: string } {
  const name = services.phoneBook.byNumber(number)?.name;
  return name === undefined ? {} : { name };
}

/** A message of either box as the screens show it. */
interface Shown {
  /** Its SIM slot (plan 30): the screens name a message by it. */
  readonly slot: number;
  readonly text: string;
  /** Inbox only: the sender (and its phone book name) and the service centre's time stamp. */
  readonly sender?: string;
  readonly name?: string;
  readonly sent?: readonly string[];
  readonly centre?: string;
  /** A saved message's number (Reply or Forward), Send's prompt starts with it. */
  readonly number?: string;
  readonly read: boolean;
}

function messagesOf(services: StockServices, box: MessageBox): readonly Shown[] {
  const store = services.messaging.store;
  if (box === "outbox") {
    return store.outbox().map((m) => ({
      slot: m.slot,
      text: m.text,
      read: true,
      ...(m.number === undefined ? {} : { number: m.number }),
    }));
  }
  return store.inbox().map((m) => ({
    slot: m.slot,
    text: m.text,
    sender: m.number,
    // Plan 30 D7: a sender in the phone book is listed and read under its name.
    ...nameOf(services, m.number),
    sent: [messageDate(m.sentAt), messageTime(m.sentAt)],
    centre: m.centre,
    read: m.read,
  }));
}

/**
 * A message's pages (D13): its text, up to four lines a page, then (Inbox) `Sender:` and `Sent:`
 * (`sms/inbox-view-1`, `-2`). ▲/▼ turn them and wrap.
 */
export function messagePages(message: Omit<Shown, "slot">): readonly (readonly string[])[] {
  const text = drawable(message.text);
  const chars = Array.from(text);
  const lines = wrapText(text, "small", PAGE_WIDTH).map((line) =>
    chars.slice(line.start, line.end).join("").trimEnd(),
  );
  const pages: string[][] = [];
  for (let i = 0; i < Math.max(lines.length, 1); i += MESSAGE_PAGE_LINES) {
    pages.push(lines.slice(i, i + MESSAGE_PAGE_LINES));
  }
  if (message.sender !== undefined) pages.push(senderLines(message));
  if (message.sent !== undefined) pages.push(["Sent:", ...message.sent]);
  return pages;
}

/** `Sender:` and the sender: its name line, then its number (plan 30 D7), or the number alone. */
function senderLines(message: Omit<Shown, "slot">): string[] {
  const sender = message.sender ?? "";
  return message.name === undefined ? ["Sender:", sender] : ["Sender:", message.name, sender];
}

/** Pages turned by ▲/▼ (wrapping) with a soft key: a message, or its Details. */
function pager(
  pages: readonly (readonly string[])[],
  softkey: string,
  onSoftkey: (flow: Flow) => void,
): Widget {
  let page = 0;
  const c = new HeldC();
  return {
    render: (): MessagePageModel => ({ kind: "message-page", lines: pages[page]!, softkey }),
    onKeyDown(key) {
      if (key === "c") c.down();
    },
    onKey(key, flow) {
      if (key === "down") page = (page + 1) % pages.length;
      else if (key === "up") page = (page + pages.length - 1) % pages.length;
      else if (key === "navi") onSoftkey(flow);
      else if (key === "c") c.up(flow);
    },
    tick(dtMs, flow) {
      c.tick(dtMs, flow);
    },
  };
}

/** The first run of digits in `text` long enough to dial (UNVERIFIED rule: three or more). */
function numberIn(text: string): string | undefined {
  return /\+?\d{3,}/.exec(text)?.[0];
}

interface Box {
  readonly services: StockServices;
  readonly box: MessageBox;
}

/**
 * Options › Erase (`sms/inbox-option-erase`, `-erase-last`): `Erase message?`; OK erases,
 * `Erasing message`, then `Erased` and the list, or `No more messages in …` and the page.
 */
function erase({ services, box }: Box, slot: number): Widget {
  const { messaging, noteSound } = services;
  return confirmQuery({
    lines: ["Erase", "message?"],
    softkey: "OK",
    confirm(flow) {
      messaging.store.erase(box, slot);
      const empty = messagesOf(services, box).length === 0;
      const after = empty
        ? note({
            lines: ["No more", "messages", `in ${box}`],
            timeline: timelineByName(`no-more-messages-${box}`),
            // Back past the list to the page.
            end: { levels: 2 },
            sound: noteSound,
          })
        : note({ lines: ["Erased"], timeline: timelineByName("message-erased"), sound: noteSound });
      // The query and Options close; `Erasing message` replaces the message.
      flow.back(2);
      flow.replace(
        interlude(
          { kind: "progress", text: ["Erasing", "message"], bar: "progress-1", softkey: "" },
          ERASING_MS,
          (inner) => inner.replace(after),
        ),
      );
    },
  });
}

/** A message's Options (`sms/inbox-options`: seven; `sms/outbox-options`: four). */
function messageOptions(owner: Box, message: Shown): Widget {
  const { services, box } = owner;
  const numberNote = (flow: Flow) =>
    flow.replace(
      note({
        lines: ["No number", "found", "on this screen"],
        // The info note's class: No phone numbers' timeline (`sms/outbox-use-number`, UNVERIFIED
        // length: this recording shows 2883 ms).
        timeline: timelineByName("no-phone-numbers"),
        sound: services.noteSound,
      }),
    );
  const actions: Readonly<Record<string, (flow: Flow) => void>> = {
    Erase: (flow) => flow.push(erase(owner, message.slot)),
    // Reply starts empty; Send's prompt starts with the sender (D8, `sms/inbox-option-typed`).
    Reply: (flow) => flow.replace(smsEditor(services, { number: message.sender ?? "" })),
    // Plan 18c: a chat with the sender (`sms/inbox-option-chat`: Chat name:).
    Chat: (flow) => flow.replace(chatWith(services, message.sender ?? "")),
    Edit: (flow) =>
      flow.replace(
        smsEditor(services, {
          text: message.text,
          ...(message.number === undefined ? {} : { number: message.number }),
        }),
      ),
    // Plan 22: the number in standby's number entry (`sms/inbox-option-use-number`).
    "Use number": (flow) => {
      const number = box === "inbox" ? message.sender : numberIn(message.text);
      if (number === undefined) numberNote(flow);
      else flow.replace(numberEntry(services, number));
    },
    Forward: (flow) => flow.replace(smsEditor(services, { text: message.text })),
    // Details (`sms/inbox-details`): Sender, Message centre, Time; Back.
    Details: (flow) =>
      flow.replace(
        pager(
          [
            senderLines(message),
            ["Message centre:", message.centre ?? ""],
            ["Time:", ...(message.sent ?? [])],
          ],
          "Back",
          (inner) => inner.back(),
        ),
      ),
  };
  const labels =
    box === "inbox"
      ? ["Erase", "Reply", "Chat", "Edit", "Use number", "Forward", "Details"]
      : ["Erase", "Edit", "Use number", "Forward"];
  return new OptionListWidget({
    labels,
    opening: 0,
    softkey: "OK",
    numbering: "option",
    choose: (choice, flow) => actions[labels[choice]!]!(flow),
  });
}

/**
 * Read on an Inbox message shows `Opening message` on plan 14's hatched bar first, while the phone
 * reads its SIM record: 270-625 ms in plan 30's recordings (`sim/sms-read-*-open`, longer with a
 * phone book match or a long text; the screen after it is compared within that spread), here
 * the shortest.
 */
export const OPENING_MESSAGE_MS = 270;

/** A message read (D13): its pages, Options; reading an Inbox message marks it read. */
function messageView(owner: Box, message: Shown): Widget {
  const { services, box } = owner;
  const view = pager(messagePages(message), "Options", (flow) =>
    flow.push(messageOptions(owner, message)),
  );
  if (box === "outbox") return view;
  services.messaging.store.markRead(message.slot);
  return interlude(
    { kind: "progress", text: ["Opening", "message"], bar: "progress-1", softkey: "" },
    OPENING_MESSAGE_MS,
    (flow) => flow.replace(view),
  );
}

/**
 * The list (`sms/inbox-list`, `sms/outbox-list`): the sender (Inbox) or `Message` (Outbox) after
 * an envelope, closed while unread; the circular rows window; Read opens the message. Its order is
 * the box's when the list opened (plan 30 Task 0 M: a message read stays where it was until the
 * Inbox opens again, `sms/inbox/list-one-read`); it reads the box afresh on every screen, so an
 * erased message leaves it at once and an arrival joins at the end.
 */
class MessageListWidget implements Widget {
  readonly #owner: Box;
  /** The slots in the order the list opened with. */
  readonly #order: readonly number[];
  #cursor: RowsCursor = { selected: 0, windowTop: 0 };
  /** How many messages the list showed last: an erase puts the next one on top. */
  #count: number | undefined;
  readonly #c = new HeldC();

  constructor(owner: Box) {
    this.#owner = owner;
    this.#order = messagesOf(owner.services, owner.box).map((m) => m.slot);
  }

  #messages(): readonly Shown[] {
    const now = messagesOf(this.#owner.services, this.#owner.box);
    const rank = (m: Shown) => {
      const at = this.#order.indexOf(m.slot);
      return at < 0 ? this.#order.length : at;
    };
    return [...now].sort((a, b) => rank(a) - rank(b));
  }

  render(flow: Flow): MessageListModel {
    const messages = this.#messages();
    const count = Math.max(messages.length, 1);
    const selected = Math.min(this.#cursor.selected ?? 0, count - 1);
    // After an erase the list shows the message that took the erased one's place on top
    // (`sms/inbox` erase-1-after).
    if (this.#count !== undefined && this.#count !== messages.length) {
      this.#cursor = { selected, windowTop: selected };
    }
    this.#count = messages.length;
    return {
      kind: "message-list",
      rows: messages.map((m) => ({
        label: this.#owner.box === "inbox" ? (m.name ?? m.sender ?? "") : "Message",
        icon: m.read ? "message/read" : "message/unread",
      })),
      selected,
      windowTop: this.#cursor.windowTop % count,
      indicator: rowsIndicator(flow.indicator(), selected),
      softkey: "Read",
    };
  }

  onKeyDown(key: PhoneKey): void {
    if (key === "c") this.#c.down();
  }

  tick(dtMs: number, flow: Flow): void {
    this.#c.tick(dtMs, flow);
  }

  onKey(key: PhoneKey, flow: Flow): void {
    const count = this.#messages().length;
    if (key === "c") this.#c.up(flow);
    else if (key === "navi" && count > 0) {
      flow.push(messageView(this.#owner, this.#messages()[this.#cursor.selected ?? 0]!));
    } else this.#cursor = moveRows(this.#cursor, key, count) ?? this.#cursor;
  }
}

/**
 * Inbox or Outbox opened (2-2, 2-3, or Read on the received notice): `Opening` as plan 14
 * recorded it (its node's first step), then the list; an empty box plays plan 14's note.
 */
export function openBox(services: StockServices, box: MessageBox): Widget {
  const number = BOX_NODES[box];
  const timeline = nodeTimeline(number);
  if (timeline === undefined) throw new Error(`No timeline for ${number}.`);
  if (messagesOf(services, box).length === 0) {
    return note({
      lines: ["No", "messages", `in ${box}`],
      timeline,
      sound: services.noteSound,
    });
  }
  const first = timeline.timeline.steps[0]!;
  const opening = timeline.frames[first.frame]!;
  const ms = first.durationMs;
  return interlude({ kind: "note", lines: [], frame: opening }, ms, (flow) =>
    flow.replace(new MessageListWidget({ services, box })),
  );
}
