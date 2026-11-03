// @hellotimber/nokia-os — the stock Nokia 3310 v6.39 firmware on the phone-core kernel.
export {
  describeFirmwareScreen,
  describeStockScreen,
  firmwarePainter,
  paintStockScreen,
} from "./firmware/display";
export { createFirmwarePhone, createStockPhone } from "./firmware/phone";
// Plan 32: a firmware is a value: a handset, a tree and the features bound to it
// (`createFirmwarePhone`).
export { composeFirmware } from "./firmware/firmware";
export type {
  Firmware,
  FirmwareNode,
  FirmwareSpec,
  Handset,
  SimServicesSlot,
} from "./firmware/firmware";
export { STOCK_HANDSET } from "./firmware/handset";
export type { CarouselGraphic } from "@hellotimber/nokia-kit/ui/resources";
export { remountFeature } from "./firmware/remount";
export { STOCK_FEATURES, STOCK_FIRMWARE } from "./firmware/stock";
export type { StockFeature } from "./firmware/features/feature";
export type { StockTreeNode } from "./firmware/generated/stock-tree";
export { createMemoryStorage, STOCK_STORAGE_PREFIX } from "./firmware/eeprom";
export type { StockStorage } from "./firmware/eeprom";
export type { StockPhoneConfig } from "./firmware/phone";
export type { StockSoundEvent, StockSoundPort } from "@hellotimber/nokia-kit/ui/sound/port";
export type { StockLightEvent, StockLightsPort } from "@hellotimber/nokia-kit/system/lights";
export { stockMenu, stockMenuFor } from "./firmware/menu";
export { missingStockGlyphs } from "@hellotimber/nokia-kit/ui/resources";
export type { StockFontName } from "@hellotimber/nokia-kit/ui/resources";
export { createSyntheticNetwork } from "@hellotimber/phone-services/messaging/network";
export type {
  StockBusinessCard,
  StockRingtone,
  StockIncomingSms,
  StockNetworkPort,
  StockSendOutcome,
  StockSms,
  StockTimestamp,
  SyntheticNetwork,
} from "@hellotimber/phone-services/messaging/network";
// Plan 22: the network port's call half (dial, subscribeCalls) and the synthetic cell's rings.
export type {
  StockCallControl,
  StockCallLink,
  StockIncomingCall,
  StockOutgoingCall,
  StockRing,
  SyntheticRing,
} from "@hellotimber/phone-services/calls/network";
export type { StockContact, StockSimCard } from "./phone-book/sim-card";
// Plan 18b: T9 dictionaries (the English one is the `@hellotimber/nokia-os/t9-english` entry).
export { createT9Dictionary } from "@hellotimber/nokia-kit/ui/text/t9/dictionary";
export type { T9Dictionary } from "@hellotimber/nokia-kit/ui/text/t9/dictionary";
// Plan 30: SIM content (SMS on the SIM) and SIM services (the SIM toolkit's Menu 14).
export type { StockSimMessage } from "./sim/messages";
export type { StockSimToolkit, StockToolkitItem, StockToolkitStep } from "./sim/toolkit";
export { stockImeiLines } from "./firmware/preload";
export type { StockPreload, StockReminderPreload } from "./firmware/preload";

export type {
  StockServiceHost,
  StockServiceResult,
  StockServiceControl,
} from "@hellotimber/phone-services/calls/services";
