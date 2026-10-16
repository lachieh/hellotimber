// The inserted SIM card (plan 19 D2): host config, and the contacts seam. A string is the emulator
// SIM under that identity; a `StockSimCard` adds its phone book and service numbers. Validated
// once, when the phone is created. Plan 30 adds the SIM's messages (`EF_SMS`) and toolkit menu.
import { missingStockGlyphs } from "../resources";
import { normaliseSimMessages, type SimMessages, type StockSimMessage } from "../sim/messages";
import { normaliseToolkit, type StockSimToolkit } from "../sim/toolkit";

/** Plan 19: one SIM phone book entry or service number. */
export interface StockContact {
  /** Within the SIM's name length; every glyph in the small and large faces; "" = no name. */
  readonly name: string;
  /** 0-20 of `0-9 * # p` after an optional `+` (a SIM cannot hold `w`); "" = no number. */
  readonly number: string;
}

/** Plan 19: the inserted SIM card. Plan 15's string `sim` is `{ id }` with these defaults. */
export interface StockSimCard {
  /** Identity (plan 15: Phone security's recent SIMs; plan 18: messages). Non-empty. */
  readonly id: string;
  readonly phoneBook?: {
    /** Default 50 (the emulator SIM). */
    readonly locations?: number;
    /** Default 16. */
    readonly nameLength?: number;
    /** Initial entries by location (index 0 = location 1); null = a free location. */
    readonly entries?: readonly (StockContact | null)[];
  };
  /** The SIM's service numbers (Service Nos.), in SIM order. Default none. */
  readonly serviceNumbers?: readonly StockContact[];
  /**
   * Plan 30: `EF_SMS`. Default: 15 slots, none used. `entries` by slot (index 0 = slot 1); null =
   * a free slot.
   */
  readonly messages?: {
    readonly slots?: number;
    readonly entries?: readonly (StockSimMessage | null)[];
  };
  /** Plan 30: the SIM applet's menu (SIM services, Menu 14). Default: none. */
  readonly toolkit?: StockSimToolkit;
}

/** A validated SIM card with its defaults filled in. */
export interface NormalisedSimCard {
  readonly id: string;
  readonly locations: number;
  readonly nameLength: number;
  /** One per location (index 0 = location 1); null = free. */
  readonly entries: readonly (StockContact | null)[];
  readonly serviceNumbers: readonly StockContact[];
  /** Plan 30: its message slots and the received messages in them. */
  readonly messages: SimMessages;
  /** Plan 30: its toolkit menu, if it has one. */
  readonly toolkit?: StockSimToolkit;
}

/** The emulator SIM's `EF_ADN`: 50 records of 30 bytes, 16-character names (Task 0). */
export const SIM_LOCATIONS = 50;
export const SIM_NAME_LENGTH = 16;
/** `EF_ADN`'s 10 BCD bytes: `Phone number:` counts 20 (Task 0 A). */
export const SIM_NUMBER_DIGITS = 20;

/** GSM 03.38's extension table: each of these takes two bytes of a SIM name (`€`, Task 0 A). */
const GSM_EXTENSION = new Set(Array.from("€[]{}~^\\|"));

/** The bytes a name takes on the SIM (`Name:`'s counter counts them: `E€` leaves 13 of 16). */
export function simNameLength(name: string): number {
  return Array.from(name).reduce((n, char) => n + (GSM_EXTENSION.has(char) ? 2 : 1), 0);
}

/** The SIM's number characters: `w` is refused (`Invalid char. for SIM card`, Task 0 A). */
const NUMBER = new RegExp(`^\\+?[0-9*#p]{0,${SIM_NUMBER_DIGITS}}$`);

/** Why `number` cannot be stored on a SIM, or undefined. */
export function simNumberProblem(number: string): string | undefined {
  if (NUMBER.test(number)) return undefined;
  return `number ${JSON.stringify(number)} must be 0-${SIM_NUMBER_DIGITS} of 0-9 * # p after an optional +`;
}

/** Why `contact` cannot be stored on a SIM with names of `nameLength`, or undefined. */
export function simContactProblem(contact: StockContact, nameLength: number): string | undefined {
  if (typeof contact !== "object" || contact === null) return "must be a contact";
  const { name, number } = contact;
  if (typeof name !== "string" || typeof number !== "string") {
    return "needs a name and a number (strings)";
  }
  if (name === "" && number === "") return "has neither a name nor a number";
  if (simNameLength(name) > nameLength) {
    return `name ${JSON.stringify(name)} is longer than the SIM's ${nameLength} characters`;
  }
  for (const face of ["small", "large"] as const) {
    const missing = missingStockGlyphs(name, face);
    if (missing.length > 0) {
      return `name ${JSON.stringify(name)} has characters the stock ${face} font lacks: ${missing
        .map((ch) => JSON.stringify(ch))
        .join(", ")}`;
    }
  }
  return simNumberProblem(number);
}

function positiveInteger(value: unknown, field: string, where: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`${where}: ${field} must be a positive integer (received ${String(value)}).`);
  }
  return value as number;
}

/** The SIM card a phone is created with, validated; a string is the emulator SIM. */
export function normaliseSim(sim: string | StockSimCard): NormalisedSimCard {
  const card: StockSimCard = typeof sim === "string" ? { id: sim } : sim;
  if (typeof card !== "object" || card === null || typeof card.id !== "string" || card.id === "") {
    throw new Error(
      `The SIM must be a non-empty string or a StockSimCard with a non-empty id (received ${JSON.stringify(sim)}).`,
    );
  }
  const where = `SIM card "${card.id}"`;
  const book = card.phoneBook ?? {};
  const locations = positiveInteger(book.locations ?? SIM_LOCATIONS, "phoneBook.locations", where);
  const nameLength = positiveInteger(
    book.nameLength ?? SIM_NAME_LENGTH,
    "phoneBook.nameLength",
    where,
  );
  const initial = book.entries ?? [];
  if (!Array.isArray(initial)) throw new Error(`${where}: phoneBook.entries must be an array.`);
  if (initial.length > locations) {
    throw new Error(
      `${where}: phoneBook.entries has ${initial.length} entries for ${locations} locations.`,
    );
  }
  const entries = Array.from({ length: locations }, (_, i): StockContact | null => {
    const contact = initial[i] ?? null;
    if (contact === null) return null;
    const problem = simContactProblem(contact, nameLength);
    if (problem !== undefined) {
      throw new Error(`${where}: phoneBook.entries[${i}] (location ${i + 1}) ${problem}.`);
    }
    return { name: contact.name, number: contact.number };
  });
  const service = card.serviceNumbers ?? [];
  if (!Array.isArray(service)) throw new Error(`${where}: serviceNumbers must be an array.`);
  const serviceNumbers = service.map((contact, i): StockContact => {
    const problem = simContactProblem(contact, nameLength);
    if (problem !== undefined) throw new Error(`${where}: serviceNumbers[${i}] ${problem}.`);
    return { name: contact.name, number: contact.number };
  });
  const messages = normaliseSimMessages(card.messages, where);
  const toolkit = normaliseToolkit(card.toolkit, where);
  return {
    id: card.id,
    locations,
    nameLength,
    entries,
    serviceNumbers,
    messages,
    ...(toolkit === undefined ? {} : { toolkit }),
  };
}
