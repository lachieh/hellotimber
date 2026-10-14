import { EditorApplication, PhoneApplication } from "@hellotimber/phone-core";
import type { ApplicationContext, PhoneApplicationSession } from "@hellotimber/phone-core";

export interface SmsContact {
  id: string;
  name: string;
}

export interface SmsDeps {
  contacts: readonly SmsContact[];
  send(contactId: string, text: string): Promise<string>;
  recordSend(contactId: string, text: string): void;
  recordReceive(contactId: string, text: string): void;
  notify(notice: { text: string; softkey: string; path?: string }): void;
  playAlert(): void;
  replyDelayMs?: () => number;
  schedule?: (fn: () => void | Promise<void>, ms: number) => void;
}

export const SMS_CHAR_LIMIT = 160;
const SENDING_MS = 1200;
const SENT_MS = 800;

const defaultReplyDelayMs = (): number => 2000 + Math.random() * 6000;
const defaultSchedule = (fn: () => void | Promise<void>, ms: number): void => {
  setTimeout(() => void fn(), ms);
};

class SmsFlow {
  readonly compose: SmsComposeApplication;
  readonly recipient: SmsRecipientApplication;
  readonly sending: SmsSendingApplication;
  draft = "";
  contactId: string | null = null;

  constructor(readonly deps: SmsDeps) {
    this.compose = new SmsComposeApplication(this);
    this.recipient = new SmsRecipientApplication(this);
    this.sending = new SmsSendingApplication(this);
  }
}

class SmsComposeApplication extends PhoneApplication {
  constructor(readonly flow: SmsFlow) {
    super("sms-compose");
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    return new EditorApplication(this.id, {
      title: "Message:",
      charLimit: SMS_CHAR_LIMIT,
      initial: this.flow.draft,
      menu: [
        { id: "send", label: "Send" },
        { id: "clear", label: "Clear text" },
        { id: "exit", label: "Exit" },
      ],
      onMenu: (id, text, menuContext) => {
        if (id !== "send" || text.trim() === "") return;
        this.flow.draft = text;
        menuContext.open(this.flow.recipient);
      },
    }).createSession(context);
  }
}

class SmsRecipientApplication extends PhoneApplication {
  constructor(readonly flow: SmsFlow) {
    super("sms-recipient");
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    const contacts = this.flow.deps.contacts;
    let selected = 0;
    return {
      onKey: (event) => {
        if (event.type === "down") {
          if (contacts.length === 0) return;
          if (event.key === "up") selected = (selected + contacts.length - 1) % contacts.length;
          else if (event.key === "down") selected = (selected + 1) % contacts.length;
          return;
        }
        if (event.key === "navi") {
          const contact = contacts[selected];
          if (contact === undefined) return;
          this.flow.contactId = contact.id;
          context.open(this.flow.sending);
        } else if (event.key === "c") {
          context.open(this.flow.compose);
        }
      },
      tick() {},
      render: () => ({
        kind: "list",
        title: "To:",
        items: contacts.map((contact) => contact.name),
        selected,
        softkey: "OK",
      }),
    };
  }
}

class SmsSendingApplication extends PhoneApplication {
  constructor(readonly flow: SmsFlow) {
    super("sms-sending");
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    const contactId = this.flow.contactId;
    const text = this.flow.draft;
    this.flow.contactId = null;
    this.flow.draft = "";
    let elapsed = 0;

    if (contactId !== null && text.trim() !== "") {
      const replyPromise = this.flow.deps.send(contactId, text);
      this.flow.deps.recordSend(contactId, text);
      const delay = (this.flow.deps.replyDelayMs ?? defaultReplyDelayMs)();
      (this.flow.deps.schedule ?? defaultSchedule)(async () => {
        const reply = await replyPromise.catch(() => null);
        if (reply === null || reply === "") return;
        this.flow.deps.recordReceive(contactId, reply);
        this.flow.deps.playAlert();
        this.flow.deps.notify({
          text: "1 message received",
          softkey: "Read",
          path: "menu/messages/inbox",
        });
      }, delay);
    }

    return {
      onKey() {},
      tick(dtMs) {
        elapsed += dtMs;
        if (elapsed >= SENDING_MS + SENT_MS) context.exit();
      },
      render: () => ({
        kind: "confirm",
        text: elapsed < SENDING_MS ? "Sending message" : "Message sent",
        softkey: "",
      }),
    };
  }
}

export class SmsApplication extends PhoneApplication {
  readonly #deps: SmsDeps;

  constructor(deps: SmsDeps) {
    super("write-message");
    this.#deps = deps;
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    const flow = new SmsFlow(this.#deps);
    return flow.compose.createSession(context);
  }
}
