// Chat (menu 3; Inbox › Options › Chat), plan 18c Task 8 as Task 0 C captured it (`chat/*`):
// `Phone number:`, `Chat name:`, the chat editor (plan 18's, `140/1`, T9 or multi-tap as the
// shared Dictionary), its Options, Send (`Sending message`, `Message sent`, the history) and the
// partner's lines, which show at once whatever the chat shows.
//
// The chat is one widget hosting its own stack (the editor, Options, the history, ...), so that
// an arrival can close whatever is above the editor and show the history: the flow it sits in
// only sees the chat.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { MenuIndicator } from "@hellotimber/phone-core";
import { insertionList } from "../content/insertion";
import type { MessagePageModel, WidgetModel } from "@hellotimber/nokia-kit/ui/display/widgets";
import { MESSAGE_PAGE_LINES } from "@hellotimber/nokia-kit/ui/display/widgets/message";
import type { StockServices } from "../firmware/features/feature";
import { messagePages } from "../messages/read";
import {
  dictionary,
  insertNumber,
  insertWord,
  matches,
  sending,
  t9Context,
} from "../messages/write";
import { editor, type EditorControl } from "@hellotimber/nokia-kit/ui/widgets/editor";
import type { BackOptions, Flow, Widget } from "@hellotimber/nokia-kit/ui/widgets/flow";
import { HeldC } from "@hellotimber/nokia-kit/ui/widgets/held-c";
import { pickNumber } from "../phone-book/flows";
import { numberEntry } from "@hellotimber/nokia-kit/ui/widgets/number-entry";
import { OptionListWidget } from "../widgets/option-list";
import { symbolTable } from "@hellotimber/nokia-kit/ui/widgets/symbol-table";
import { textInput } from "@hellotimber/nokia-kit/ui/widgets/text-input";
import { ChatSession, lastChatName } from "@hellotimber/phone-services/chat/session";

/** A chat line holds 140 characters (`chat/name-ok`: `140/1`; `chat/limit`: `0/1`). */
export const CHAT_LIMIT = 140;
/** `Chat name:`'s length (UNVERIFIED: the captures type three characters). */
export const CHAT_NAME_LIMIT = 10;

/**
 * The history (`chat/history-*`): every line wrapped in the small face, newest first, four lines
 * a page from the top; ▼ and ▲ turn pages without wrapping; OK and C go back to the editor.
 */
class HistoryWidget implements Widget {
  readonly #session: ChatSession;
  #page = 0;
  readonly #c = new HeldC();

  constructor(session: ChatSession) {
    this.#session = session;
  }

