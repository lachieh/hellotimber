// The call register (plan 22 D12, D13; docs/specs/stock/calls.md): the Missed, Received and
// Dialled lists, the unread missed calls behind the notice and `<n> new numbers`, and the call
// durations. The lists are the phone's RAM (Task 0 F: a power cycle empties them); the durations
// are the `calls` EEPROM record (they survive power-off; Clear timers and Restore zero them).
import type { EepromRecord, StockEeprom } from "../firmware/eeprom";
import type { CallStamp } from "./timestamp";

export type CallList = "missed" | "received" | "dialled";

/** Each list's capacity (`register/missed-12`, `register/dialled-21`): the oldest drops. */
export const CALL_LIST_CAPACITY: Readonly<Record<CallList, number>> = {
  missed: 10,
  received: 10,
  dialled: 20,
};

export interface CallEntry {
  readonly number: string;
  /** The phone book name the number had when the call was listed, if any. */
  readonly name?: string;
  readonly at?: CallStamp;
}

/** Seconds shown on Show call duration's pages. */
export interface CallDurations {
  readonly last: number;
  readonly all: number;
  readonly received: number;
  readonly dialled: number;
}

const ZERO: CallDurations = { last: 0, all: 0, received: 0, dialled: 0 };

/**
 * The seconds a connected call adds (Task 0 X, `durations/fit`): none until ≈820 ms, then one
 * more every ≈980 ms of emulated time (0.81 s → 0, 1.31 → 1, 1.81 → 2, 60.81 → 62).
 */
export const DURATION_FIRST_MS = 820;
export const DURATION_TICK_MS = 980;

export function callSeconds(connectedMs: number): number {
  if (connectedMs < DURATION_FIRST_MS) return 0;
  return Math.floor((connectedMs - DURATION_FIRST_MS) / DURATION_TICK_MS) + 1;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const seconds = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;

/** The `calls` record (v1): the duration totals, in seconds. No lists: they are RAM. */
export const CALLS_RECORD: EepromRecord<CallDurations> = {
  name: "calls",
  version: 1,
  initial: () => ZERO,
  decode(data) {
    if (!isObject(data) || !isObject(data.durations))
      throw new Error("durations must be an object.");
    const d = data.durations;
    // A malformed total reads as zero (D2: stale content in a good shape).
    return {
      last: seconds(d.last),
      all: seconds(d.all),
      received: seconds(d.received),
      dialled: seconds(d.dialled),
    };
  },
  encode: (value) => ({ durations: { ...value } }),
  // Restore factory settings zeroes the timers (`persist/restore-duration`).
  factory: () => ZERO,
};

/** One phone's call register: the lists for this power cycle and the durations record. */
export class StockCallLog {
  readonly #eeprom: StockEeprom;
  #lists: Record<CallList, CallEntry[]> = { missed: [], received: [], dialled: [] };
  /** Missed calls since the notice was last seen (the notice counts calls). */
  #noticeCount = 0;
  /** Missed numbers not yet seen in Missed calls (`<n> new numbers`: two calls, one number). */
  #unread = new Set<string>();

  constructor(eeprom: StockEeprom) {
    this.#eeprom = eeprom;
  }

  /** Newest first. */
  entries(list: CallList): readonly CallEntry[] {
    return this.#lists[list];
  }

  /**
   * Lists `entry` first; an entry for the same number moves up (no duplicate); the oldest beyond
   * the capacity drops. A missed call also counts toward the notice and the new numbers.
   */
  add(list: CallList, entry: CallEntry): void {
    const rest = this.#lists[list].filter((e) => e.number !== entry.number);
    this.#lists[list] = [entry, ...rest].slice(0, CALL_LIST_CAPACITY[list]);
    if (list !== "missed") return;
    this.#noticeCount += 1;
    this.#unread.add(entry.number);
    this.#dropStale();
  }

  /** Unread numbers no longer listed (dropped past the capacity, erased) are not new. */
  #dropStale(): void {
    const listed = new Set(this.#lists.missed.map((e) => e.number));
    for (const number of this.#unread) if (!listed.has(number)) this.#unread.delete(number);
  }

  /** Erases one entry (`index`) of `list`, or whole lists (Erase recent call lists). */
  erase(list: CallList | "all", index?: number): void {
    if (list === "all") {
      this.#lists = { missed: [], received: [], dialled: [] };
    } else if (index === undefined) {
      this.#lists[list] = [];
    } else {
      this.#lists[list] = this.#lists[list].filter((_, i) => i !== index);
    }
    this.#dropStale();
  }

  /** Missed calls since the notice was last cleared. */
  missedCalls(): number {
    return this.#noticeCount;
  }

  clearNotice(): void {
    this.#noticeCount = 0;
  }

  /** New missed numbers not yet seen in Missed calls. */
  unreadMissed(): number {
    return this.#unread.size;
  }

  markMissedRead(): void {
    this.#unread.clear();
  }

  /** The power went off: the lists and counts are RAM (Task 0 F). */
  powerOff(): void {
    this.#lists = { missed: [], received: [], dialled: [] };
    this.#noticeCount = 0;
    this.#unread.clear();
  }

  durations(): CallDurations {
    return this.#eeprom.read(CALLS_RECORD);
  }

  /** A call ended after `connectedMs` connected. */
  addDuration(direction: "received" | "dialled", connectedMs: number): void {
    const s = callSeconds(connectedMs);
    const d = this.durations();
    this.#eeprom.write(CALLS_RECORD, {
      last: s,
      all: d.all + s,
      received: d.received + (direction === "received" ? s : 0),
      dialled: d.dialled + (direction === "dialled" ? s : 0),
    });
  }

  /** Clear timers. */
  clearDurations(): void {
    this.#eeprom.write(CALLS_RECORD, ZERO);
  }
}

/** `hh:mm:ss` (`00:00:18`) as Show call duration's pages draw it. */
export function durationText(totalSeconds: number): string {
  const two = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${two(h)}:${two(m)}:${two(totalSeconds % 60)}`;
}
