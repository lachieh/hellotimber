// The host's identity and preload (plan 30 D9, D10): the phone's IMEI for `*#06#`, and phone
// memory a user could have typed (the Welcome note, Reminders, Snake II's level), written once
// where it was never written in storage, so a visitor's own edits and erasures survive. Validated when the
// phone is created: an invalid value throws, naming the field.
import { missingStockGlyphs, type StockFontName } from "../kit/ui/resources";
import { TYPEABLE } from "../kit/ui/text/keys";
import { parseHostTime } from "../kit/system/clock/time";
import {
  REMINDER_TEXT_LIMIT,
  REMINDERS_CAPACITY,
  REMINDERS_RECORD,
  StockReminders,
} from "./features/reminders/store";
import { WELCOME_NOTE_KEY } from "../kit/system/boot";
import { WELCOME_NOTE_LIMIT } from "./features/settings";
import { SNAKE_SETTINGS } from "../widgets/snake";
import { STOCK_STORAGE_PREFIX, type StockEeprom, type StockStorage } from "./eeprom";
import type { Firmware } from "./firmware";
import { settingsRecordKeys, settingsRecordOf, type StockSettings } from "./settings";

/** Plan 30: a reminder as the user could have typed it (D10). */
export interface StockReminderPreload {
  readonly text: string;
  /** Optional alarm, phone time ("DD.MM.YYYY", "HH:MM"). */
  readonly alarm?: { readonly date: string; readonly time: string };
}

/** Plan 30: phone-memory content written once, only where its record does not exist (D10). */
export interface StockPreload {
  readonly welcomeNote?: string;
  readonly reminders?: readonly StockReminderPreload[];
  /**
   * Snake II's level as the Level page stores it (1-9), written while the level was never
   * written. The virgin EEPROM's 175 moves the snake every timer unit (≈7.7 ms, snake-ii.md).
   */
  readonly snakeLevel?: number;
}

/** An IMEI's digits (GSM 03.03: TAC, serial number and the Luhn check digit). */
const IMEI = /^[0-9]{15}$/;

/** Whether `digits` pass the Luhn check (every second digit from the right doubled). */
function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** `imei` checked (D9): 15 digits with a valid Luhn check digit; throws otherwise. */
export function checkImei(imei: unknown): string {
  if (typeof imei !== "string" || !IMEI.test(imei)) {
    throw new Error(`imei must be 15 digits (received ${JSON.stringify(imei)}).`);
  }
  if (!luhn(imei)) throw new Error(`imei ${imei} fails its Luhn check digit.`);
  return imei;
}

/**
 * `*#06#`'s digit lines (Task 0 I: `Serial No.` over `4901542033` / `10018`): the first ten
 * digits, then the last five. Throws for an invalid IMEI.
 */
export function stockImeiLines(imei: string): readonly [string, string] {
  const digits = checkImei(imei);
  return [digits.slice(0, 10), digits.slice(10)];
}

const quoted = (chars: readonly string[]) => chars.map((ch) => JSON.stringify(ch)).join(", ");

/** Why `text` cannot have been typed into an editor of `limit` drawn in `faces`, or undefined. */
function typedProblem(
  text: unknown,
  limit: number,
  faces: readonly StockFontName[],
): string | undefined {
  if (typeof text !== "string" || text === "") return "must be a non-empty string";
  const chars = Array.from(text);
  if (chars.length > limit) return `has ${chars.length} characters, more than its ${limit}`;
  const untypeable = [...new Set(chars.filter((ch) => !TYPEABLE.has(ch)))];
  if (untypeable.length > 0) return `has characters no key types: ${quoted(untypeable)}`;
  for (const face of faces) {
    const missing = missingStockGlyphs(text, face);
    if (missing.length > 0)
      return `has characters the stock ${face} font lacks: ${quoted(missing)}`;
  }
  return undefined;
}

