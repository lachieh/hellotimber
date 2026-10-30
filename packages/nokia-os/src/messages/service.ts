// One phone's SMS traffic over its host network port (plan 18 D9, D10): sends that settle no
// sooner than the synthetic cell's median link time, and arrivals that land RECEIVE_LINK_MS after
// the host delivers them. Times are the kernel's (`tick`); the port has no clock.
import { RECEIVE_LINK_MS, SEND_LINK_MS } from "../resources";
import {
  checkIncomingSms,
  type StockBusinessCard,
  type StockIncomingSms,
  type StockNetworkPort,
  type StockSendOutcome,
  type StockSms,
  type StockRingtone,
} from "./network";
import type { StockMessages } from "./store";

/** What became of an arrival: in Inbox, or refused for want of a slot (`sms/full-arrival`). */
export type ArrivalResult = "stored" | "full";

export interface ArrivalListener {
  (sms: StockIncomingSms, result: ArrivalResult): void;
}

/**
 * Plan 18c (D10): takes an arrival before Inbox, true when it consumed it (Chat's partner: its
 * lines show in the chat and are not stored, `chat/inbox-after`).
 */
export type ArrivalClaim = (sms: StockIncomingSms) => boolean;

/** composer/send-ok: Message sent begins 3174 ms after Sending message. */
const RINGTONE_SEND_LINK_MS = 3174;

interface Sending {
  readonly dueAt: number;
  outcome: StockSendOutcome | undefined;
  readonly settled: (outcome: StockSendOutcome) => void;
}

/** What an outcome settles to: anything but `"sent"` is a failure. */
function outcomeOf(value: unknown): StockSendOutcome {
  return value === "sent" ? "sent" : "failed";
}

/**
 * A phone's messaging: its store (Inbox, Outbox), its network port and the link times.
 * `createStockPhone` connects it once and drives it from the kernel: `tick` every tick,
 * `poweredOff` and `atStandby` as the phone goes off and reaches standby.
 */
export class StockMessaging {
  readonly store: StockMessages;
  readonly #network: StockNetworkPort;
  /** Where Details' message centre comes from when a message arrives (Set 1's centre). */
  readonly #centre: () => string;
  #now = 0;
  #sending: Sending[] = [];
  /** Delivered, landing at `dueAt`. */
  #arriving: { readonly dueAt: number; readonly sms: StockIncomingSms }[] = [];
  /** Delivered while the phone was off (or not yet at standby since power-on). */
  #waiting: StockIncomingSms[] = [];
  #ready = false;
  readonly #listeners = new Set<ArrivalListener>();
  readonly #claims = new Set<ArrivalClaim>();
  #connected = false;

  constructor(store: StockMessages, network: StockNetworkPort, centre: () => string = () => "") {
    this.store = store;
    this.#network = network;
    this.#centre = centre;
  }

  /**
   * Subscribes to the network once. The subscription lasts as long as the phone: a host that
   * drops a phone keeps its port's reference until the port forgets it.
   */
  connect(): void {
    if (this.#connected) throw new Error("The phone's messaging is already connected.");
    this.#connected = true;
    this.#network.subscribe((sms) => this.deliver(sms));
  }

  /** An SMS from the network (checked: a malformed one throws, naming its field). */
  deliver(sms: StockIncomingSms): void {
    const checked = checkIncomingSms(sms);
    if (this.#ready) this.#arriving.push({ dueAt: this.#now + RECEIVE_LINK_MS, sms: checked });
    else this.#waiting.push(checked);
  }

  /**
   * Sends `sms` (the port is called at once) and calls `settled` with the outcome once the port
   * has settled it and SEND_LINK_MS has passed, at a `tick`. Power-off drops it unsettled.
   */
  send(sms: StockSms, settled: (outcome: StockSendOutcome) => void): void {
    this.#start(
      SEND_LINK_MS,
      () => this.#network.send({ number: sms.number, text: sms.text }),
      settled,
    );
  }

  /**
   * Plan 19 (D10): sends a business card as `send` does, settled no sooner than `linkMs` (Send
   * b'card's). A port without `sendBusinessCard` settles `"sent"` (the emulator's network).
   */
  sendBusinessCard(
    card: StockBusinessCard,
    linkMs: number,
    settled: (outcome: StockSendOutcome) => void,
  ): void {
    const port = this.#network;
    const copy: StockBusinessCard = {
      to: card.to,
      card: { name: card.card.name, number: card.card.number },
    };
    this.#start(
      linkMs,
      () => (port.sendBusinessCard === undefined ? "sent" : port.sendBusinessCard(copy)),
      settled,
    );
  }

