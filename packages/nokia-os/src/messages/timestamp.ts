// How a message's service-centre time stamp reads on its `Sent:` page and on Details › Time
// (plan 18 D13): the date as `13-Oct-2026`, the time as `10:11:20`, 24-hour whatever the phone's
// Time format (`sms/time-format` view-2: `14:11:17` with 12-hour chosen).
import type { StockTimestamp } from "./network";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const two = (n: number): string => String(n).padStart(2, "0");

/**
 * `13-Oct-2026` (`sms/inbox-view-1` down-02). A one-digit day is padded like the time's fields
 * (UNVERIFIED: every captured day is 13).
 */
export function messageDate(stamp: StockTimestamp): string {
  return `${two(stamp.day)}-${MONTHS[stamp.month - 1]}-${stamp.year}`;
}

/** `10:11:20`: hours, minutes and seconds, 24-hour. */
export function messageTime(stamp: StockTimestamp): string {
  return `${two(stamp.hour)}:${two(stamp.minute)}:${two(stamp.second)}`;
}
