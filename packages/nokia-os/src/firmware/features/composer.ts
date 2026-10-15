// Composer (Tones › Composer, 5-4-1 … 5-4-7; plan 27): the saved tones' EEPROM record (D7). The
// slots, editor and saved tones in the Ringing tone lists follow (Tasks 8-10).
import { COMPOSER_RECORD } from "../../composer/store";
import type { EepromRecord } from "../eeprom";
import type { StockFeature } from "./feature";

export const composerFeature: StockFeature = {
  name: "composer",
  // Restore factory settings empties every slot (K13).
  records: [COMPOSER_RECORD as EepromRecord<unknown>],
};
