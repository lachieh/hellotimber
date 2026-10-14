// The one list of the phone's EEPROM records (plan 15 D2): the settings store's, then every
// feature's (`StockFeature.records`, e.g. the security code's), each with its own version.
// Restore factory settings and a host's "erase" see every record listed here.
import type { EepromRecord } from "./eeprom";
import { SETTINGS_RECORD } from "./settings";
import { FEATURE_RECORDS } from "./stock";

export const STOCK_RECORDS: readonly EepromRecord<unknown>[] = [
  SETTINGS_RECORD as EepromRecord<unknown>,
  ...FEATURE_RECORDS,
];
