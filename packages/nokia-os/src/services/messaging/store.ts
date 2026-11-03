// The phone's SMS storage (plan 18 D7, plan 30 D2): each SIM's message slots, kept in a per-SIM
// `messages` EEPROM record. Inbox (received messages) and Outbox (saved texts) share the SIM's
// slots (`sms/full`: ten incoming and five saved fill the emulator SIM's 15); an arrival or a Save
// takes the first free slot. Until the record holds a copy of a SIM's messages, that SIM's own
// (`StockSimCard.messages`, Task 0 M: `EF_SMS` read at power-on) are the contents; the first
// write (a read flag, an erase, an arrival, a Save) stores them all under the SIM's identity
// (plan 19 D3's rule). Restore factory settings keeps them (`sms/restore-*`, `plan30/sms/restore`),
// so the record has no `factory`.
import type { EepromRecord, RecordStore } from "../storage";
import { SIM_MESSAGE_SLOTS, type SimMessages } from "../sim/messages";
import type { StockIncomingSms, StockTimestamp } from "./network";

/** The emulator SIM's message slots, shared by Inbox and Outbox (`sms/full`: 10 + 5). */
export const MESSAGE_SLOTS = SIM_MESSAGE_SLOTS;

/** A received message in its slot (1-based). */
export interface InboxMessage {
  readonly slot: number;
  readonly number: string;
  readonly text: string;
  readonly sentAt: StockTimestamp;
  /** Its message centre (Details): the record's, or the phone's own Set 1 centre on arrival. */
  readonly centre: string;
  readonly read: boolean;
}

/** A saved message (Options › Save) in its slot: its text and, for a Reply or Forward, the number. */
export interface SavedMessage {
  readonly slot: number;
  readonly text: string;
  readonly number?: string;
}

interface OwnMessages {
  readonly inbox: readonly InboxMessage[];
  readonly outbox: readonly SavedMessage[];
}

export interface MessagesState {
  /** Each SIM's messages, by `StockSimCard.id`. */
  readonly sims: Readonly<Record<string, OwnMessages>>;
}

/** The SIM a phone's messages belong to: its identity, slots and what its records hold. */
export interface MessagesSim {
  readonly id: string;
  readonly messages: SimMessages;
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

const isSlot = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1;

function decodeInbox(value: unknown): (Omit<InboxMessage, "slot"> & { slot?: number }) | undefined {
  if (!isObject(value)) return undefined;
  const { number, text, centre, read, slot } = value;
  const sentAt = decodeStamp(value.sentAt);
  if (typeof number !== "string" || typeof text !== "string" || sentAt === undefined) {
    return undefined;
  }
  if (typeof centre !== "string" || typeof read !== "boolean") return undefined;
  return { number, text, sentAt, centre, read, ...(isSlot(slot) ? { slot } : {}) };
}

function decodeSaved(value: unknown): (Omit<SavedMessage, "slot"> & { slot?: number }) | undefined {
  if (!isObject(value) || typeof value.text !== "string") return undefined;
  if (value.number !== undefined && typeof value.number !== "string") return undefined;
  return {
    text: value.text,
    ...(value.number === undefined ? {} : { number: value.number as string }),
    ...(isSlot(value.slot) ? { slot: value.slot } : {}),
  };
}

const defined = <T>(item: T | undefined): item is T => item !== undefined;

/**
 * Gives every message a slot: a stored one keeps its own (the first of two in the same slot wins),
 * one without (plan 18's records, written before slots) takes the first free slot, Inbox first.
 */
function slotted<I extends { slot?: number }, O extends { slot?: number }>(
  inbox: readonly I[],
  outbox: readonly O[],
): { inbox: (I & { slot: number })[]; outbox: (O & { slot: number })[] } {
  const used = new Set<number>();
  const keep = <T extends { slot?: number }>(list: readonly T[]) =>
    list.map((m) => {
      if (m.slot === undefined || used.has(m.slot)) return { ...m, slot: undefined };
      used.add(m.slot);
      return m;
    });
  const kept = { inbox: keep(inbox), outbox: keep(outbox) };
  let next = 1;
  const place = <T extends { slot?: number }>(m: T): T & { slot: number } => {
    if (m.slot !== undefined) return m as T & { slot: number };
    while (used.has(next)) next++;
    used.add(next);
    return { ...m, slot: next };
  };
  return { inbox: kept.inbox.map(place), outbox: kept.outbox.map(place) };
}

/** `{ sims: { <sim>: { inbox: [...], outbox: [...] } } }`, each message with its slot (plan 30). */
export const MESSAGES_RECORD: EepromRecord<MessagesState> = {
  name: "messages",
  version: 1,
  initial: () => ({ sims: {} }),
  decode(data) {
    if (!isObject(data) || !isObject(data.sims)) throw new Error("sims must be an object.");
    const sims: Record<string, OwnMessages> = {};
    for (const [sim, value] of Object.entries(data.sims)) {
      if (!isObject(value) || !Array.isArray(value.inbox) || !Array.isArray(value.outbox)) {
        throw new Error(`sims.${sim} must hold an inbox and an outbox list.`);
      }
      // A malformed message is dropped, the rest kept (D2: stale content in a good shape).
      sims[sim] = slotted(
        value.inbox.map(decodeInbox).filter(defined),
        value.outbox.map(decodeSaved).filter(defined),
      );
    }
    return { sims };
  },
  encode: (value) => ({ sims: value.sims }),
};

const bySlot = (a: { slot: number }, b: { slot: number }) => a.slot - b.slot;

/** One SIM's messages in the phone's EEPROM. */
export class StockMessages {
  readonly #eeprom: RecordStore;
  readonly #sim: MessagesSim;

