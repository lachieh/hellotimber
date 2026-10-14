// @hellotimber/nokia-os — the stock Nokia 3310 v6.39 firmware on the phone-core kernel.
export { paintStockScreen } from "./display/paint";
export { createStockPhone } from "./firmware/phone";
export { createMemoryStorage, STOCK_STORAGE_PREFIX } from "./firmware/eeprom";
export type { StockStorage } from "./firmware/eeprom";
export type { StockPhoneConfig } from "./firmware/phone";
export type { StockSoundEvent, StockSoundPort } from "./sound/port";
export { stockMenu } from "./firmware/menu";
export { missingStockGlyphs } from "./resources";
export type { StockFontName } from "./resources";
