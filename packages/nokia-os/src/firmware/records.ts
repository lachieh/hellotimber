// The one list of the phone's EEPROM records (plan 15 D2). Each feature owns one record with its
// own version; Restore factory settings and a host's "erase" see every record listed here.
// Plans 16-24 append theirs.
import type { EepromRecord } from "./eeprom";
import { SECURITY_RECORD } from "./security";
import { SETTINGS_RECORD } from "./settings";

export const STOCK_RECORDS: readonly EepromRecord<unknown>[] = [
  SETTINGS_RECORD as EepromRecord<unknown>,
  SECURITY_RECORD as EepromRecord<unknown>,
];
