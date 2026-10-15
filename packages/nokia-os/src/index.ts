// @hellotimber/nokia-os — the stock Nokia 3310 v6.39 firmware on the phone-core kernel.
export { paintStockScreen } from "./display/paint";
export { createStockPhone } from "./firmware/phone";
export { createMemoryStorage, STOCK_STORAGE_PREFIX } from "./firmware/eeprom";
export type { StockStorage } from "./firmware/eeprom";
export type { StockPhoneConfig } from "./firmware/phone";
export type { StockSoundEvent, StockSoundPort } from "./sound/port";
export type { StockLightEvent, StockLightsPort } from "./firmware/features/backlight";
export { stockMenu } from "./firmware/menu";
export { missingStockGlyphs } from "./resources";
export type { StockFontName } from "./resources";
export { createSyntheticNetwork } from "./messages/network";
export type {
  StockIncomingSms,
  StockNetworkPort,
  StockSendOutcome,
  StockSms,
  StockTimestamp,
  SyntheticNetwork,
} from "./messages/network";
// Plan 18b: T9 dictionaries (the English one is the `@hellotimber/nokia-os/t9-english` entry).
export { createT9Dictionary } from "./text/t9/dictionary";
export type { T9Dictionary } from "./text/t9/dictionary";
