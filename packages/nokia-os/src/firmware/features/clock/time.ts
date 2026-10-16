// Phone time (plan 21 D1): a calendar minute, parsed from the host's `clock`/`date` strings, moved
// by minutes, ordered and formatted as the stock pages show it. Pure.

/** A calendar minute (no seconds: the phone's clock and its alarms work in minutes). */
export interface PhoneTime {
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

const CLOCK = /^(\d{2}):(\d{2})$/;
const DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in `month` (1-12) of `year`. */
export function daysInMonth(month: number, year: number): number {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

/** Whether day/month/year is a calendar date. */
export function isDate(day: number, month: number, year: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(month, year);
}

/**
 * The host's `HH:MM` (24-hour) and `DD.MM.YYYY` as a phone time; undefined when either is absent
 * or not exactly that form of a real time and date (D1: "no time", never an exception).
 */
export function parseHostTime(
  clock: string | undefined,
  date: string | undefined,
): PhoneTime | undefined {
  const c = typeof clock === "string" ? CLOCK.exec(clock) : null;
  const d = typeof date === "string" ? DATE.exec(date) : null;
  if (c === null || d === null) return undefined;
  const [hour, minute] = [Number(c[1]), Number(c[2])];
  const [day, month, year] = [Number(d[1]), Number(d[2]), Number(d[3])];
  if (hour > 23 || minute > 59 || !isDate(day, month, year)) return undefined;
  return { year, month, day, hour, minute };
}

/** Days from 1.1.2000 to the start of `year`, for years from 2000 on (negative before). */
function daysBeforeYear(year: number): number {
  const y = year - 1;
  const leaps = (n: number): number =>
    Math.floor(n / 4) - Math.floor(n / 100) + Math.floor(n / 400);
  return (year - 2000) * 365 + leaps(y) - leaps(1999);
}

/** Minutes since 1.1.2000 00:00 (negative before): orders phone times. */
export function minuteIndex(time: PhoneTime): number {
  let days = daysBeforeYear(time.year);
  for (let m = 1; m < time.month; m++) days += daysInMonth(m, time.year);
  days += time.day - 1;
  return days * 1440 + time.hour * 60 + time.minute;
}

/** The phone time `index` minutes after 1.1.2000 00:00 (minuteIndex's inverse). */
export function fromMinuteIndex(index: number): PhoneTime {
  let days = Math.floor(index / 1440);
  const inDay = index - days * 1440;
  let year = 2000 + Math.floor(days / 365.2425);
  while (daysBeforeYear(year) > days) year--;
  while (daysBeforeYear(year + 1) <= days) year++;
  days -= daysBeforeYear(year);
  let month = 1;
  while (days >= daysInMonth(month, year)) days -= daysInMonth(month++, year);
  return { year, month, day: days + 1, hour: Math.floor(inDay / 60), minute: inDay % 60 };
}

export function addMinutes(time: PhoneTime, minutes: number): PhoneTime {
  return fromMinuteIndex(minuteIndex(time) + minutes);
}

const two = (n: number): string => String(n).padStart(2, "0");

/**
 * The clock as the Clock settings page shows it: `09:41`, or under the 12-hour Time format
 * `09:41 am` / `01:07 pm` / `12:05 am` (settings/format/*-page). Standby draws the 12-hour form's
 * `am`/`pm` as a marker (display/standby.ts).
 */
export function formatClock(time: PhoneTime, twelveHour: boolean): string {
  if (!twelveHour) return `${two(time.hour)}:${two(time.minute)}`;
  const hour = time.hour % 12 === 0 ? 12 : time.hour % 12;
  return `${two(hour)}:${two(time.minute)} ${time.hour < 12 ? "am" : "pm"}`;
}

/** `13.10.2026`. */
export function formatDate(time: PhoneTime): string {
  return `${two(time.day)}.${two(time.month)}.${time.year}`;
}
