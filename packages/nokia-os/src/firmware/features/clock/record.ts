// The clock's EEPROM record (plan 21 D7): what the phone keeps about its clock across power
// cycles. The firmware's own representation is UNVERIFIED; this is the reproduction's.
import type { EepromRecord } from "../../eeprom";

export interface AlarmTime {
  readonly hour: number;
  readonly minute: number;
}

export interface ClockState {
  /** The alarm clock's time (kept while Off: its prompt shows it), null in the virgin EEPROM. */
  readonly alarm: AlarmTime | null;
  /** Whether the alarm is set (On); it clears when the alarm rings (a one-shot, Task 0). */
  readonly alarmOn: boolean;
  /** A snoozed alarm rings again at this minute (minuteIndex of phone time), null otherwise. */
  readonly snooze: { readonly dueMinute: number } | null;
  /** Phone time minus host time, in minutes (Set the time, Date setting; D1). */
  readonly offsetMinutes: number;
  /** Clock settings › Hide clock (Show clock clears it). */
  readonly hidden: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

function decodeAlarm(value: unknown): AlarmTime | null {
  if (!isPlainObject(value)) return null;
  const { hour, minute } = value;
  return isInt(hour, 0, 23) && isInt(minute, 0, 59) ? { hour, minute } : null;
}

function decodeSnooze(value: unknown): ClockState["snooze"] {
  if (!isPlainObject(value)) return null;
  const { dueMinute } = value;
  return isInt(dueMinute, -1e9, 1e9) ? { dueMinute } : null;
}

const VIRGIN: ClockState = {
  alarm: null,
  alarmOn: false,
  snooze: null,
  offsetMinutes: 0,
  hidden: false,
};

/**
 * `nokia-os/clock`: virgin no alarm, no offset, the clock shown. Restore factory settings shows
 * the clock again and keeps the alarm and the time (plan21 restore/*).
 */
export const CLOCK_RECORD: EepromRecord<ClockState> = {
  name: "clock",
  version: 1,
  initial: () => VIRGIN,
  decode(data) {
    if (!isPlainObject(data)) throw new Error("not an object.");
    // Malformed fields fall back to their virgin value (plan 15 D2: stale content is dropped).
    const alarm = decodeAlarm(data["alarm"]);
    return {
      alarm,
      alarmOn: alarm !== null && data["alarmOn"] === true,
      snooze: decodeSnooze(data["snooze"]),
      offsetMinutes: isInt(data["offsetMinutes"], -1e9, 1e9) ? data["offsetMinutes"] : 0,
      hidden: data["hidden"] === true,
    };
  },
  factory: (current) => ({ ...current, hidden: false }),
  encode: (value) => ({
    alarm: value.alarm,
    alarmOn: value.alarmOn,
    snooze: value.snooze,
    offsetMinutes: value.offsetMinutes,
    hidden: value.hidden,
  }),
};
