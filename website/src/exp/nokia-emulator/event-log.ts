import type { PhoneKey } from "@hellotimber/phone-core";

/** Where an event came from: a key, the phone's screen, the World controls, the network, the host. */
export type LogKind = "key" | "screen" | "world" | "net" | "system";

export interface LogEntry {
  /** Sequence number, for React keys. */
  readonly id: number;
  /** Milliseconds since the session started. */
  readonly at: number;
  readonly kind: LogKind;
  readonly text: string;
  /** Something went wrong or needs attention (drawn amber). */
  readonly warn?: boolean;
}

/** How many entries the log keeps; older ones drop off the top. */
export const LOG_LIMIT = 400;

export function appendLog(
  log: readonly LogEntry[],
  entry: Omit<LogEntry, "id">,
  limit = LOG_LIMIT,
): readonly LogEntry[] {
  const id = (log.at(-1)?.id ?? 0) + 1;
  const next = [...log, { id, ...entry }];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** "00:12.345": minutes, seconds and milliseconds since the session started. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

const KEY_NAMES: Partial<Record<PhoneKey, string>> = {
  navi: "NAVI",
  c: "C",
  up: "UP",
  down: "DOWN",
  power: "PWR",
};

/** A key's name in the log: NAVI, C, UP, DOWN, PWR, or the digit, * or #. */
export function keyName(key: PhoneKey): string {
  return KEY_NAMES[key] ?? key;
}

/** The text for a key going down, or coming up after `heldMs`. */
export function keyText(key: PhoneKey, action: "down" | "up", heldMs?: number): string {
  if (action === "down") return `${keyName(key)} down`;
  return heldMs === undefined
    ? `${keyName(key)} up`
    : `${keyName(key)} up after ${Math.round(heldMs)} ms`;
}

/** The log as plain text, one entry per line (Copy). */
export function logAsText(log: readonly LogEntry[]): string {
  return log
    .map((entry) => `${formatElapsed(entry.at)}  ${entry.kind.padEnd(6)}  ${entry.text}`)
    .join("\n");
}
