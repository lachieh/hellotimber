// The v6.39 firmware's EEPROM: the record store holding every stock record by default.
import { RecordStore, type EepromRecord, type StockStorage } from "../services/storage";
import { STOCK_RECORDS } from "./records";

export * from "../services/storage";

export class StockEeprom extends RecordStore {
  constructor(storage: StockStorage, records: readonly EepromRecord<unknown>[] = STOCK_RECORDS) {
    super(storage, records);
  }
}
