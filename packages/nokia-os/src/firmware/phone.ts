import { createPhone, type KeyEvent, type Phone, type PhoneKey } from "@hellotimber/phone-core";
import { VISIBLE_ROWS } from "../display/list-rows";
import { BOOT_TIMELINE, missingStockGlyphs } from "../resources";
import type { StockCueSink } from "./cues";
import { createMemoryStorage, StockEeprom, type StockStorage } from "./eeprom";
import { invalidShortcut } from "./leaves";
import { createStockGames, createStockMenu, STOCK_SHORTCUT_WINDOW_MS } from "./menu";
import type { StockPorts } from "./ports";
import { STOCK_DEFAULT_SIM, StockSecurity } from "./security";
import { stockBootGates } from "./boot";
import { createStockSettings } from "./settings";
import type { StockSoundPort } from "../sound/port";
import { SoundSequencer } from "../sound/sequencer";
import { StockSounder, type KeyDownOptions } from "../sound/sounder";

export interface StockPhoneConfig extends StockPorts {
  /** Operator line. Every glyph must exist in the stock small font (validated; throws). */
  carrier: string;
  /**
   * Default "animated". "skip" = bootMs 0 (tests, reduced motion): no self-test, hands or welcome
   * note, but the security code is still asked for when Phone security wants it.
   */
  boot?: "animated" | "skip";
  /**
   * Plan 15: where settings persist (`window.localStorage` fits). Default: a fresh in-memory
   * storage. Empty storage is the virgin EEPROM. A malformed record throws, naming its key.
   */
  storage?: StockStorage;
  /**
   * Plan 15: the inserted SIM card's identity. With Phone security On, power-on asks for the
   * security code when this SIM is not among the last five used. Default "sim-1"; non-empty.
   */
  sim?: string;
  /**
   * Plan 16: the phone's buzzer, tone generator and vibrator. Every change arrives from `tick()`
   * stamped with the kernel time it happens at. Default: nowhere.
   */
  sound?: StockSoundPort;
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
  /** Where the games' cues go, stamped with the kernel time (D8; default: the phone's sounder). */
  readonly cues?: StockCueSink;
}

/** A phone-core phone running the stock v6.39 firmware. It starts powered off. */
export function createStockPhone(config: StockPhoneConfig): Phone {
  return createStockPhoneWith(config);
}

/**
 * `createStockPhone` with internal options. The phone owns its EEPROM over `config.storage`
 * (read once here, so a malformed record throws now), its settings store and security code over
 * it (the lockout timed by the kernel clock, the SIM from `config.sim`), its boot gates, and its
 * games holder (the suspended game), which power-off clears.
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
  const sim = config.sim ?? STOCK_DEFAULT_SIM;
  if (typeof sim !== "string" || sim === "") {
    throw new Error(`The SIM must be a non-empty string (received ${JSON.stringify(sim)}).`);
  }
  const { clock, date } = config;
  const eeprom = new StockEeprom(config.storage ?? createMemoryStorage());
  const settings = createStockSettings(eeprom);
  let now = 0;
  const security = new StockSecurity(eeprom, settings, { now: () => now, sim });
  const skip = config.boot === "skip";
  const ports = { clock, date };
  const port = config.sound;
  const sequencer = new SoundSequencer((event) => port?.change(event));
  const sounder = new StockSounder(sequencer, settings, () => now);
  const clockGames = createStockGames(ports, () => now);
  const games = {
    ...clockGames,
    ...(internals.seed === undefined ? {} : { seed: () => internals.seed! }),
    cues: internals.cues ?? sounder,
  };
  const phone = createPhone({
    menu: createStockMenu(ports, settings, games, security, sounder, eeprom),
    carrier: config.carrier,
    ...(clock === undefined ? {} : { clock }),
    bootTimeline: BOOT_TIMELINE,
    ...(skip ? { bootMs: 0 } : {}),
    // Plan 15 D9: the security code and the welcome note hold the boot after the self-test.
    bootGates: stockBootGates({ security, settings, skip, sound: (lines) => sounder.note(lines) }),
    standbyKeys: STOCK_STANDBY_KEYS,
    menuOpenDelayMs: STOCK_MENU_OPEN_DELAY_MS,
    shortcutWindowMs: STOCK_SHORTCUT_WINDOW_MS,
    // Rows levels keep the stateful circular window of the stock painter (plan 14 D3).
    rowsWindow: VISIBLE_ROWS,
    // Stock shortcut digits: menu numbers, delayed opening, Invalid shortcut (plan 14 D14).
    shortcutEntry: { openDelayMs: STOCK_SHORTCUT_OPEN_DELAY_MS, invalid: invalidShortcut(sounder) },
  });
  // Power-off loses the suspended game (it survives standby, Task 0 C8) and silences the phone.
  let poweredOn = false;
  phone.subscribe((snapshot) => {
    if (!snapshot.poweredOn) games.snake = undefined;
    if (snapshot.poweredOn === poweredOn) return;
    poweredOn = snapshot.poweredOn;
    if (poweredOn) sounder.powerOn({ boot: !skip });
    else sounder.powerOff();
  });
  const send = (event: KeyEvent): void => {
    if (event.type === "up") {
      phone.send(event);
      sounder.keyUp(event.key);
      return;
    }
    const on = poweredOn;
    const options = on ? keyDownOptions(event.key, phone) : undefined;
    phone.send(event);
    // The beep follows the key's handling: a widget may set this key's level or replace it.
    if (options !== undefined) sounder.keyDown(event.key, options);
  };
  const wrapper: Phone = {
    send,
    pressKey(key, holdMs = 0) {
      send({ type: "down", key });
      if (holdMs > 0) wrapper.tick(now + holdMs);
      send({ type: "up", key });
    },
    tick(nowMs) {
      // The kernel time the games stamp their cues and the sounder its sounds with.
      now = Math.max(now, nowMs);
      phone.tick(nowMs);
      sounder.tick();
      sequencer.advance(now);
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
  return wrapper;
}

/**
 * How a key-down beeps where the phone is (Task 0): the power key beeps at standby only
 * (`boot/power-key`; not in the Ringing tone list, `boot/power-off`), and C in the menu
 * carousel leaves the menu at its key-down, so it has no long press to beep at.
 */
function keyDownOptions(key: PhoneKey, phone: Phone): KeyDownOptions {
  if (key === "power") return { beeps: phone.screen.kind === "standby", holdBeeps: false };
  if (key === "c" && phone.screen.kind === "menu-carousel") return { holdBeeps: false };
  return {};
}
