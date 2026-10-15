// Templates (2-5) and Smileys (2-6), plan 18c D3 as Task 0 measured it: eight slots each. The
// virgin EEPROM has no list (Menu 2 5 and 2 6 open nothing, `content/restore-virgin`); Restore
// factory settings provisions it (`content/restore-templates`). Slots 1-5 show the firmware's
// defaults, 6-8 `(empty)`. A slot stores what the user saved, or nothing: Erase brings a default
// slot's default back (`content/templates-edited`, `erase-default-read`) and empties the others
// (`content/templates-filled`), and Restore puts every slot back (`content/restore-edited-*`).
//
// The defaults are what the factory image's Read and editor show (`content/templates-read`,
// `content/templates-edit`: the counters give each text's length, trailing spaces included).
import type { EepromRecord, StockEeprom } from "../firmware/eeprom";

/** Slots per list (`content/templates-list`: eight, ▼ wraps after the eighth). */
export const TEXT_SLOTS = 8;

/** The template defaults (`content/templates-read`, `-edit`: 58, 46, 46, 27, 40 left of 70). */
export const STOCK_TEMPLATES: readonly string[] = [
  "Please call ",
  "I'm at home. Please call",
  "I'm at work. Please call",
  "I can't answer right now, call me later at ",
  "I am late. I will be there at ",
];

/** The smiley defaults (`content/smileys-read`, `-edit`). */
export const STOCK_SMILEYS: readonly string[] = [":-)", ":-(", ":-/", ";o)", ";oD"];

/** The most characters a slot holds (`content/templates-edit` 06: 70; `-limit`). */
export const TEXT_SLOT_LIMITS = { templates: 70, smileys: 7 } as const;

export type TextSlotsKind = keyof typeof TEXT_SLOT_LIMITS;

/** A list's slots: the user's text, or null (the slot's default); null slots = virgin, no list. */
export interface TextSlotsState {
  readonly slots: readonly (string | null)[] | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textSlotsRecord(name: TextSlotsKind): EepromRecord<TextSlotsState> {
  return {
    name,
    version: 1,
    initial: () => ({ slots: null }),
    decode(data) {
      if (!isObject(data)) throw new Error("not an object.");
      const { slots } = data;
      if (slots === null) return { slots: null };
      if (!Array.isArray(slots) || slots.length !== TEXT_SLOTS) {
        throw new Error(`slots must be null or a list of ${TEXT_SLOTS}.`);
      }
      if (!slots.every((slot) => slot === null || typeof slot === "string")) {
        throw new Error("a slot must be a text or null.");
      }
      return { slots: slots as (string | null)[] };
    },
    encode: (value) => ({ slots: value.slots }),
    // Restore provisions the list with every slot on its default (D3, Task 0 F).
    factory: () => ({ slots: Array.from({ length: TEXT_SLOTS }, () => null) }),
  };
}

export const TEMPLATES_RECORD: EepromRecord<TextSlotsState> = textSlotsRecord("templates");
export const SMILEYS_RECORD: EepromRecord<TextSlotsState> = textSlotsRecord("smileys");

const RECORDS: Readonly<Record<TextSlotsKind, EepromRecord<TextSlotsState>>> = {
  templates: TEMPLATES_RECORD,
  smileys: SMILEYS_RECORD,
};

const DEFAULTS: Readonly<Record<TextSlotsKind, readonly string[]>> = {
  templates: STOCK_TEMPLATES,
  smileys: STOCK_SMILEYS,
};

/** One list (templates or smileys) in the phone's EEPROM. */
export class StockTextSlots {
  readonly kind: TextSlotsKind;
  readonly #eeprom: StockEeprom;

  constructor(eeprom: StockEeprom, kind: TextSlotsKind) {
    this.#eeprom = eeprom;
    this.kind = kind;
  }

  #slots(): readonly (string | null)[] | null {
    return this.#eeprom.read(RECORDS[this.kind]).slots;
  }

  /** Whether the list exists (Restore wrote it); the virgin EEPROM has none. */
  get provisioned(): boolean {
    return this.#slots() !== null;
  }

  /** The most characters a slot holds. */
  get limit(): number {
    return TEXT_SLOT_LIMITS[this.kind];
  }

  /** Each slot's text, null for `(empty)`; [] while unprovisioned. */
  list(): readonly (string | null)[] {
    const slots = this.#slots();
    if (slots === null) return [];
    return slots.map((slot, i) => slot ?? DEFAULTS[this.kind][i] ?? null);
  }

  /** Slot `index`'s text, null for `(empty)`. */
  text(index: number): string | null {
    return this.list()[index] ?? null;
  }

  #write(index: number, value: string | null): void {
    const slots = this.#slots();
    if (slots === null) throw new Error(`The ${this.kind} list is not provisioned.`);
    if (!Number.isInteger(index) || index < 0 || index >= TEXT_SLOTS) {
      throw new RangeError(`No ${this.kind} slot ${index}.`);
    }
    const next = [...slots];
    next[index] = value;
    this.#eeprom.write(RECORDS[this.kind], { slots: next });
  }

  /** Options › Save in the slot's editor (a non-empty text within the limit). */
  save(index: number, text: string): void {
    if (text === "" || Array.from(text).length > this.limit) {
      throw new RangeError(`A ${this.kind} slot holds 1-${this.limit} characters.`);
    }
    this.#write(index, text);
  }

  /** Options › Erase: the slot's default again (`(empty)` for slots 6-8). */
  erase(index: number): void {
    this.#write(index, null);
  }
}
