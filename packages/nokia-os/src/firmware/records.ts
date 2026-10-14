// The one list of the phone's EEPROM records (plan 15 D2). Each feature owns one record with its
// own version; Restore factory settings and a host's "erase" see every record listed here.
// Plan 15 Tasks 5 and 6 add the settings and security records; plans 16-24 append theirs.
import type { EepromRecord } from "./eeprom";

export const STOCK_RECORDS: readonly EepromRecord<unknown>[] = [];
