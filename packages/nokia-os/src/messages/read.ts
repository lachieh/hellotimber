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
import { messageDate, messageTime } from "./timestamp";
import { smsEditor } from "./write";

export type MessageBox = "inbox" | "outbox";

/** The boxes' tree nodes: their `Opening` and empty notes are plan 14's recordings. */
const BOX_NODES: Readonly<Record<MessageBox, string>> = { inbox: "2-2", outbox: "2-3" };

/** `Erasing message` shows the bar's first frame this long (`sms/inbox-option-erase` frame 2). */
export const ERASING_MS = 261;

/** A message's text lines run x 0..83 (`sms/inbox-view-2`). */
const PAGE_WIDTH = 84;

/** A message of either box as the screens show it. */
interface Shown {
  readonly text: string;
  /** Inbox only: the sender and the service centre's time stamp. */
  readonly sender?: string;
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
      text: m.text,
      read: true,
      ...(m.number === undefined ? {} : { number: m.number }),
    }));
  }
  return store.inbox().map((m) => ({
    text: m.text,
    sender: m.number,
    sent: [messageDate(m.sentAt), messageTime(m.sentAt)],
    centre: m.centre,
    read: m.read,
  }));
}

/**
 * A message's pages (D13): its text, up to four lines a page, then (Inbox) `Sender:` and `Sent:`
 * (`sms/inbox-view-1`, `-2`). ▲/▼ turn them and wrap.
 */
export function messagePages(message: Shown): readonly (readonly string[])[] {
  const text = drawable(message.text);
  const chars = Array.from(text);
  const lines = wrapText(text, "small", PAGE_WIDTH).map((line) =>
    chars.slice(line.start, line.end).join("").trimEnd(),
  );
  const pages: string[][] = [];
  for (let i = 0; i < Math.max(lines.length, 1); i += MESSAGE_PAGE_LINES) {
    pages.push(lines.slice(i, i + MESSAGE_PAGE_LINES));
  }
  if (message.sender !== undefined) pages.push(["Sender:", message.sender]);
  if (message.sent !== undefined) pages.push(["Sent:", ...message.sent]);
  return pages;
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

/** A choice another plan implements (C goes back). */
function placeholder(label: string): Widget {
  return {
    render: () => ({ kind: "placeholder", label }),
    onKey(key, flow) {
      if (key === "c") flow.back();
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
function erase({ services, box }: Box, index: number): Widget {
  const { messaging, noteSound } = services;
  return confirmQuery({
    lines: ["Erase", "message?"],
    softkey: "OK",
    confirm(flow) {
      messaging.store.erase(box, index);
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
function messageOptions(owner: Box, index: number, message: Shown): Widget {
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
    Erase: (flow) => flow.push(erase(owner, index)),
    // Reply starts empty; Send's prompt starts with the sender (D8, `sms/inbox-option-typed`).
    Reply: (flow) => flow.replace(smsEditor(services, { number: message.sender ?? "" })),
    // Chat is plan 18c's (`sms/inbox-option-chat`: Chat name:).
    Chat: (flow) => flow.replace(placeholder("Chat")),
    Edit: (flow) =>
      flow.replace(
        smsEditor(services, {
          text: message.text,
          ...(message.number === undefined ? {} : { number: message.number }),
        }),
      ),
    // Dialling a number is plan 22's (`sms/inbox-option-use-number`: the call screen).
    "Use number": (flow) => {
      const number = box === "inbox" ? message.sender : numberIn(message.text);
      if (number === undefined) numberNote(flow);
      else flow.replace(placeholder("Use number"));
    },
    Forward: (flow) => flow.replace(smsEditor(services, { text: message.text })),
    // Details (`sms/inbox-details`): Sender, Message centre, Time; Back.
    Details: (flow) =>
      flow.replace(
        pager(
          [
            ["Sender:", message.sender ?? ""],
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

/** A message read (D13): its pages, Options; reading an Inbox message marks it read. */
function messageView(owner: Box, index: number): Widget {
  const { services, box } = owner;
  if (box === "inbox") services.messaging.store.markRead(index);
  const message = messagesOf(services, box)[index]!;
  return pager(messagePages(message), "Options", (flow) =>
    flow.push(messageOptions(owner, index, message)),
  );
}

/**
 * The list (`sms/inbox-list`, `sms/outbox-list`): the sender (Inbox) or `Message` (Outbox) after
 * an envelope, closed while unread; the circular rows window; Read opens the message. It reads
 * the box afresh on every screen, so an erased message leaves it at once.
 */
class MessageListWidget implements Widget {
  readonly #owner: Box;
  #cursor: RowsCursor = { selected: 0, windowTop: 0 };
  /** How many messages the list showed last: an erase puts the next one on top. */
  #count: number | undefined;
  readonly #c = new HeldC();

  constructor(owner: Box) {
    this.#owner = owner;
  }

  #messages(): readonly Shown[] {
    return messagesOf(this.#owner.services, this.#owner.box);
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
        label: this.#owner.box === "inbox" ? (m.sender ?? "") : "Message",
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
      flow.push(messageView(this.#owner, this.#cursor.selected ?? 0));
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
