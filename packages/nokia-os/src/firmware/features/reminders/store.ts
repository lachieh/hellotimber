// The reminder memory (plan 21 D7, D8, Task 0): up to 10 reminders, each a text (35 characters)
// and an optional alarm (a calendar minute), kept in the EEPROM across power cycles and Restore
// factory settings. The virgin EEPROM holds one junk reminder (`0000000000`, P3): dormant here
// (never listed or alerted, D8), it keeps View all and Erase on the level until Erase › All.
import type { EepromRecord, StockEeprom } from "../../eeprom";
import { minuteIndex, type PhoneTime } from "../../../kit/system/clock/time";

/** The memory holds this many reminders (plan21 reminders-full: the 11th asks to replace one). */
export const REMINDERS_CAPACITY = 10;
/** A reminder's text holds this many characters (`Remind about:`'s counter). */
export const REMINDER_TEXT_LIMIT = 35;
/** Snooze alerts again this many minutes later (plan21 reminders/alert-resnooze-*). */
export const REMINDER_SNOOZE_MINUTES = 10;

export interface Reminder {
  readonly text: string;
  /** When it alerts, null without an alarm. */
  readonly alarm: PhoneTime | null;
  /** Its alert was answered (or it fell due while the phone was off and was shown). */
  readonly alerted: boolean;
  /** Snoozed: it alerts again at this minute (minuteIndex), else null. */
  readonly snoozedTo: number | null;
  /** The order it was added in (two due in one minute: the later-added first). */
  readonly added: number;
}

export interface RemindersState {
  readonly list: readonly Reminder[];
  /** The virgin EEPROM's junk reminder is still there (D8). */
  readonly junk: boolean;
  /** The next `added` number. */
  readonly next: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

function decodeTime(value: unknown): PhoneTime | null {
  if (!isPlainObject(value)) return null;
  const { year, month, day, hour, minute } = value;
  return isInt(year, 1900, 2999) &&
    isInt(month, 1, 12) &&
    isInt(day, 1, 31) &&
    isInt(hour, 0, 23) &&
    isInt(minute, 0, 59)
    ? { year, month, day, hour, minute }
    : null;
}

function decodeReminder(value: unknown): Reminder | undefined {
  if (!isPlainObject(value)) return undefined;
  const { text, alarm, alerted, snoozedTo, added } = value;
  if (typeof text !== "string" || Array.from(text).length > REMINDER_TEXT_LIMIT) return undefined;
  if (!isInt(added, 0, 1e9)) return undefined;
  return {
    text,
    alarm: decodeTime(alarm),
    alerted: alerted === true,
    snoozedTo: isInt(snoozedTo, -1e9, 1e9) ? snoozedTo : null,
    added,
  };
}

const VIRGIN: RemindersState = { list: [], junk: true, next: 0 };

/**
 * `nokia-os/reminders`: virgin the junk reminder alone; kept by Restore factory settings
 * (plan21 restore/after-reminders). Malformed reminders are dropped (plan 15 D2).
 */
export const REMINDERS_RECORD: EepromRecord<RemindersState> = {
  name: "reminders",
  version: 1,
  initial: () => VIRGIN,
  decode(data) {
    if (!isPlainObject(data)) throw new Error("not an object.");
    const raw = Array.isArray(data["list"]) ? data["list"] : [];
    const list = raw
      .map(decodeReminder)
      .filter((r): r is Reminder => r !== undefined)
      .slice(0, REMINDERS_CAPACITY);
    const next = Math.max(
      isInt(data["next"], 0, 1e9) ? data["next"] : 0,
      ...list.map((r) => r.added + 1),
    );
    return { list, junk: data["junk"] === true, next };
  },
  encode: (value) => ({ list: value.list, junk: value.junk, next: value.next }),
};

/** A reminder's due minute: its snooze, else its alarm (null: never). */
export function dueMinute(reminder: Reminder): number | null {
  if (reminder.snoozedTo !== null) return reminder.snoozedTo;
  if (reminder.alarm === null || reminder.alerted) return null;
  return minuteIndex(reminder.alarm);
}

/** View all's order: by alarm time, those without an alarm last, then as added. */
export function viewOrder(list: readonly Reminder[]): readonly Reminder[] {
  const key = (r: Reminder) => (r.alarm === null ? Infinity : minuteIndex(r.alarm));
  return [...list].sort((a, b) => key(a) - key(b) || a.added - b.added);
}

export class StockReminders {
  readonly #eeprom: StockEeprom;

  constructor(eeprom: StockEeprom) {
    this.#eeprom = eeprom;
  }

  #state(): RemindersState {
    return this.#eeprom.read(REMINDERS_RECORD);
  }

  #write(state: RemindersState): void {
    this.#eeprom.write(REMINDERS_RECORD, state);
  }

  /** The reminders in View all's order. */
  list(): readonly Reminder[] {
    return viewOrder(this.#state().list);
  }

  /** Whether the level lists View all and Erase (a reminder, or the virgin junk one). */
  any(): boolean {
    const state = this.#state();
    return state.junk || state.list.length > 0;
  }

  full(): boolean {
    return this.#state().list.length >= REMINDERS_CAPACITY;
  }

  /** Adds a reminder (its `added` stamped); `replacing`: the one it replaces (memory full). */
  add(text: string, alarm: PhoneTime | null, replacing?: Reminder): Reminder | undefined {
    const state = this.#state();
    const list = state.list.filter((r) => r !== replacing && !same(r, replacing));
    if (list.length >= REMINDERS_CAPACITY) return undefined;
    const reminder: Reminder = { text, alarm, alerted: false, snoozedTo: null, added: state.next };
    this.#write({ ...state, list: [...list, reminder], next: state.next + 1 });
    return reminder;
  }

  /** Replaces `old` with `text` and `alarm` (Options › Edit), as a fresh reminder. */
  edit(old: Reminder, text: string, alarm: PhoneTime | null): void {
    const state = this.#state();
    const list = state.list.map((r) =>
      same(r, old) ? { text, alarm, alerted: false, snoozedTo: null, added: r.added } : r,
    );
    this.#write({ ...state, list });
  }

  erase(reminder: Reminder): void {
    const state = this.#state();
    this.#write({ ...state, list: state.list.filter((r) => !same(r, reminder)) });
  }

  /** Erase › All: the junk reminder too. */
  eraseAll(): void {
    const state = this.#state();
    this.#write({ ...state, list: [], junk: false });
  }

  /** The reminders due at `at`, the later-added first (D2). */
  due(at: PhoneTime): readonly Reminder[] {
    const now = minuteIndex(at);
    return this.#state()
      .list.filter((r) => {
        const due = dueMinute(r);
        return due !== null && due <= now;
      })
      .sort((a, b) => b.added - a.added);
  }

  /** Its alert was shown: answered (`snoozeTo` null) or snoozed to that minute. */
  answered(reminder: Reminder, snoozeTo: number | null): void {
    const state = this.#state();
    const list = state.list.map((r) =>
      same(r, reminder) ? { ...r, alerted: true, snoozedTo: snoozeTo } : r,
    );
    this.#write({ ...state, list });
  }

  /** The stored copy of `reminder` (it may have been answered or edited since). */
  find(reminder: Reminder): Reminder | undefined {
    return this.#state().list.find((r) => same(r, reminder));
  }
}

const same = (a: Reminder, b: Reminder | undefined): boolean =>
  b !== undefined && a.added === b.added;
