// @hellotimber/nokia-os — the stock Nokia 3310 v6.39 firmware on the phone-core kernel.
export { paintStockScreen } from "./kit/ui/display/paint";
export { createStockPhone } from "./firmware/phone";
export { createMemoryStorage, STOCK_STORAGE_PREFIX } from "./firmware/eeprom";
export type { StockStorage } from "./firmware/eeprom";
export type { StockPhoneConfig } from "./firmware/phone";
export type { StockSoundEvent, StockSoundPort } from "./kit/ui/sound/port";
export type { StockLightEvent, StockLightsPort } from "./firmware/features/backlight";
export { stockMenu, stockMenuFor } from "./firmware/menu";
export { missingStockGlyphs } from "./kit/ui/resources";
export type { StockFontName } from "./kit/ui/resources";
export { createSyntheticNetwork } from "./services/messaging/network";
export type {
  StockBusinessCard,
  StockRingtone,
  StockIncomingSms,
  StockNetworkPort,
  StockSendOutcome,
  StockSms,
  StockTimestamp,
  SyntheticNetwork,
} from "./services/messaging/network";
// Plan 22: the network port's call half (dial, subscribeCalls) and the synthetic cell's rings.
export type {
  StockCallControl,
  StockCallLink,
  StockIncomingCall,
  StockOutgoingCall,
  StockRing,
  SyntheticRing,
} from "./services/calls/network";
export type { StockContact, StockSimCard } from "./phone-book/sim-card";
// Plan 18b: T9 dictionaries (the English one is the `@hellotimber/nokia-os/t9-english` entry).
export { createT9Dictionary } from "./kit/ui/text/t9/dictionary";
export type { T9Dictionary } from "./kit/ui/text/t9/dictionary";
// Plan 30: SIM content (SMS on the SIM) and SIM services (the SIM toolkit's Menu 14).
export type { StockSimMessage } from "./sim/messages";
export type { StockSimToolkit, StockToolkitItem, StockToolkitStep } from "./sim/toolkit";
export { stockImeiLines } from "./firmware/preload";
export { describeStockScreen } from "./kit/ui/display/describe";
export type { StockPreload, StockReminderPreload } from "./firmware/preload";

export type {
  StockServiceHost,
  StockServiceResult,
  StockServiceControl,
} from "./services/calls/services";
