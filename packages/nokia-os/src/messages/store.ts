// The phone's SMS storage (plan 18 D7): a provisional per-SIM `messages` EEPROM record holding
// each SIM's Inbox (received messages, oldest first) and Outbox (saved texts). Task 0 F: ten
// incoming and five saved messages fill 15 shared slots (`sms/full`); Restore factory settings
// keeps them (`sms/restore-*`), so the record has no `factory`. Keying the slots by SIM is host
// storage policy, not a measured fact (the emulator's SIM overlay does not survive a new process).
import type { EepromRecord, StockEeprom } from "../firmware/eeprom";
import type { StockIncomingSms, StockTimestamp } from "./network";

/** The SIM's message slots, shared by Inbox and Outbox (`sms/full`: 10 + 5). */
export const MESSAGE_SLOTS = 15;

/** A received message. */
export interface InboxMessage {
  readonly number: string;
  readonly text: string;
  readonly sentAt: StockTimestamp;
  /** Its message centre (Details): the phone's own Set 1 centre when it arrived. */
  readonly centre: string;
  readonly read: boolean;
}

/** A saved message (Options › Save): its text and, for a Reply or Forward, the number. */
export interface SavedMessage {
  readonly text: string;
  readonly number?: string;
}

interface SimMessages {
  readonly inbox: readonly InboxMessage[];
  readonly outbox: readonly SavedMessage[];
}

export interface MessagesState {
  /** Each SIM's messages, by `StockPhoneConfig.sim`. */
  readonly sims: Readonly<Record<string, SimMessages>>;
}

const STAMP_FIELDS = ["year", "month", "day", "hour", "minute", "second"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeStamp(value: unknown): StockTimestamp | undefined {
  if (!isObject(value)) return undefined;
  if (!STAMP_FIELDS.every((f) => Number.isInteger(value[f]))) return undefined;
  return Object.fromEntries(STAMP_FIELDS.map((f) => [f, value[f]])) as unknown as StockTimestamp;
}

function decodeInbox(value: unknown): InboxMessage | undefined {
  if (!isObject(value)) return undefined;
  const { number, text, centre, read } = value;
  const sentAt = decodeStamp(value.sentAt);
  if (typeof number !== "string" || typeof text !== "string" || sentAt === undefined) {
    return undefined;
  }
  if (typeof centre !== "string" || typeof read !== "boolean") return undefined;
  return { number, text, sentAt, centre, read };
}

function decodeSaved(value: unknown): SavedMessage | undefined {
  if (!isObject(value) || typeof value.text !== "string") return undefined;
  if (value.number !== undefined && typeof value.number !== "string") return undefined;
  return value.number === undefined
    ? { text: value.text }
    : { text: value.text, number: value.number };
}

const defined = <T>(item: T | undefined): item is T => item !== undefined;

/** The `messages` record (plan 15 D2): `{ sims: { <sim>: { inbox: [...], outbox: [...] } } }`. */
export const MESSAGES_RECORD: EepromRecord<MessagesState> = {
  name: "messages",
  version: 1,
  initial: () => ({ sims: {} }),
  decode(data) {
    if (!isObject(data) || !isObject(data.sims)) throw new Error("sims must be an object.");
    const sims: Record<string, SimMessages> = {};
    for (const [sim, value] of Object.entries(data.sims)) {
      if (!isObject(value) || !Array.isArray(value.inbox) || !Array.isArray(value.outbox)) {
        throw new Error(`sims.${sim} must hold an inbox and an outbox list.`);
      }
      // A malformed message is dropped, the rest kept (D2: stale content in a good shape).
      sims[sim] = {
        inbox: value.inbox.map(decodeInbox).filter(defined),
        outbox: value.outbox.map(decodeSaved).filter(defined),
      };
    }
    return { sims };
  },
  encode: (value) => ({ sims: value.sims }),
};

/** One SIM's messages in the phone's EEPROM. */
export class StockMessages {
  readonly #eeprom: StockEeprom;
  readonly #sim: string;

  constructor(eeprom: StockEeprom, sim: string) {
    this.#eeprom = eeprom;
    this.#sim = sim;
  }

  #own(): SimMessages {
    return this.#eeprom.read(MESSAGES_RECORD).sims[this.#sim] ?? { inbox: [], outbox: [] };
  }

  #write(messages: SimMessages): void {
    const state = this.#eeprom.read(MESSAGES_RECORD);
    this.#eeprom.write(MESSAGES_RECORD, { sims: { ...state.sims, [this.#sim]: messages } });
  }

  /** Received messages, oldest first (`sms/inbox-list`). */
  inbox(): readonly InboxMessage[] {
    return this.#own().inbox;
  }

  /** Saved messages, oldest first (`sms/outbox-list`). */
  outbox(): readonly SavedMessage[] {
    return this.#own().outbox;
  }

  #full(own: SimMessages): boolean {
    return own.inbox.length + own.outbox.length >= MESSAGE_SLOTS;
  }

  /** An arrival, unread, at the end of Inbox; `full` when every slot is used (`sms/full`). */
  receive(sms: StockIncomingSms, centre = ""): "stored" | "full" {
    const own = this.#own();
    if (this.#full(own)) return "full";
    const { number, text, sentAt } = sms;
    this.#write({ ...own, inbox: [...own.inbox, { number, text, sentAt, centre, read: false }] });
    return "stored";
  }

  /** Options › Save: the text (and a number) at the end of Outbox; `full` with no slot left. */
  save(text: string, number?: string): "saved" | "full" {
    const own = this.#own();
    if (this.#full(own)) return "full";
    const saved = number === undefined ? { text } : { text, number };
    this.#write({ ...own, outbox: [...own.outbox, saved] });
    return "saved";
  }

  /** Inbox message `index` has been read. */
  markRead(index: number): void {
    const own = this.#own();
    if (own.inbox[index] === undefined || own.inbox[index]!.read) return;
    const inbox = own.inbox.map((m, i) => (i === index ? { ...m, read: true } : m));
    this.#write({ ...own, inbox });
  }

  /** Erases message `index` of `list`. */
  erase(list: "inbox" | "outbox", index: number): void {
    const own = this.#own();
    if (list === "inbox") {
      this.#write({ ...own, inbox: own.inbox.filter((_, i) => i !== index) });
    } else this.#write({ ...own, outbox: own.outbox.filter((_, i) => i !== index) });
  }

  /** How many Inbox messages are unread (the standby envelope while any are). */
  unread(): number {
    return this.#own().inbox.filter((m) => !m.read).length;
  }
}
