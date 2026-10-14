import { createPhone, type Phone } from "@hellotimber/phone-core";
import { VISIBLE_ROWS } from "../display/list-rows";
import { BOOT_TIMELINE, missingStockGlyphs } from "../resources";
import { invalidShortcut } from "./leaves";
import { createStockMenu } from "./menu";
import { STOCK_SHORTCUT_WINDOW_MS, type StockPorts } from "./bindings";

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

/**
 * A typed entry opens this long after its digit (P5: 1431-1480 ms between the redraws; plan 14
 * Task 5 pins 1460 ms).
 */
export const STOCK_SHORTCUT_OPEN_DELAY_MS = 1460;

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
    // Rows levels keep the stateful circular window of the stock painter (plan 14 D3).
    rowsWindow: VISIBLE_ROWS,
    // Stock shortcut digits: menu numbers, delayed opening, Invalid shortcut (plan 14 D14).
    shortcutEntry: { openDelayMs: STOCK_SHORTCUT_OPEN_DELAY_MS, invalid: invalidShortcut() },
  });
}
