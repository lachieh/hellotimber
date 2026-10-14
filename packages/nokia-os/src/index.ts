// @hellotimber/nokia-os — the stock Nokia 3310 v6.39 firmware on the phone-core kernel.
export { paintStockScreen } from "./display/paint";
export { createStockPhone } from "./firmware/phone";
export type { StockPhoneConfig } from "./firmware/phone";
export { stockMenu } from "./firmware/menu";
export { missingStockGlyphs } from "./resources";
export type { StockFontName } from "./resources";
