// A phone's T9 (plan 18b D5, D7): the host's dictionaries and the user words in their EEPROM
// record, as feature bindings see them (`StockServices.t9`).
import type { StockEeprom } from "../../firmware/eeprom";
import type { T9Dictionary } from "./dictionary";
import { addUserWord, T9_USER_RECORD } from "./user";

export interface StockT9 {
  /** The host's English dictionary (`StockPhoneConfig.t9.english`); none: T9 is unavailable. */
  readonly english: T9Dictionary | undefined;
  /** The user words, oldest first. */
  userWords(): readonly string[];
  /** Stores a user word (Insert word, Spell), at once (D7). */
  learn(word: string): void;
}

export function stockT9(eeprom: StockEeprom, english?: T9Dictionary): StockT9 {
  return {
    english,
    userWords: () => eeprom.read(T9_USER_RECORD).words,
    learn(word) {
      eeprom.write(T9_USER_RECORD, addUserWord(eeprom.read(T9_USER_RECORD), word));
    },
  };
}
