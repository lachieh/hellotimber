// The SIM phone book in the phone's EEPROM (plan 19 D3, D4): the `phone-book` record holds each
// SIM's locations once the phone first writes them (until then the host's initial entries are the
// SIM's contents), and the phone memory kept per SIM identity: speed dials (key → location) and
// the tones assigned to locations. Restore factory settings keeps all of it (`speed/restore-*`),
// so the record has no `factory`.
import type { EepromRecord, StockEeprom } from "../firmware/eeprom";
import { sortEntries, type PhoneBookEntry } from "./entries";
import type { NormalisedSimCard, StockContact } from "./sim-card";

/** One SIM's locations (index 0 = location 1; null = free). */
interface SimLocations {
  readonly locations: readonly (StockContact | null)[];
}

export interface PhoneBookState {
  /** Each SIM's locations, by `StockSimCard.id`, once the phone has written them. */
  readonly sims: Readonly<Record<string, SimLocations>>;
  /** Each SIM's assigned speed dial keys (`"2"`…`"9"`) → location. */
  readonly speedDials: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /**
   * Each SIM's assigned ringing tones, location → tone: 0 = No tone, k = Tones › Ringing tone's
   * entry k (1 = Ring ring). Absent = Default.
   */
  readonly tones: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

/** Speed dial keys (`Key 2:` … `Key 9:`). */
export const SPEED_DIAL_KEYS: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeContact(value: unknown): StockContact | null {
  if (!isObject(value) || typeof value.name !== "string" || typeof value.number !== "string") {
    return null;
  }
  return { name: value.name, number: value.number };
}

/** `{ <id>: { <key>: <positive integer> } }`, keys matching `key`, the rest dropped. */
function decodeTable(
  value: unknown,
  key: RegExp,
  valid: (n: number) => boolean,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  if (!isObject(value)) return out;
  for (const [sim, table] of Object.entries(value)) {
    if (!isObject(table)) continue;
    const kept: Record<string, number> = {};
    for (const [k, v] of Object.entries(table)) {
      if (key.test(k) && typeof v === "number" && Number.isInteger(v) && valid(v)) kept[k] = v;
    }
    out[sim] = kept;
  }
  return out;
}

/** The `phone-book` record (plan 15 D2). */
export const PHONE_BOOK_RECORD: EepromRecord<PhoneBookState> = {
  name: "phone-book",
  version: 1,
  initial: () => ({ sims: {}, speedDials: {}, tones: {} }),
  decode(data) {
    if (!isObject(data) || !isObject(data.sims)) throw new Error("sims must be an object.");
    const sims: Record<string, SimLocations> = {};
    for (const [sim, value] of Object.entries(data.sims)) {
      // A malformed SIM or contact is dropped, the rest kept (D2: stale content in a good shape).
      if (!isObject(value) || !Array.isArray(value.locations)) continue;
      sims[sim] = { locations: value.locations.map(decodeContact) };
    }
    return {
      sims,
      speedDials: decodeTable(data.speedDials, /^[2-9]$/, (n) => n >= 1),
      tones: decodeTable(data.tones, /^[1-9][0-9]*$/, (n) => n >= 0),
    };
  },
  encode: (value) => ({ sims: value.sims, speedDials: value.speedDials, tones: value.tones }),
};

/** The inserted SIM's phone book, its service numbers and the phone memory kept for it. */
export class StockPhoneBook {
  readonly #eeprom: StockEeprom;
  readonly #sim: NormalisedSimCard;

  constructor(eeprom: StockEeprom, sim: NormalisedSimCard) {
    this.#eeprom = eeprom;
    this.#sim = sim;
  }

  /** The SIM's identity. */
  get simId(): string {
    return this.#sim.id;
  }

  /** The SIM's name length (`Name:`'s counter). */
  get nameLength(): number {
    return this.#sim.nameLength;
  }

  #state(): PhoneBookState {
    return this.#eeprom.read(PHONE_BOOK_RECORD);
  }

