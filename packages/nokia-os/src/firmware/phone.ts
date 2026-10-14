import { createPhone, type Phone } from "@hellotimber/phone-core";
import { VISIBLE_ROWS } from "../display/list-rows";
import { BOOT_TIMELINE, missingStockGlyphs } from "../resources";
import { STOCK_SHORTCUT_WINDOW_MS, type StockPorts } from "./bindings";
import type { StockCueSink } from "./cues";
import { createMemoryStorage, StockEeprom, type StockStorage } from "./eeprom";
import { invalidShortcut } from "./leaves";
import { createStockGames, createStockMenu } from "./menu";
import { createStockSettings } from "./settings";

export interface StockPhoneConfig extends StockPorts {
  /** Operator line. Every glyph must exist in the stock small font (validated; throws). */
  carrier: string;
  /** Default "animated". "skip" = bootMs 0 (tests, reduced motion). */
  boot?: "animated" | "skip";
  /**
   * Plan 15: where settings persist (`window.localStorage` fits). Default: a fresh in-memory
   * storage. Empty storage is the virgin EEPROM. A malformed record throws, naming its key.
   */
  storage?: StockStorage;
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

/** Internal options for tests and plan 16 (not exported from the package). */
export interface StockPhoneInternals {
  /**
   * The seed every New game takes, instead of the clock's (D4: the stock phone seeds from the
   * minutes of the day, UNVERIFIED; tests inject the seeds recovered from the captures).
   */
  readonly seed?: number;
  /** Where the games' cues go, stamped with the kernel time (D8; default: nowhere). */
  readonly cues?: StockCueSink;
}

/** A phone-core phone running the stock v6.39 firmware. It starts powered off. */
export function createStockPhone(config: StockPhoneConfig): Phone {
  return createStockPhoneWith(config);
}

/**
 * `createStockPhone` with internal options. The phone owns its EEPROM over `config.storage`
 * (read once here, so a malformed record throws now), its settings store over it, and its games
 * holder (the suspended game), which power-off clears.
 */
export function createStockPhoneWith(
  config: StockPhoneConfig,
  internals: StockPhoneInternals = {},
): Phone {
  const missing = missingStockGlyphs(config.carrier, "small");
  if (missing.length > 0) {
    throw new Error(
      `Carrier "${config.carrier}" has characters the stock small font lacks: ${missing
        .map((ch) => JSON.stringify(ch))
        .join(", ")}.`,
    );
  }
  const { clock, date } = config;
  const eeprom = new StockEeprom(config.storage ?? createMemoryStorage());
  const settings = createStockSettings(eeprom);
  let now = 0;
  const ports = { clock, date };
  const clockGames = createStockGames(ports, () => now);
  const games = {
    ...clockGames,
    ...(internals.seed === undefined ? {} : { seed: () => internals.seed! }),
    ...(internals.cues === undefined ? {} : { cues: internals.cues }),
  };
  const phone = createPhone({
    menu: createStockMenu(ports, settings, games),
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
  // Power-off loses the suspended game (it survives standby, Task 0 C8).
  phone.subscribe((snapshot) => {
    if (!snapshot.poweredOn) games.snake = undefined;
  });
  return {
    send: (event) => phone.send(event),
    pressKey: (key, holdMs) => phone.pressKey(key, holdMs),
    tick(nowMs) {
      // The kernel time the games stamp their cues with.
      now = Math.max(now, nowMs);
      phone.tick(nowMs);
    },
    navigate: (path) => phone.navigate(path),
    setNotice: (notice) => phone.setNotice(notice),
    get path() {
      return phone.path;
    },
    get screen() {
      return phone.screen;
    },
    subscribe: (callback) => phone.subscribe(callback),
    on: (event, callback) => phone.on(event, callback),
  };
}
