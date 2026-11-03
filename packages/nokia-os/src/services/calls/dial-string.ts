// What the stock phone does with a typed dial string (plan 22 D6; docs/specs/stock/calls.md):
// the dial characters and the `*` cycle, the 60-character entry, the codes answered at `#`, what
// Call does and the number actually dialled. Pure.

/** The entry keeps the newest 60 characters (`entry/limit`: a 61st drops the oldest). */
export const DIAL_LIMIT = 60;

/** `*`'s dial characters in press order (`entry/star`: `*` `+` `p` `w`, then `*` again). */
export const DIAL_CYCLE: readonly string[] = ["*", "+", "p", "w"];

/** Call on this many characters or more shows `Invalid phone number` (`dial/number-thirty-three`). */
export const DIAL_TOO_LONG = 33;

/** The numbers Call places as emergency calls (`dial/number-112`; `911` dials as a number). */
export const EMERGENCY_NUMBERS: readonly string[] = ["112"];

export type DialOutcome =
  /** The number sent: the string cut at a later `+` or at its first `p`/`w`. */
  | { readonly kind: "call"; readonly number: string }
  | { readonly kind: "emergency"; readonly number: string }
  /** `1` alone: the voice mailbox (`dial/number-one-1`). */
  | { readonly kind: "voice-mailbox" }
  /** One digit 2-9: its speed dial (`Speed dial number not saved` when none is). */
  | { readonly kind: "speed-dial"; readonly key: number }
  /** A supplementary service or USSD string (plan 22b: `Requesting`). */
  | { readonly kind: "service"; readonly text: string }
  /** 33 characters or more. */
  | { readonly kind: "invalid" };

/** The character after `previous` in the `*` cycle (`undefined`: a new `*`). */
export function starCycle(previous: string | undefined): string {
  const i = previous === undefined ? -1 : DIAL_CYCLE.indexOf(previous);
  return DIAL_CYCLE[(i + 1) % DIAL_CYCLE.length]!;
}

/** `text` with `chars` appended, keeping the newest DIAL_LIMIT characters. */
export function appendDial(text: string, chars: string): string {
  const joined = text + chars;
  return joined.length > DIAL_LIMIT ? joined.slice(joined.length - DIAL_LIMIT) : joined;
}

/** The number a call sends: a `+` only leads it; a later `+`, `p` or `w` ends it. */
export function dialledNumber(entry: string): string {
  const body = entry.startsWith("+") ? entry.slice(1) : entry;
  const end = body.search(/[+pw]/);
  const cut = end < 0 ? body : body.slice(0, end);
  return entry.startsWith("+") ? `+${cut}` : cut;
}

/** What Call does with the typed string (S9, Task 0 D). */
export function dialOutcome(entry: string): DialOutcome {
  if (entry.length >= DIAL_TOO_LONG) return { kind: "invalid" };
  if (EMERGENCY_NUMBERS.includes(entry)) return { kind: "emergency", number: entry };
  if (entry === "1") return { kind: "voice-mailbox" };
  if (/^[2-9]$/.test(entry)) return { kind: "speed-dial", key: Number(entry) };
  // Service codes: `0`, `*`, `#` alone, two digits not starting with 1 (`04`), and strings that
  // start with `*` or `#` and end with `#` (`*123#`, `##002#`).
  if (entry.length === 1 || /^[02-9][0-9]$/.test(entry) || /^[*#].*#$/.test(entry)) {
    return { kind: "service", text: entry };
  }
  return { kind: "call", number: dialledNumber(entry) };
}

/** What `#` typed at the end of `entry` (the `#` included) does at once, if anything (S8). */
export type ImmediateCode =
  | { readonly kind: "imei" }
  | { readonly kind: "version" }
  /** Digits then `#`: SIM location `location`. */
  | { readonly kind: "recall"; readonly location: number };

export function immediateCode(entry: string): ImmediateCode | undefined {
  if (entry === "*#06#") return { kind: "imei" };
  if (entry === "*#0000#") return { kind: "version" };
  const recall = /^([0-9]+)#$/.exec(entry);
  if (recall !== null) return { kind: "recall", location: Number(recall[1]) };
  return undefined;
}