  #locations(): readonly (StockContact | null)[] {
    return this.#state().sims[this.#sim.id]?.locations ?? this.#sim.entries;
  }

  #write(change: {
    locations?: readonly (StockContact | null)[];
    speedDials?: Readonly<Record<string, number>>;
    tones?: Readonly<Record<string, number>>;
  }): void {
    const state = this.#state();
    const id = this.#sim.id;
    this.#eeprom.write(PHONE_BOOK_RECORD, {
      sims: { ...state.sims, [id]: { locations: change.locations ?? this.#locations() } },
      speedDials: { ...state.speedDials, [id]: change.speedDials ?? this.#speedDials() },
      tones: { ...state.tones, [id]: change.tones ?? this.#tones() },
    });
  }

  #speedDials(): Readonly<Record<string, number>> {
    return this.#state().speedDials[this.#sim.id] ?? {};
  }

  #tones(): Readonly<Record<string, number>> {
    return this.#state().tones[this.#sim.id] ?? {};
  }

  #location(location: number): void {
    if (!Number.isInteger(location) || location < 1 || location > this.#locations().length) {
      throw new Error(`No SIM location ${location} (1-${this.#locations().length}).`);
    }
  }

  /** The SIM's names in the firmware's order. */
  entries(): readonly PhoneBookEntry[] {
    return sortEntries(
      this.#locations().flatMap((contact, i) =>
        contact === null ? [] : [{ ...contact, location: i + 1 }],
      ),
    );
  }

  /** The entry at `location`, or undefined when it is free. */
  at(location: number): PhoneBookEntry | undefined {
    const contact = this.#locations()[location - 1];
    return contact === null || contact === undefined ? undefined : { ...contact, location };
  }

  free(): number {
    return this.#locations().filter((contact) => contact === null).length;
  }

  used(): number {
    return this.#locations().length - this.free();
  }

  /** Stores `contact` at the first free location, or `full`. */
  add(contact: StockContact): PhoneBookEntry | "full" {
    const locations = [...this.#locations()];
    const index = locations.indexOf(null);
    if (index < 0) return "full";
    locations[index] = { name: contact.name, number: contact.number };
    this.#write({ locations });
    return { name: contact.name, number: contact.number, location: index + 1 };
  }

  /** Overwrites `location` (its speed dial and tone follow it). */
  replace(location: number, contact: StockContact): PhoneBookEntry {
    this.#location(location);
    const locations = [...this.#locations()];
    locations[location - 1] = { name: contact.name, number: contact.number };
    this.#write({ locations });
    return { name: contact.name, number: contact.number, location };
  }

  /** Frees `location` and drops the speed dials assigned to it; its tone stays (Task 0 D). */
  erase(location: number): void {
    this.#location(location);
    const locations = [...this.#locations()];
    locations[location - 1] = null;
    const speedDials = Object.fromEntries(
      Object.entries(this.#speedDials()).filter(([, at]) => at !== location),
    );
    this.#write({ locations, speedDials });
  }

  /** Erase all: every location free, every speed dial dropped (tones stay, UNVERIFIED). */
  eraseAll(): void {
    this.#write({ locations: this.#locations().map(() => null), speedDials: {} });
  }

  serviceNumbers(): readonly StockContact[] {
    return this.#sim.serviceNumbers;
  }

  /** Key `key`'s entry: its assignment, else SIM location `key` (S13); undefined = `(empty)`. */
  speedDial(key: number): PhoneBookEntry | undefined {
    const assigned = this.#speedDials()[String(key)];
    return this.at(assigned ?? key);
  }

  isAssigned(key: number): boolean {
    return this.#speedDials()[String(key)] !== undefined;
  }

  assign(key: number, location: number): void {
    if (!SPEED_DIAL_KEYS.includes(key)) throw new Error(`No speed dial key ${key} (2-9).`);
    this.#location(location);
    this.#write({ speedDials: { ...this.#speedDials(), [String(key)]: location } });
  }

  unassign(key: number): void {
    const { [String(key)]: _gone, ...speedDials } = this.#speedDials();
    this.#write({ speedDials });
  }

  /** The tone assigned to `location`: 0 = No tone, k = ringing tone k; null = Default. */
  tone(location: number): number | null {
    return this.#tones()[String(location)] ?? null;
  }

  setTone(location: number, tone: number | null): void {
    this.#location(location);
    const { [String(location)]: _old, ...tones } = this.#tones();
    this.#write({ tones: tone === null ? tones : { ...tones, [String(location)]: tone } });
  }

  /** The first entry (in SIM order) whose number is `number` (plan 22: caller names). */
  byNumber(number: string): PhoneBookEntry | undefined {
    const index = this.#locations().findIndex((contact) => contact?.number === number);
    return index < 0 ? undefined : this.at(index + 1);
  }
}
