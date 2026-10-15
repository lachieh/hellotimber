// The Composer's saved tones (plan 27 D7, D8): seven slots in the phone's EEPROM, each a tone's
// name, tempo and notation, written at once by Save; Restore factory settings empties them
// (K13). The tempo a new tone starts at is RAM state (Task 0: the last set or saved since
// power-on, 112 after a cold boot), kept by this object for the phone's life.
import type { EepromRecord, StockEeprom } from "../firmware/eeprom";
import { COMPOSER_TEMPI } from "../resources";
import { COMPOSER_LIMIT, formatTokens, parseTokens } from "./notation";
import { userRingingTone, type ComposerTone, type UserRingingTone } from "./program";

export type { ComposerTone };

/** The Composer's slots (5-4-1 … 5-4-7). */
export const COMPOSER_SLOTS = 7;
/** The longest name (`Tone name:`'s counter, Task 0 N). */
export const COMPOSER_NAME_LIMIT = 15;
/** The tempo a new tone starts at after power-on (Task 0 M). */
export const COMPOSER_FIRST_TEMPO = 112;
/** Saved tones are these Ringing tone options, slot 1 first (entries 36-42, K12). */
export const COMPOSER_RINGING_INDEX = 35;

export interface ComposerData {
  /** Slot k at index k - 1; null: `(empty)`. */
  readonly slots: readonly (ComposerTone | null)[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A stored slot, or null when its content is stale (a bad name, tempo or token, plan 15 D2). */
function decodeSlot(value: unknown): ComposerTone | null {
  if (!isPlainObject(value)) return null;
  const { name, tempo, tokens } = value;
  if (
    typeof name !== "string" ||
    name.length < 1 ||
    Array.from(name).length > COMPOSER_NAME_LIMIT
  ) {
    return null;
  }
  if (typeof tempo !== "number" || !COMPOSER_TEMPI.includes(tempo)) return null;
  if (typeof tokens !== "string") return null;
  try {
    const parsed = parseTokens(tokens);
    if (parsed.length < 1 || parsed.length > COMPOSER_LIMIT) return null;
    return { name, tempo, tokens: parsed };
  } catch {
    return null;
  }
}

/** A tone as stored: its tokens as their notation (`4c1 4.#d2 8-`). */
function encodeSlot(tone: ComposerTone): { name: string; tempo: number; tokens: string } {
  return { name: tone.name, tempo: tone.tempo, tokens: formatTokens(tone.tokens) };
}

/** `nokia-os/composer`: seven empty slots in the virgin EEPROM and after Restore (K13). */
export const COMPOSER_RECORD: EepromRecord<ComposerData> = {
  name: "composer",
  version: 1,
  initial: () => ({ slots: Array<null>(COMPOSER_SLOTS).fill(null) }),
  decode(data) {
    if (!isPlainObject(data) || !Array.isArray(data.slots))
      throw new Error("slots must be a list.");
    if (data.slots.length !== COMPOSER_SLOTS) throw new Error(`slots must hold ${COMPOSER_SLOTS}.`);
    return { slots: data.slots.map(decodeSlot) };
  },
  encode: (value) => ({
    slots: value.slots.map((tone) => (tone === null ? null : encodeSlot(tone))),
  }),
  factory: () => ({ slots: Array<null>(COMPOSER_SLOTS).fill(null) }),
};

/** One phone's Composer: its saved tones over the EEPROM and the new tone's tempo. */
export class StockComposer {
  readonly #eeprom: StockEeprom;
  #newTempo = COMPOSER_FIRST_TEMPO;

  constructor(eeprom: StockEeprom) {
    this.#eeprom = eeprom;
  }

  /** Slot `k`'s tone (1-7), or null while it is `(empty)`. */
  slot(k: number): ComposerTone | null {
    return this.#eeprom.read(COMPOSER_RECORD).slots[this.#index(k)] ?? null;
  }

  /** Save: writes the tone to slot `k` at once (and it becomes the new tone's tempo, K13). */
  save(k: number, tone: ComposerTone): void {
    const index = this.#index(k);
    if (decodeSlot(encodeSlot(tone)) === null) {
      throw new Error(
        `Slot ${k}: not a tone (${tone.name}, ${tone.tempo} BPM, ${tone.tokens.length} tokens).`,
      );
    }
    const slots = [...this.#eeprom.read(COMPOSER_RECORD).slots];
    slots[index] = tone;
    this.#eeprom.write(COMPOSER_RECORD, { slots });
    this.#newTempo = tone.tempo;
  }

  /** The tempo a new tone starts at: the last set or saved since power-on (K13, Task 0 M). */
  newTempo(): number {
    return this.#newTempo;
  }

  /** Tempo set on any tone (saved or not) becomes the new tone's (Task 0 `newtempo/after-set`). */
  setNewTempo(tempo: number): void {
    if (!COMPOSER_TEMPI.includes(tempo)) throw new Error(`${tempo} BPM is not a Composer tempo.`);
    this.#newTempo = tempo;
  }

  /** A Ringing tone option's label (35-41: slots 1-7) when its slot holds a tone (D8). */
  ringingToneLabel(index: number): string | undefined {
    return this.#ringing(index)?.name;
  }

  /** A Ringing tone option's sound (35-41: slots 1-7) when its slot holds a tone (D8, D9). */
  userRingingTone(index: number): UserRingingTone | undefined {
    const tone = this.#ringing(index);
    return tone === undefined
      ? undefined
      : userRingingTone(tone, index - COMPOSER_RINGING_INDEX + 1);
  }

  #ringing(index: number): ComposerTone | undefined {
    const k = index - COMPOSER_RINGING_INDEX + 1;
    if (!Number.isInteger(k) || k < 1 || k > COMPOSER_SLOTS) return undefined;
    return this.slot(k) ?? undefined;
  }

  #index(k: number): number {
    if (!Number.isInteger(k) || k < 1 || k > COMPOSER_SLOTS)
      throw new Error(`No Composer slot ${k}.`);
    return k - 1;
  }
}
