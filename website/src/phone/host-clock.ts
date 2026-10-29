import type { StockTimestamp } from "@hellotimber/nokia-os";
const formatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Brisbane",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
export function hostTimestamp(date = new Date()): StockTimestamp {
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}
const pad = (n: number) => String(n).padStart(2, "0");
export function hostClock(date = new Date()): string {
  const time = hostTimestamp(date);
  return `${pad(time.hour)}:${pad(time.minute)}`;
}
export function hostDate(date = new Date()): string {
  const time = hostTimestamp(date);
  return `${pad(time.day)}.${pad(time.month)}.${String(time.year).padStart(4, "0")}`;
}