/** `preload` checked (D10); throws naming the field. */
export function checkPreload(preload: unknown): StockPreload {
  if (preload === undefined) return {};
  if (typeof preload !== "object" || preload === null)
    throw new Error("preload must be an object.");
  const { welcomeNote, reminders, snakeLevel } = preload as Record<string, unknown>;
  if (
    snakeLevel !== undefined &&
    !(Number.isInteger(snakeLevel) && (snakeLevel as number) >= 1 && (snakeLevel as number) <= 9)
  ) {
    throw new Error(
      `preload.snakeLevel must be a whole number from 1 to 9 (received ${JSON.stringify(snakeLevel)}).`,
    );
  }
  if (welcomeNote !== undefined) {
    const problem = typedProblem(welcomeNote, WELCOME_NOTE_LIMIT, ["large", "small"]);
    if (problem !== undefined) throw new Error(`preload.welcomeNote ${problem}.`);
  }
  if (reminders !== undefined) {
    if (!Array.isArray(reminders)) throw new Error("preload.reminders must be an array.");
    if (reminders.length > REMINDERS_CAPACITY) {
      throw new Error(
        `preload.reminders has ${reminders.length} reminders, more than the phone's ${REMINDERS_CAPACITY}.`,
      );
    }
    reminders.forEach((reminder: unknown, i) => {
      const where = `preload.reminders[${i}]`;
      if (typeof reminder !== "object" || reminder === null) {
        throw new Error(`${where} must be a reminder.`);
      }
      const { text, alarm } = reminder as Record<string, unknown>;
      const problem = typedProblem(text, REMINDER_TEXT_LIMIT, ["small", "large"]);
      if (problem !== undefined) throw new Error(`${where}.text ${problem}.`);
      if (alarm !== undefined) {
        const { date, time } = (alarm ?? {}) as Record<string, unknown>;
        if (parseHostTime(time as string, date as string) === undefined) {
          throw new Error(
            `${where}.alarm must be a real date "DD.MM.YYYY" and time "HH:MM" (received ${JSON.stringify(alarm)}).`,
          );
        }
      }
    });
  }
  return preload as StockPreload;
}

/** Whether storage holds `record`'s key (a record the phone wrote, however empty). */
function stored(storage: StockStorage, record: { readonly name: string }): boolean {
  return storage.getItem(`${STOCK_STORAGE_PREFIX}${record.name}`) !== null;
}

/**
 * Writes `preload` where its record does not exist in `storage` (D10): the Welcome note while
 * there is no settings record, the reminders (in order, as `Add` would) while there is no
 * reminders record, Snake II's level while the settings record holds none. Call before the phone
 * writes anything. `eeprom` and `settings` are a phone's running `firmware`: the Welcome note and
 * the reminders are its handset's; a firmware without Snake II's level setting takes no level.
 */
export function applyPreload(
  preload: StockPreload,
  storage: StockStorage,
  eeprom: StockEeprom,
  settings: StockSettings,
  firmware: Firmware,
): void {
  const { welcomeNote, reminders, snakeLevel } = preload;
  const settingsRecord = settingsRecordOf(firmware);
  if (welcomeNote !== undefined && !stored(storage, settingsRecord)) {
    settings.setText(WELCOME_NOTE_KEY, welcomeNote);
  }
  if (
    snakeLevel !== undefined &&
    settingsRecordKeys(firmware).numbers.includes(SNAKE_SETTINGS.level) &&
    !(SNAKE_SETTINGS.level in eeprom.peek(settingsRecord).numbers)
  ) {
    settings.setNumber(SNAKE_SETTINGS.level, snakeLevel);
  }
  if (reminders !== undefined && reminders.length > 0 && !stored(storage, REMINDERS_RECORD)) {
    const store = new StockReminders(eeprom);
    for (const { text, alarm } of reminders) {
      store.add(text, alarm === undefined ? null : parseHostTime(alarm.time, alarm.date)!);
    }
  }
}
