import { createPhone, type KeyEvent, type Phone, type PhoneKey } from "@hellotimber/phone-core";
import type { StockServices } from "./features/feature";
import { VISIBLE_ROWS } from "../display/list-rows";
import { BOOT_TIMELINE, missingStockGlyphs } from "../resources";
import type { StockCueSink } from "./cues";
import { createMemoryStorage, StockEeprom, type StockStorage } from "./eeprom";
import { invalidShortcut } from "./leaves";
import {
  createStockGames,
  createStockMenu,
  STOCK_SHORTCUT_WINDOW_MS,
  stockMessaging,
  stockServices,
} from "./menu";
import { openBox } from "../messages/read";
import { StockFlowApplication } from "../widgets/flow";
import { createSyntheticNetwork, type StockNetworkPort } from "../messages/network";
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
  /**
   * Plan 18: where SMS go and come from (D9). The phone subscribes once and keeps the
   * subscription for its lifetime. Default: `createSyntheticNetwork()` (every send accepted,
   * nothing delivered unless the host calls its `deliver`).
   */
  network?: StockNetworkPort;
}

/**
 * Stock standby ▲/▼: the phone book name search and the dialled-numbers list (placeholders until
 * the Phone book and Call register plans).
 */
export const STOCK_STANDBY_KEYS = {
  up: "menu/phone-book/search",
  down: "menu/call-register/dialled-numbers",
} as const;

/** The envelope's blink while the SIM's message slots are full (`sms/full-arrival`: 478-482 ms). */
export const FULL_BLINK_MS = 480;

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
  const messaging = stockMessaging(
    eeprom,
    settings,
    sim,
    config.network ?? createSyntheticNetwork(),
  );
  messaging.connect();
  const phone = createPhone({
    menu: createStockMenu(ports, settings, games, security, sounder, eeprom, messaging),
    // Plan 18 D11: the envelope while Inbox holds unread messages, blinking while every slot is
    // used (`sms/full-arrival`: 480 ms steps; its phase is UNVERIFIED).
    standbyIndicators: () => {
      const store = messaging.store;
      if (store.full()) return Math.floor(now / FULL_BLINK_MS) % 2 === 0 ? { message: true } : {};
      return store.unread() > 0 ? { message: true } : undefined;
    },
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
  const arrivals = stockArrivals(
    phone,
    stockServices(ports, settings, games, security, sounder, eeprom, messaging),
  );
  // Power-off loses the suspended game (it survives standby, Task 0 C8) and silences the phone.
  let poweredOn = false;
  phone.subscribe((snapshot) => {
    if (!snapshot.poweredOn) games.snake = undefined;
    // Plan 18 D9: messages delivered while off land once power-on reaches standby.
    if (snapshot.poweredOn && snapshot.screen.kind === "standby") {
      messaging.atStandby();
      arrivals.atStandby();
    }
    if (snapshot.poweredOn === poweredOn) return;
    poweredOn = snapshot.poweredOn;
    if (poweredOn) sounder.powerOn({ boot: !skip });
    else {
      sounder.powerOff();
      messaging.poweredOff();
    }
  });
  const send = (event: KeyEvent): void => {
    if (event.type === "up") {
      phone.send(event);
      sounder.keyUp(event.key);
      return;
    }
    const on = poweredOn;
    const options = on ? keyDownOptions(event.key, phone) : undefined;
    arrivals.keyDown();
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
      messaging.tick(now);
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

/**
 * Arrivals at the phone (plan 18 D12, Task 0 I): at standby, the alert and `<n> message(s)
 * received` with Read, which opens the Inbox as a standby application (C back to standby); a
 * second arrival recounts the unread messages. Away from standby nothing interrupts: the notice
 * waits for the next standby unless a key goes down first (`sms/elsewhere-note`: the arrival
 * during Invalid shortcut is noticed once the note ends; `elsewhere-menu`, `-editor`: C to
 * standby shows the envelope only). A full SIM refuses the message: `No space for new messages`
 * (`sms/full-arrival`).
 */
function stockArrivals(phone: Phone, services: StockServices) {
  const { messaging, sounder } = services;
  const inbox = new StockFlowApplication("stock:inbox", () => openBox(services, "inbox"));
  let waiting = false;
  const received = () => {
    const unread = messaging.store.unread();
    const text = `${unread}\nmessage${unread === 1 ? "" : "s"}\nreceived`;
    phone.setNotice({ text, softkey: "Read", open: inbox });
  };
  messaging.onArrival((_sms, result) => {
    const atStandby = phone.screen.kind === "standby";
    if (result === "full") {
      if (atStandby) phone.setNotice({ text: "No space\nfor new\nmessages", softkey: "OK" });
      return;
    }
    // D15: the profile's message alert (General's, the Tones settings, until plan 17's profiles).
    sounder.messageAlert("tones");
    if (atStandby) received();
    else waiting = true;
  });
  return {
    keyDown(): void {
      waiting = false;
    },
    atStandby(): void {
      if (!waiting) return;
      waiting = false;
      received();
    },
  };
}