  /** `sim`: the inserted card (a string is the emulator SIM, 15 empty slots, under that id). */
  constructor(eeprom: RecordStore, sim: string | MessagesSim) {
    this.#eeprom = eeprom;
    this.#sim =
      typeof sim === "string"
        ? { id: sim, messages: { slots: SIM_MESSAGE_SLOTS, entries: [] } }
        : sim;
  }

  /** The SIM's message slots (Task 0 M: the capacity follows the SIM). */
  get slots(): number {
    return this.#sim.messages.slots;
  }

  /** The stored copy of this SIM's messages, else what the SIM itself holds. */
  #own(): OwnMessages {
    const stored = this.#eeprom.read(MESSAGES_RECORD).sims[this.#sim.id];
    if (stored !== undefined) return stored;
    const inbox: InboxMessage[] = [];
    this.#sim.messages.entries.forEach((m, i) => {
      if (m !== null) inbox.push({ slot: i + 1, ...m });
    });
    return { inbox, outbox: [] };
  }

  #write(messages: OwnMessages): void {
    const state = this.#eeprom.read(MESSAGES_RECORD);
    this.#eeprom.write(MESSAGES_RECORD, { sims: { ...state.sims, [this.#sim.id]: messages } });
  }

  /** The first free slot, or undefined when every slot is used. */
  #freeSlot(own: OwnMessages): number | undefined {
    const used = new Set([...own.inbox, ...own.outbox].map((m) => m.slot));
    for (let slot = 1; slot <= this.slots; slot++) if (!used.has(slot)) return slot;
    return undefined;
  }

  /**
   * Received messages as the Inbox lists them when it opens (Task 0 M, `sms/order`): unread
   * first, then read, each in slot order.
   */
  inbox(): readonly InboxMessage[] {
    const inbox = [...this.#own().inbox].sort(bySlot);
    return [...inbox.filter((m) => !m.read), ...inbox.filter((m) => m.read)];
  }

  /** Saved messages, in slot order (`sms/outbox-list`). */
  outbox(): readonly SavedMessage[] {
    return [...this.#own().outbox].sort(bySlot);
  }

  /** An arrival, unread, in the first free slot; `full` when every slot is used (`sms/full`). */
  receive(sms: StockIncomingSms, centre = ""): "stored" | "full" {
    const own = this.#own();
    const slot = this.#freeSlot(own);
    if (slot === undefined) return "full";
    const { number, text, sentAt } = sms;
    const message: InboxMessage = { slot, number, text, sentAt, centre, read: false };
    this.#write({ ...own, inbox: [...own.inbox, message] });
    return "stored";
  }

  /** Options › Save: the text (and a number) in the first free slot; `full` with none left. */
  save(text: string, number?: string): "saved" | "full" {
    const own = this.#own();
    const slot = this.#freeSlot(own);
    if (slot === undefined) return "full";
    const saved = number === undefined ? { slot, text } : { slot, text, number };
    this.#write({ ...own, outbox: [...own.outbox, saved] });
    return "saved";
  }

  /** The Inbox message in `slot` has been read. */
  markRead(slot: number): void {
    const own = this.#own();
    const message = own.inbox.find((m) => m.slot === slot);
    if (message === undefined || message.read) return;
    const inbox = own.inbox.map((m) => (m === message ? { ...m, read: true } : m));
    this.#write({ ...own, inbox });
  }

  /** Erases the message of `list` in `slot`. */
  erase(list: "inbox" | "outbox", slot: number): void {
    const own = this.#own();
    if (list === "inbox") this.#write({ ...own, inbox: own.inbox.filter((m) => m.slot !== slot) });
    else this.#write({ ...own, outbox: own.outbox.filter((m) => m.slot !== slot) });
  }

  /** Every slot is used (the standby envelope blinks, `sms/full-arrival`). */
  full(): boolean {
    return this.#freeSlot(this.#own()) === undefined;
  }

  /** How many Inbox messages are unread (the standby envelope while any are). */
  unread(): number {
    return this.#own().inbox.filter((m) => !m.read).length;
  }
}