  sendRingtone(message: StockRingtone, settled: (outcome: StockSendOutcome) => void): void {
    const copy: StockRingtone = {
      to: message.to,
      tone: { ...message.tone, tokens: message.tone.tokens.map((token) => ({ ...token })) },
    };
    this.#start(RINGTONE_SEND_LINK_MS, () => this.#network.sendRingtone?.(copy) ?? "sent", settled);
  }

  /** A send that settles once `call`'s outcome is in and `linkMs` has passed, at a `tick`. */
  #start(
    linkMs: number,
    call: () => StockSendOutcome | Promise<StockSendOutcome>,
    settled: (outcome: StockSendOutcome) => void,
  ): void {
    const sending: Sending = { dueAt: this.#now + linkMs, outcome: undefined, settled };
    this.#sending.push(sending);
    let result: StockSendOutcome | Promise<StockSendOutcome>;
    try {
      result = call();
    } catch {
      sending.outcome = "failed";
      return;
    }
    if (result instanceof Promise || typeof (result as { then?: unknown })?.then === "function") {
      Promise.resolve(result).then(
        (outcome) => {
          sending.outcome = outcomeOf(outcome);
        },
        () => {
          sending.outcome = "failed";
        },
      );
    } else sending.outcome = outcomeOf(result);
  }

  /**
   * Plan 18c: arrivals go to `claim` first while it is registered; one it consumes is neither
   * stored nor announced (no notice, no alert: UNVERIFIED for the alert).
   */
  claim(claim: ArrivalClaim): () => void {
    this.#claims.add(claim);
    return () => {
      this.#claims.delete(claim);
    };
  }

  /** Arrivals land here (the received notice, the alert): stored or refused. */
  onArrival(listener: ArrivalListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  tick(nowMs: number): void {
    this.#now = Math.max(this.#now, nowMs);
    const due = this.#sending.filter((s) => s.outcome !== undefined && s.dueAt <= this.#now);
    if (due.length > 0) {
      this.#sending = this.#sending.filter((s) => !due.includes(s));
      for (const s of due) s.settled(s.outcome!);
    }
    while (this.#arriving.length > 0 && this.#arriving[0]!.dueAt <= this.#now) {
      const { sms } = this.#arriving.shift()!;
      if (Array.from(this.#claims).some((claim) => claim(sms))) continue;
      const result = this.store.receive(sms, this.#centre());
      for (const listener of Array.from(this.#listeners)) listener(sms, result);
    }
  }

  /**
   * Power-off: sends in flight are dropped (their outcome is ignored), and messages on their way
   * wait for the next power-on (UNVERIFIED: the emulator cannot deliver to a phone that is off;
   * a real network retries).
   */
  poweredOff(): void {
    this.#sending = [];
    this.#waiting = [...this.#arriving.map((a) => a.sms), ...this.#waiting];
    this.#arriving = [];
    this.#ready = false;
  }

  /** The phone reached standby after power-on: waiting messages start their link time. */
  atStandby(): void {
    if (this.#ready) return;
    this.#ready = true;
    for (const sms of this.#waiting) {
      this.#arriving.push({ dueAt: this.#now + RECEIVE_LINK_MS, sms });
    }
    this.#waiting = [];
  }

  /** Whether a send is still waiting for its outcome or its link time. */
  get sending(): boolean {
    return this.#sending.length > 0;
  }
}
