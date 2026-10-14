// Calculator (menu 9): plan 20 implements it (`menu/09-calculator.sub` pending until then).
import { CALCULATOR_RECORD } from "../../calculator/rate";
import type { EepromRecord } from "../eeprom";
import type { StockFeature } from "./feature";

export const calculatorFeature: StockFeature = {
  name: "calculator",
  placeholders: { "9": "20" },
  // The exchange rate (D6): Restore factory settings sets it to 1.
  records: [CALCULATOR_RECORD as EepromRecord<unknown>],
};
