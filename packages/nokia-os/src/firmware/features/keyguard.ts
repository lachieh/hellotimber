// The keyguard (plan 25 D4-D8) is the handset's (`nokia-kit/src/system/keyguard.ts`), wired by the stock
// phone wrapper (`src/firmware/phone.ts`): no tree screens.
import type { StockFeature } from "./feature";

export const keyguardFeature: StockFeature = { name: "keyguard" };