  #lines(): string[] {
    return this.#session
      .lines()
      .flatMap((line) => messagePages({ text: line.text, read: true }).flat());
  }

  /** A line arrived: the history from its top. */
  top(): void {
    this.#page = 0;
  }

  render(): MessagePageModel {
    const lines = this.#lines();
    const pages = Math.max(1, Math.ceil(lines.length / MESSAGE_PAGE_LINES));
    this.#page = Math.min(this.#page, pages - 1);
    const from = this.#page * MESSAGE_PAGE_LINES;
    return {
      kind: "message-page",
      lines: lines.slice(from, from + MESSAGE_PAGE_LINES),
      softkey: "OK",
    };
  }

  onKeyDown(key: PhoneKey): void {
    if (key === "c") this.#c.down();
  }

  onKey(key: PhoneKey, flow: Flow): void {
    const pages = Math.max(1, Math.ceil(this.#lines().length / MESSAGE_PAGE_LINES));
    if (key === "down") this.#page = Math.min(this.#page + 1, pages - 1);
    else if (key === "up") this.#page = Math.max(this.#page - 1, 0);
    else if (key === "navi") flow.back();
    else if (key === "c") this.#c.up(flow);
  }

  tick(dtMs: number, flow: Flow): void {
    this.#c.tick(dtMs, flow);
  }
}

/** The running chat: its editor at the bottom of its own stack. */
class ChatWidget implements Widget, Flow {
  readonly #services: StockServices;
  readonly #session: ChatSession;
  readonly #stack: Widget[];
  readonly #release: () => void;
  #outer: Flow | undefined;
  /** The model shown last: what the chat shows while the flow around it leaves it. */
  #shown: WidgetModel | undefined;
  #arrived = false;
  /** `Sending message` while it shows: a partner's line waits for it (UNVERIFIED). */
  #inFlight: Widget | undefined;
  #closed = false;

  constructor(services: StockServices, session: ChatSession) {
    this.#services = services;
    this.#session = session;
    this.#stack = [this.#editor()];
    this.#release = session.listen(() => {
      this.#arrived = true;
    });
  }

  get #top(): Widget {
    return this.#stack[this.#stack.length - 1]!;
  }

  #editor(): Widget {
    const services = this.#services;
    return editor({
      counter: "sms",
      limit: CHAT_LIMIT,
      layout: "sms",
      softkey: "Options",
      options: (flow, entry) => flow.push(this.#options(entry)),
      t9: () => t9Context(services),
      spell: (flow, entry) => flow.push(insertWord(services, entry, true)),
    });
  }

  /** The chat editor's Options (`chat/options*`). */
  #options(entry: EditorControl): Widget {
    const services = this.#services;
    const session = this.#session;
    const t9 = entry.t9;
    const labels = [
      "Send",
      "Template",
      "Insert smiley",
      ...(t9?.composing ? ["Matches"] : []),
      ...(t9 === undefined ? [] : ["Insert word", "Insert number", "Insert symbol"]),
      "Dictionary",
      ...(session.lines().length > 0 ? ["Chat history"] : []),
      "Chat name",
      "Erase",
      "Exit",
    ];
    // Its lists show Chat's path, the entry and the slot (`chat/factory-template-open`: `3-2-1`).
    const prefix = (flow: Flow, label: string) => [
      ...flow.indicator().segments,
      labels.indexOf(label) + 1,
    ];
    const insert = (flow: Flow, list: Widget | undefined) => {
      if (list !== undefined) flow.replace(list);
    };
    const actions: Readonly<Record<string, (flow: Flow) => void>> = {
      // `Sending message`, `Message sent` over the history, the editor empty below it.
      Send: (flow) => {
        const text = entry.text;
        const sms = { number: session.number, text: session.airText(text) };
        session.sending();
        this.#inFlight = sending(services, sms, (inner, note) => {
          // The history shows the partner's lines that arrived meanwhile too.
          this.#arrived = false;
          session.sent(text);
          entry.clear();
          inner.back();
          inner.push(new HistoryWidget(session));
          inner.push(note);
        });
        flow.replace(this.#inFlight);
      },
      Template: (flow) =>
        insert(flow, insertionList(services, "templates", prefix(flow, "Template"), entry)),
      "Insert smiley": (flow) =>
        insert(flow, insertionList(services, "smileys", prefix(flow, "Insert smiley"), entry)),
      Matches: (flow) => flow.push(matches(t9!)),
      "Insert word": (flow) => flow.replace(insertWord(services, entry, false)),
      "Insert number": (flow) => flow.replace(insertNumber(entry)),
      "Insert symbol": (flow) =>
        flow.replace(symbolTable((symbol) => entry.insert(symbol), { t9: true })),
      Dictionary: (flow) => flow.push(dictionary(services)),
      "Chat history": (flow) => flow.replace(new HistoryWidget(session)),
      "Chat name": (flow) =>
        flow.replace(
          textInput({
            label: ["Chat name:"],
            limit: CHAT_NAME_LIMIT,
            text: session.name,
            done(name, inner) {
              session.rename(name);
              inner.back();
            },
          }),
        ),
      Erase: (flow) => {
        entry.clear();
        flow.back();
      },
      // Back to Chat on the carousel (`chat/exit`).
      Exit: (flow) => flow.back(this.#stack.length),
    };
    // The indicator shows Chat's path and the entry (`chat/options`: `3-1`).
    return new OptionListWidget({
      labels,
      opening: 0,
      softkey: "OK",
      choose: (index, flow) => actions[labels[index]!]!(flow),
    });
  }

  /** The partner's line: whatever is above the editor closes, the history shows from its top. */
  #showArrival(): void {
    this.#arrived = false;
    const top = this.#top;
    if (top instanceof HistoryWidget && this.#stack.length === 2) {
      top.top();
      return;
    }
    for (const widget of this.#stack.splice(1).reverse()) widget.close?.();
    this.#stack.push(new HistoryWidget(this.#session));
  }

  // ---------------------------------------------------------------- as the outer flow's widget

  render(flow: Flow): WidgetModel {
    this.#outer = flow;
    const top = this.#stack.at(-1);
    if (top === undefined) {
      if (this.#shown === undefined) throw new Error("The chat has nothing to show.");
      return this.#shown;
    }
    this.#shown = top.render(this);
    return this.#shown;
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    this.#outer = flow;
    this.#stack.at(-1)?.onKeyDown?.(key, this);
  }

  onKey(key: PhoneKey, flow: Flow): void {
    this.#outer = flow;
    this.#stack.at(-1)?.onKey?.(key, this);
  }

  tick(dtMs: number, flow: Flow): void {
    this.#outer = flow;
    if (this.#closed) return;
    const sending = this.#inFlight !== undefined && this.#stack.includes(this.#inFlight);
    if (this.#arrived && !sending) this.#showArrival();
    this.#top.tick?.(dtMs, this);
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#release();
    for (const widget of this.#stack.splice(0).reverse()) widget.close?.();
  }

  // ---------------------------------------------------------------- as its widgets' flow

  push(widget: Widget): void {
    this.#stack.push(widget);
  }

  replace(widget: Widget): void {
    this.#stack.pop()?.close?.();
    this.#stack.push(widget);
  }

  back(levels = 1, options: BackOptions = {}): void {
    const popped = Math.min(levels, this.#stack.length);
    for (const widget of this.#stack.splice(this.#stack.length - popped).reverse()) {
      widget.close?.();
    }
    if (this.#stack.length > 0) {
      this.#top.reveal?.();
      return;
    }
    // Past the editor: the chat ends, and the levels beyond close in the flow around it.
    this.close();
    this.#outer?.back(levels - popped + 1, options);
  }

  standby(): void {
    this.close();
    this.#outer?.standby();
  }

  powerOff(): void {
    this.#outer?.powerOff?.();
  }

  indicator(): MenuIndicator {
    return this.#outer?.indicator() ?? { segments: [], awaitingNext: false };
  }
}

/** `Chat name:` for a chat with `number` (`chat/number-ok`: the last chat's name, else empty). */
function chatName(
  services: StockServices,
  number: string,
  start: (flow: Flow, chat: Widget) => void,
): Widget {
  return textInput({
    label: ["Chat name:"],
    limit: CHAT_NAME_LIMIT,
    text: lastChatName(services.messaging),
    done(name, flow) {
      start(flow, new ChatWidget(services, new ChatSession(services.messaging, number, name)));
    },
  });
}

/** Menu 3: `Phone number:` (Search: the phone book's), then the name, then the chat. */
export function chatScreen(services: StockServices, number = ""): Widget {
  return numberEntry({
    label: ["Phone number:"],
    number,
    // No counter (`chat/number`).
    counter: false,
    // Plan 19: Search picks a name's number (the virgin book's `No phone numbers`, `chat/search-empty`).
    search: (flow) =>
      pickNumber(services, flow, (picked, inner) => inner.replace(chatScreen(services, picked))),
    downSearches: true,
    done(number, flow) {
      flow.push(
        chatName(services, number, (inner, chat) => {
          inner.back();
          inner.replace(chat);
        }),
      );
    },
  });
}

/** Inbox › Options › Chat (`sms/inbox-option-chat`): the name, then a chat with the sender. */
export function chatWith(services: StockServices, number: string): Widget {
  return chatName(services, number, (flow, chat) => flow.replace(chat));
}
