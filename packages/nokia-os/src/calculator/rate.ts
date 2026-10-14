// The exchange rate (plan 20 D6): the calculator's only stored state. One rate, typed in one
// direction (Foreign unit expressed in domestic units, or the reverse): the other direction's
// prompt shows its reciprocal, but conversions use the typed value (Task 0: Domestic 3 shows
// Foreign 0.3333333, yet 10 In domestic is 3.3333333). This is a reproduction storage design;
// the firmware's EEPROM representation is UNVERIFIED.
import type { EepromRecord, StockEeprom } from "../firmware/eeprom";
import { calculate, parseDecimal, type CalcResult } from "./decimal";

export type RateDirection = "foreign" | "domestic";

export interface CalculatorRateState {
  /** The prompt the rate was typed in: `foreign` (8-1) or `domestic` (8-2). */
  readonly direction: RateDirection;
  /** The rate as typed (a display string). */
  readonly rate: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `nokia-os/calculator`: virgin Foreign `0` (its Domestic prompt empty); Restore factory
 * settings writes Foreign `1`, both prompts `1`, whichever direction was stored (Task 0 K).
 */
export const CALCULATOR_RECORD: EepromRecord<CalculatorRateState> = {
  name: "calculator",
  version: 1,
  initial: () => ({ direction: "foreign", rate: "0" }),
  decode(data) {
    if (!isPlainObject(data)) throw new Error("not an object.");
    const { direction, rate } = data;
    if (direction !== "foreign" && direction !== "domestic") {
      throw new Error("direction must be foreign or domestic.");
    }
    if (typeof rate !== "string" || parseDecimal(rate).negative) {
      throw new Error("rate must be a non-negative display string.");
    }
    return { direction, rate };
  },
  encode: (value) => ({ direction: value.direction, rate: value.rate }),
  factory: () => ({ direction: "foreign", rate: "1" }),
};

/** The exchange rate over the phone's EEPROM. */
export class CalculatorRate {
  readonly #eeprom: StockEeprom;

  constructor(eeprom: StockEeprom) {
    this.#eeprom = eeprom;
  }

  /** The prompt's value in `direction`: the typed rate, or its reciprocal (empty for 1/0). */
  shown(direction: RateDirection): string {
    const { direction: typed, rate } = this.#eeprom.read(CALCULATOR_RECORD);
    if (direction === typed) return rate;
    const reciprocal = calculate("1", "/", rate);
    return "ok" in reciprocal ? reciprocal.ok : "";
  }

  /**
   * OK on the prompt: an empty entry or a lone point stores zero (Task 0 X). The entry may start
   * with a point or a typed leading zero (`.5`, `05`); those store as display strings (`0.5`,
   * `5`, UNVERIFIED: no capture reopens such a rate).
   */
  set(direction: RateDirection, rate: string): void {
    const value =
      rate === "" || rate === "." ? "0" : rate.replace(/^\./, "0.").replace(/^0+(?=\d)/, "");
    parseDecimal(value);
    this.#eeprom.write(CALCULATOR_RECORD, { direction, rate: value });
  }

  /**
   * In domestic / In foreign: a Foreign rate r multiplies into domestic units and divides into
   * foreign ones; a Domestic rate the reverse.
   */
  convert(amount: string, to: RateDirection): CalcResult {
    const { direction, rate } = this.#eeprom.read(CALCULATOR_RECORD);
    return calculate(amount, (direction === "foreign") === (to === "domestic") ? "*" : "/", rate);
  }
}
