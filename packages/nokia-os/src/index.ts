// @hellotimber/nokia-os — the stock Nokia 3310 v6.39 firmware on the phone-core kernel.
export { paintStockScreen } from "./display/paint";
export { createStockPhone } from "./firmware/phone";
export { createMemoryStorage, STOCK_STORAGE_PREFIX } from "./firmware/eeprom";
export type { StockStorage } from "./firmware/eeprom";
export type { StockPhoneConfig } from "./firmware/phone";
export type { StockSoundEvent, StockSoundPort } from "./sound/port";
export type { StockLightEvent, StockLightsPort } from "./firmware/features/backlight";
export { stockMenu, stockMenuFor } from "./firmware/menu";
export { missingStockGlyphs } from "./resources";
export type { StockFontName } from "./resources";
export { createSyntheticNetwork } from "./messages/network";
export type {
  StockBusinessCard,
  StockIncomingSms,
  StockNetworkPort,
  StockSendOutcome,
  StockSms,
  StockTimestamp,
  SyntheticNetwork,
} from "./messages/network";
export type { StockContact, StockSimCard } from "./phone-book/sim-card";
// Plan 18b: T9 dictionaries (the English one is the `@hellotimber/nokia-os/t9-english` entry).
export { createT9Dictionary } from "./text/t9/dictionary";
export type { T9Dictionary } from "./text/t9/dictionary";
// Plan 30: SIM content (SMS on the SIM) and SIM services (the SIM toolkit's Menu 14).
export type { StockSimMessage } from "./sim/messages";
export type { StockSimToolkit, StockToolkitItem, StockToolkitStep } from "./sim/toolkit";
export { stockImeiLines } from "./firmware/preload";
export { describeStockScreen } from "./display/describe";
export type { StockPreload, StockReminderPreload } from "./firmware/preload";
