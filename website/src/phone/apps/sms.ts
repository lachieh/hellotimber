import { editorApp } from "@hellotimber/phone-core";
import type { AppFactory, KeyEvent, PhoneApp, ScreenModel } from "@hellotimber/phone-core";

/**
 * The authentic Write-messages flow (plan 08), as a chain of three apps:
 *
 *   write-message ──Options→Send──▶ sms-to ──pick──▶ sms-sending ──▶ exit
 *        ▲                            │
 *        └────────── C (draft intact) ┘
 *
 * The chain runs on one nav stack via ctx.open(); the URL stays at the
 * launching node (menu/messages/write) throughout. All effects (network,
 * store, notice, sound) arrive via injected deps — this module never
 * imports fetch, the store, or the phone.
 */

export interface SmsContact {
  id: string;
  name: string;
}

export interface SmsDeps {
  /** To: picker entries, in list order. */
  contacts: SmsContact[];
  /** Resolve the contact's reply (the website wraps /api/sms + canned fallback). */
  send(contactId: string, text: string): Promise<string>;
  /** Record the visitor's message (Outbox). */
  recordSend(contactId: string, text: string): void;
  /** Record the contact's reply (Inbox). */
  recordReceive(contactId: string, text: string): void;
  /** Standby notice: "1 message received" + Read. */
  notify(n: { text: string; softkey: string; path?: string }): void;
  /** Message-alert tone (respects settings/mute on the website side). */
  playAlert(): void;
  /** Reply latency; default 2–8 s randomized. Injectable for tests. */
  replyDelayMs?: () => number;
  /** Timer; default setTimeout. Injectable for tests. */
  schedule?: (fn: () => void | Promise<void>, ms: number) => void;
}

export const SMS_CHAR_LIMIT = 160;
const SENDING_MS = 1200;
const SENT_MS = 800;

const defaultReplyDelayMs = (): number => 2000 + Math.random() * 6000;
const defaultSchedule = (fn: () => void | Promise<void>, ms: number): void => {
  setTimeout(() => {
    void fn();
  }, ms);
};

/** The three flow apps, keyed by app id, for buildApps(). */
export function smsApps(deps: SmsDeps): Record<string, AppFactory> {
  // Chain state: survives ctx.open() handoffs within one browser session.
  let draft = "";
  let toContactId: string | null = null;

  const writeMessage: AppFactory = (ctx) =>
    // A fresh editorApp per launch so `initial` re-reads the stashed draft
    // (C from the To: picker reopens the editor with the draft intact).
    editorApp({
      title: "Message:",
      charLimit: SMS_CHAR_LIMIT,
      initial: draft,
      menu: [
        { id: "send", label: "Send" },
        { id: "clear", label: "Clear text" },
        { id: "exit", label: "Exit" },
      ],
      onMenu: (id, text, menuCtx) => {
        if (id !== "send") return; // "clear"/"exit" are editorApp built-ins
        if (text.trim() === "") return; // nothing to send — stay in the draft
        draft = text;
        menuCtx.open("sms-to");
      },
    })(ctx);

  const smsTo: AppFactory = (ctx) => {
    const count = deps.contacts.length;
    let selected = 0;
    const app: PhoneApp = {
      onKey(e: KeyEvent): void {
        if (e.type === "down") {
          if (count === 0) return;
          if (e.key === "up") selected = (selected + count - 1) % count;
          else if (e.key === "down") selected = (selected + 1) % count;
          return;
        }
        if (e.key === "navi") {
          const contact = deps.contacts[selected];
          if (contact === undefined) return;
          toContactId = contact.id;
          ctx.open("sms-sending");
        } else if (e.key === "c") {
          ctx.open("write-message"); // back to the draft, text intact
        }
      },
      tick(): void {},
      render(): ScreenModel {
        return {
          kind: "list",
          title: "To:",
          items: deps.contacts.map((c) => c.name),
          selected,
          softkey: "OK",
        };
      },
    };
    return app;
  };

  const smsSending: AppFactory = (ctx) => {
    const contactId = toContactId;
    const text = draft;
    // Consume the chain state — the next compose starts fresh.
    draft = "";
    toContactId = null;
    let elapsed = 0;

    if (contactId !== null && text.trim() !== "") {
      // send() first: its history snapshot must predate the outbox record.
      const replyPromise = deps.send(contactId, text);
      deps.recordSend(contactId, text);
      const delay = (deps.replyDelayMs ?? defaultReplyDelayMs)();
      (deps.schedule ?? defaultSchedule)(async () => {
        const reply = await replyPromise.catch(() => null);
        if (reply === null || reply === "") return; // send() already falls back; belt+braces
        deps.recordReceive(contactId, reply);
        deps.playAlert();
        deps.notify({
          text: "1 message received",
          softkey: "Read",
          path: "menu/messages/inbox",
        });
      }, delay);
    }

    return {
      onKey(): void {
        // The beat is short and authentic — keys are swallowed.
      },
      tick(dtMs: number): void {
        elapsed += dtMs;
        if (elapsed >= SENDING_MS + SENT_MS) ctx.exit();
      },
      render(): ScreenModel {
        return {
          kind: "confirm",
          text: elapsed < SENDING_MS ? "Sending message" : "Message sent",
          softkey: "",
        };
      },
    };
  };

  return {
    "write-message": writeMessage,
    "sms-to": smsTo,
    "sms-sending": smsSending,
  };
}
