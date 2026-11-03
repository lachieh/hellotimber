// The one list of a phone's EEPROM records (plan 15 D2): its firmware's settings store's, then
// its handset's (the security code's, the clock's, ...) and every feature's
// (`StockFeature.records`), each with its own version.
// Restore factory settings and a host's "erase" see every record listed here.
import type { EepromRecord } from "../services/storage";
import type { Firmware } from "./firmware";
import { settingsRecordOf } from "./settings";
import { STOCK_FIRMWARE } from "./stock";

/** The EEPROM records of a phone running `firmware`. */
export function firmwareRecords(firmware: Firmware): readonly EepromRecord<unknown>[] {
  return [settingsRecordOf(firmware) as EepromRecord<unknown>, ...firmware.records];
}

/** The stock firmware's records. */
export const STOCK_RECORDS: readonly EepromRecord<unknown>[] = firmwareRecords(STOCK_FIRMWARE);
