import { createPhone, type Phone } from "@hellotimber/phone-core";
import { BOOT_TIMELINE, missingStockGlyphs } from "../resources";
import { createStockMenu } from "./menu";
import type { StockPorts } from "./bindings";

export interface StockPhoneConfig extends StockPorts {
  /** Operator line. Every glyph must exist in the stock small font (validated; throws). */
  carrier: string;
  /** Default "animated". "skip" = bootMs 0 (tests, reduced motion). */
  boot?: "animated" | "skip";
}

/**
 * Stock standby ▲/▼: the phone book name search and the dialled-numbers list (placeholders until
 * the Phone book and Call register plans).
 */
export const STOCK_STANDBY_KEYS = {
  up: "menu/phone-book/search",
  down: "menu/call-register/dialled-numbers",
} as const;

/** Standby stays on screen (ladders erased) for 39 ms after Menu (menu/01-phone-book.anim b). */
export const STOCK_MENU_OPEN_DELAY_MS = 39;
/** The first-digit dots turn into the menu number 2948 ms after Menu (menu/01-phone-book.anim). */
export const STOCK_SHORTCUT_WINDOW_MS = 2948;

/** A phone-core phone running the stock v6.39 firmware. It starts powered off. */
export function createStockPhone(config: StockPhoneConfig): Phone {
  const missing = missingStockGlyphs(config.carrier, "small");
  if (missing.length > 0) {
    throw new Error(
      `Carrier "${config.carrier}" has characters the stock small font lacks: ${missing
        .map((ch) => JSON.stringify(ch))
        .join(", ")}.`,
    );
  }
  const { clock, date } = config;
  return createPhone({
    menu: createStockMenu({ clock, date }),
    carrier: config.carrier,
    ...(clock === undefined ? {} : { clock }),
    bootTimeline: BOOT_TIMELINE,
    ...(config.boot === "skip" ? { bootMs: 0 } : {}),
    standbyKeys: STOCK_STANDBY_KEYS,
    menuOpenDelayMs: STOCK_MENU_OPEN_DELAY_MS,
    shortcutWindowMs: STOCK_SHORTCUT_WINDOW_MS,
  });
}
