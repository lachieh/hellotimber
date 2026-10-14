// Calculator (menu 9, plan 20): the stock calculator over its pure engine, its Options in three
// states, currency conversion and the exchange-rate entry, the rate stored in the EEPROM (D6).
import { CALCULATOR_RECORD, CalculatorRate } from "../../calculator/rate";
import { calculator } from "../../widgets/calculator";
import type { EepromRecord } from "../eeprom";
import { timelineById, timelineByName } from "../timelines";
import type { StockFeature } from "./feature";

/**
 * The rate entry's cursor blink: the representative prompt cursor (≈480 ms, plan 14 P9), as the
 * calculator's own prompt recordings (`calculator/rate-prompt-*`) run within ±10 ms of it.
 */
const CURSOR_STYLE = "2-9";

export const calculatorFeature: StockFeature = {
  name: "calculator",
  screens: {
    "9": ({ eeprom, noteSound }) => {
      const services = {
        rate: new CalculatorRate(eeprom),
        noteSound,
        notes: {
          "out-of-range": timelineByName("calculator-out-of-range"),
          "divide-by-zero": timelineByName("calculator-divide-by-zero"),
          "rate-saved": timelineByName("calculator-rate-saved"),
        },
        blink: timelineById(CURSOR_STYLE, "the exchange rate's cursor"),
      };
      return () => calculator(services);
    },
  },
  // The exchange rate (D6): Restore factory settings sets it to 1.
  records: [CALCULATOR_RECORD as EepromRecord<unknown>],
};
