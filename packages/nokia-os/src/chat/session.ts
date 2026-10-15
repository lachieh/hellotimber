// One Chat (plan 18c D8-D10, Task 0 C): the partner's number, the chat name and the history,
// newest line first. Lines go on the air as `<name>: <text>` (`chat/send`: `Bo: Hi`; `: Yo` with
// no name) through plan 18's messaging; an SMS from the partner's number while the chat runs is
// the partner's line, taken before Inbox (`chat/inbox-after`). Nothing of it outlives the chat
// but the name, which the next chat's `Chat name:` offers (`chat/reentry`; over a power cycle
// UNVERIFIED: kept in memory).
import type { StockMessaging } from "../messages/service";

export interface ChatLine {
  readonly from: "me" | "them";
  /** The line as the history shows it: `<name: text` or `>text`. */
  readonly text: string;
}

/** The last chat's name, per phone (its messaging). */
const LAST_NAMES = new WeakMap<StockMessaging, string>();

/** The name the next chat's `Chat name:` starts with (empty on the first chat). */
export function lastChatName(messaging: StockMessaging): string {
  return LAST_NAMES.get(messaging) ?? "";
}

export class ChatSession {
  readonly number: string;
  readonly #messaging: StockMessaging;
  #name: string;
  readonly #lines: ChatLine[] = [];
  /** The history's length when the send in progress started. */
  #sendFrom: number | undefined;

  constructor(messaging: StockMessaging, number: string, name: string) {
    this.#messaging = messaging;
    this.number = number;
    this.#name = name;
    LAST_NAMES.set(messaging, name);
  }

  get name(): string {
    return this.#name;
  }

  /** Options › Chat name. */
  rename(name: string): void {
    this.#name = name;
    LAST_NAMES.set(this.#messaging, name);
  }

  /** The history, newest first. */
  lines(): readonly ChatLine[] {
    return this.#lines;
  }

  /** What goes on the air for `text`. */
  airText(text: string): string {
    return `${this.#name}: ${text}`;
  }

  /** A send starts: the partner's lines from now on are newer than its line. */
  sending(): void {
    this.#sendFrom = this.#lines.length;
  }

  /**
   * `text` was sent: its line on top of the history, below the partner's lines that arrived
   * while it was sending (a host that answers before `Message sent`; UNVERIFIED).
   */
  sent(text: string): void {
    const newer = this.#lines.length - (this.#sendFrom ?? this.#lines.length);
    this.#lines.splice(newer, 0, { from: "me", text: `<${this.#name}: ${text}` });
    this.#sendFrom = undefined;
  }

  /**
   * Takes the partner's SMS while the chat runs (its line on top, then `arrived`); others go to
   * Inbox as usual. Returns the release.
   */
  listen(arrived: () => void): () => void {
    return this.#messaging.claim((sms) => {
      if (sms.number !== this.number) return false;
      this.#lines.unshift({ from: "them", text: `>${sms.text}` });
      arrived();
      return true;
    });
  }
}
