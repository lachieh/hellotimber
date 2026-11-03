// SMS stored on the SIM card (plan 30 D2, Task 0 M): the GSM 7-bit alphabet a SIM message is
// written in, how the 3310 draws it, and the validation of `StockSimCard.messages`. Pure.
import { missingStockGlyphs } from "../kit/ui/resources";
import { smsDrawn } from "../kit/ui/text/sms";
import { TIMESTAMP_RANGES } from "../services/messaging/network";
import {
  SIM_MESSAGE_SLOTS,
  type SimMessage,
  type SimMessages,
  type StockSimMessage,
} from "../services/sim/messages";

export { SIM_MESSAGE_SLOTS, type SimMessage, type SimMessages, type StockSimMessage };

/** One SMS: 160 septets of the GSM 7-bit alphabet (GSM 03.38). */
export const SMS_SEPTETS = 160;

/** GSM 03.38's default alphabet (one septet each), less the escape (0x1B) and CR/LF. */
const GSM_BASIC = new Set(
  Array.from(
    "@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ),
);

/** Its extension table (escape + one septet: two each); the form feed is not text. */
const GSM_EXTENSION = new Set(Array.from("^{}\\[~]|€"));

/** The septets `text` takes in the GSM 7-bit alphabet; undefined when a character is not in it. */
export function gsmSeptets(text: string): number | undefined {
  let septets = 0;
  for (const char of Array.from(text)) {
    if (GSM_BASIC.has(char)) septets += 1;
    else if (GSM_EXTENSION.has(char)) septets += 2;
    else return undefined;
  }
  return septets;
}

const NUMBER = /^\+?[0-9]{1,20}$/;
const CENTRE = /^(\+?[0-9]{1,20})?$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const quoted = (chars: readonly string[]) => chars.map((ch) => JSON.stringify(ch)).join(", ");

/** Why `stamp` is not a time stamp in plan 18's ranges (field path `where`), or undefined. */
function stampProblem(stamp: unknown, where: string): string | undefined {
  if (!isObject(stamp)) return `${where} must be a time stamp`;
  for (const [field, [min, max]] of Object.entries(TIMESTAMP_RANGES)) {
    const n = stamp[field];
    if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) {
      return `${where}.${field} must be an integer ${min}-${max} (received ${JSON.stringify(n)})`;
    }
  }
  return undefined;
}

/** Why `message` cannot be a SIM message (fields named under `where`), or undefined. */
function messageProblem(message: unknown, where: string): string | undefined {
  if (!isObject(message)) return `${where} must be a message or null`;
  const { number, text, read, centre } = message;
  if (typeof number !== "string" || !NUMBER.test(number)) {
    return `${where}.number ${JSON.stringify(number)} must be 1-20 digits after an optional +`;
  }
  if (typeof text !== "string") return `${where}.text must be a string`;
  const septets = gsmSeptets(text);
  if (septets === undefined) {
    const outside = Array.from(new Set(Array.from(text))).filter(
      (ch) => gsmSeptets(ch) === undefined,
    );
    return `${where}.text has characters outside the GSM 7-bit alphabet: ${quoted(outside)}`;
  }
  if (septets > SMS_SEPTETS) {
    return `${where}.text takes ${septets} septets, more than one SMS's ${SMS_SEPTETS}`;
  }
  const missing = missingStockGlyphs(smsDrawn(text), "small");
  if (missing.length > 0) {
    return `${where}.text has characters the stock small font lacks: ${quoted(missing)}`;
  }
  const stamp = stampProblem(message.sentAt, `${where}.sentAt`);
  if (stamp !== undefined) return stamp;
  if (read !== undefined && typeof read !== "boolean") return `${where}.read must be a boolean`;
  if (centre !== undefined && (typeof centre !== "string" || !CENTRE.test(centre))) {
    return `${where}.centre ${JSON.stringify(centre)} must be 1-20 digits after an optional +, or ""`;
  }
  return undefined;
}

/**
 * `StockSimCard.messages` validated and with its defaults filled in; throws naming the field path
 * under `where` (`SIM card "sim-1": messages.entries[2].text …`).
 */
export function normaliseSimMessages(messages: unknown, where: string): SimMessages {
  if (messages === undefined) return { slots: SIM_MESSAGE_SLOTS, entries: [] };
  if (!isObject(messages)) throw new Error(`${where}: messages must be an object.`);
  const given = messages.slots ?? SIM_MESSAGE_SLOTS;
  if (typeof given !== "number" || !Number.isInteger(given) || given < 1) {
    throw new Error(
      `${where}: messages.slots must be a positive integer (received ${JSON.stringify(given)}).`,
    );
  }
  const slots = given;
  const list = messages.entries ?? [];
  if (!Array.isArray(list)) throw new Error(`${where}: messages.entries must be an array.`);
  if (list.length > slots) {
    throw new Error(`${where}: messages.entries has ${list.length} entries for ${slots} slots.`);
  }
  const entries = list.map((message: unknown, i): SimMessage | null => {
    if (message === null) return null;
    const problem = messageProblem(message, `messages.entries[${i}]`);
    if (problem !== undefined) throw new Error(`${where}: ${problem}.`);
    const m = message as unknown as StockSimMessage;
    const { year, month, day, hour, minute, second } = m.sentAt;
    return {
      number: m.number,
      text: m.text,
      sentAt: { year, month, day, hour, minute, second },
      read: m.read ?? true,
      centre: m.centre ?? "",
    };
  });
  return { slots, entries };
}

/** Why `messages` is not a valid `StockSimCard.messages`, or undefined (plan 30's internal API). */
export function simMessagesProblem(messages: unknown, where: string): string | undefined {
  try {
    normaliseSimMessages(messages, where);
    return undefined;
  } catch (error) {
    return (error as Error).message;
  }
}
