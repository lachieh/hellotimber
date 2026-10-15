// The host network port (plan 18 D9): the only way an SMS enters or leaves the phone. The port
// carries recipient numbers or addresses and text, and an incoming message's service-centre time
// stamp, and nothing of the radio protocol (no SMSC, no PDU). Times are the phone's: the port has
// no clock. A host backs it with whatever it likes (a test network, the website's contacts); the
// default, `createSyntheticNetwork`, behaves as the v6.39 emulator's network does (Task 0 S10,
// S11): it accepts every SMS and never loops one back.

/** One SMS as the phone sees it: a typed recipient number (or routing address) and its text. */
export interface StockSms {
  readonly number: string;
  readonly text: string;
}

/** The service centre's time stamp of an incoming SMS (local time, as the phone shows it). */
export interface StockTimestamp {
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

export interface StockIncomingSms extends StockSms {
  readonly sentAt: StockTimestamp;
}

export type StockSendOutcome = "sent" | "failed";

/** The phone's network for SMS. The host owns delivery and outcomes; times are the phone's. */
export interface StockNetworkPort {
  /**
   * An outgoing SMS. The phone shows `Sending message` until this settles and its link time has
   * passed; a promise that rejects counts as `"failed"`.
   */
  send(sms: StockSms): StockSendOutcome | Promise<StockSendOutcome>;
  /** Called once by `createStockPhone`; the host calls `deliver` for each incoming SMS. */
  subscribe(deliver: (sms: StockIncomingSms) => void): () => void;
}

/** The synthetic network: the port, `deliver` to inject an SMS, and what phones sent. */
export interface SyntheticNetwork extends StockNetworkPort {
  /** Injects an incoming SMS into every subscribed phone (validated: throws naming a field). */
  deliver(sms: StockIncomingSms): void;
  /** Every SMS phones sent through this network, in order. */
  readonly sent: readonly StockSms[];
}

const TIMESTAMP_RANGES: Readonly<Record<keyof StockTimestamp, readonly [number, number]>> = {
  year: [1900, 9999],
  month: [1, 12],
  day: [1, 31],
  hour: [0, 23],
  minute: [0, 59],
  second: [0, 59],
};

/**
 * An incoming SMS checked field by field: a malformed one throws, naming the field (plan 18
 * "Contract changes"). Returns a copy the host cannot change afterwards.
 */
export function checkIncomingSms(sms: StockIncomingSms): StockIncomingSms {
  const value = sms as Partial<Record<keyof StockIncomingSms, unknown>> | null;
  if (typeof value !== "object" || value === null) {
    throw new TypeError("An incoming SMS must be an object.");
  }
  for (const field of ["number", "text"] as const) {
    if (typeof value[field] !== "string") {
      throw new TypeError(`An incoming SMS's ${field} must be a string.`);
    }
  }
  const sentAt = value.sentAt as Partial<Record<keyof StockTimestamp, unknown>> | undefined;
  if (typeof sentAt !== "object" || sentAt === null) {
    throw new TypeError("An incoming SMS's sentAt must be a time stamp.");
  }
  for (const [field, [min, max]] of Object.entries(TIMESTAMP_RANGES)) {
    const n = sentAt[field as keyof StockTimestamp];
    if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) {
      throw new RangeError(
        `An incoming SMS's sentAt.${field} must be an integer ${min}-${max} (received ${JSON.stringify(n)}).`,
      );
    }
  }
  const stamp = sentAt as unknown as StockTimestamp;
  return {
    number: sms.number,
    text: sms.text,
    sentAt: {
      year: stamp.year,
      month: stamp.month,
      day: stamp.day,
      hour: stamp.hour,
      minute: stamp.minute,
      second: stamp.second,
    },
  };
}

/**
 * The v6.39 emulator's network (D9): every send is `"sent"`, nothing loops back; `deliver`
 * injects an incoming SMS into every subscribed phone and `sent` lists what phones sent.
 */
export function createSyntheticNetwork(): SyntheticNetwork {
  const subscribers = new Set<(sms: StockIncomingSms) => void>();
  const sent: StockSms[] = [];
  return {
    send(sms) {
      sent.push({ number: sms.number, text: sms.text });
      return "sent";
    },
    subscribe(deliver) {
      subscribers.add(deliver);
      return () => {
        subscribers.delete(deliver);
      };
    },
    deliver(sms) {
      const checked = checkIncomingSms(sms);
      for (const deliver of Array.from(subscribers)) deliver(checked);
    },
    sent,
  };
}
