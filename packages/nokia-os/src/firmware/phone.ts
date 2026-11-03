import {
  createPhone,
  type KeyEvent,
  type Phone,
  type PhoneApplication,
  type PhoneKey,
  type PhoneSnapshot,
  type ScreenModel,
} from "@hellotimber/phone-core";
import type { StockServices } from "./features/feature";
import { VISIBLE_ROWS } from "../kit/ui/display/list-rows";
import { BOOT_TIMELINE, missingStockGlyphs } from "../kit/ui/resources";
import type { StockCueSink } from "./cues";
import { createMemoryStorage, StockEeprom, type StockStorage } from "./eeprom";
import { composerOf } from "./features/composer";
import { invalidShortcut } from "./leaves";
import { firmwareMenu, STOCK_SHORTCUT_WINDOW_MS, stockMessaging, stockServices } from "./menu";
import type { Firmware } from "./firmware";
import { firmwareRecords } from "./records";
import { STOCK_FIRMWARE } from "./stock";
import { openBox } from "../messages/read";
import { StockFlowApplication } from "../kit/ui/widgets/flow";
import { applyPreload, checkImei, checkPreload, type StockPreload } from "./preload";
import { createSyntheticNetwork, type StockNetworkPort } from "../services/messaging/network";
import { createStockGames, powerOffGames, powerOnGames } from "./features/games";
import type { StockPorts } from "./ports";
import { STOCK_DEFAULT_SIM, StockSecurity } from "./security";
import { standbyList } from "../phone-book/flows";
import { normaliseSim, type StockSimCard } from "../phone-book/sim-card";
import { StockPhoneBook } from "../services/phone-book/store";
import { STANDBY_KEY_DELAY_MS } from "../phone-book/timings";
import { stockBootGates } from "./boot";
import {
  activationBeep,
  powerList,
  PowerListState,
  standbyProfileLine,
  standbySilent,
} from "./features/profiles";
import { createStockSettings } from "./settings";
import { autoUpdate } from "./features/clock";
import { phoneAlarm } from "./features/clock/alarm";
import { phoneCountdown } from "./features/clock/countdown";
import { phoneStopwatch } from "./features/clock/stopwatch";
import { phoneReminders } from "./features/reminders/service";
import { registerClock } from "./features/clock/registry";
import { StockClock } from "./features/clock/service";
import { StockLightRules, StockLights, type StockLightsPort } from "./features/backlight";
import { KeyguardOverlay } from "./features/keyguard";
import type { StockSoundPort } from "../kit/ui/sound/port";
import type { StockGames } from "./features/games";
import { NO_T9_VIRGIN_CHOICES } from "../messages/bindings";
import type { T9Dictionary } from "../kit/ui/text/t9/dictionary";
import { stockT9 } from "../kit/system/t9/service";
import { SoundSequencer } from "../kit/ui/sound/sequencer";
import { StockSounder, type KeyDownOptions } from "../sound/sounder";
import { Framebuffer } from "@hellotimber/phone-screen";
import { paintStockScreen } from "../kit/ui/display/paint";
import { attachDescription, describeStockScreen } from "../kit/ui/display/describe";
import { StockCallLog } from "../services/calls/log";
import { StockTelephone } from "../services/calls/telephone";
import { STOCK_CALL_TONES } from "../calls/sounds";
import { CallClock } from "../services/calls/timestamp";
import { WIDGET_SPRITES } from "../kit/ui/resources";
import { dialledStandbyList, missedCallsList } from "./features/call-register";
import {
  incomingCallApplication,
  registerTelephone,
  shownEntry,
  stockStandbyEntry,
} from "./features/dialling";

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
   * Plan 15: the inserted SIM card's identity (with Phone security On, power-on asks for the
   * security code when this SIM is not among the last five used), or (plan 19 D2) the whole SIM
   * card: its phone book and service numbers. Default "sim-1": the emulator SIM (50 locations,
   * 16-character names, empty). An invalid card throws, naming the field and the location.
   */
  sim?: string | StockSimCard;
  /**
   * Plan 16: the phone's buzzer, tone generator and vibrator. Every change arrives from `tick()`
   * stamped with the kernel time it happens at. Default: nowhere.
   */
  sound?: StockSoundPort;
  /**
   * Plan 25: the display and keypad LEDs. Every change arrives from `tick()` stamped with the
   * kernel time it happens at. Default: nowhere.
   */
  lights?: StockLightsPort;
  /**
   * Plan 18: where SMS go and come from (D9). The phone subscribes once and keeps the
   * subscription for its lifetime. Default: `createSyntheticNetwork()` (every send accepted,
   * nothing delivered unless the host calls its `deliver`).
   */
  network?: StockNetworkPort;
  /**
   * Plan 30 D9: the phone's IMEI, 15 digits with a valid Luhn check digit (throws otherwise).
   * `*#06#` shows it (plan 22's screen). Default: none (the virgin `?` glyphs).
   */
  imei?: string;
  /**
   * Plan 30 D10: phone memory a user could have typed, written once where its record does not
   * exist in storage: the Welcome note (no settings record) and Reminders (no reminders record,
   * added in order). Every string must be typeable, within its editor's limit and drawable;
   * anything else throws, naming the field.
   */
  preload?: StockPreload;
  /**
   * Plan 18b: T9 dictionaries. With `english`, Write messages starts in T9 English as the virgin
   * firmware does. Without it, T9 English is unavailable (Dictionary off, plan 18 behaviour).
   */
  t9?: { readonly english?: T9Dictionary };
}

/** The envelope's blink while the SIM's message slots are full (`sms/full-arrival`: 478-482 ms). */
export const FULL_BLINK_MS = 480;

/** Plan 22: the handset over a screen below or above a call starts at x 1 (`in-call/options` e). */
const HANDSET_OVER_X = 1;

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
  /** The firmware the phone runs (default: the stock v6.39 firmware, `STOCK_FIRMWARE`). */
  readonly firmware?: Firmware;
}

/** A phone-core phone running the stock v6.39 firmware. It starts powered off. */
export function createStockPhone(config: StockPhoneConfig): Phone {
  return createStockPhoneWith(config);
}

/**
 * A phone-core phone running `firmware` (`composeFirmware`): its tree as the menu and its
 * features' screens and settings, with the stock handset around it (boot, standby, calls, lights,
 * sound). It starts powered off.
 */
export function createFirmwarePhone(firmware: Firmware, config: StockPhoneConfig): Phone {
  return createStockPhoneWith(config, { firmware });
}

/**
 * `createStockPhone` with internal options. The phone owns its EEPROM over `config.storage`
 * (read once here, so a malformed record throws now), its settings store and security code over
 * it (the lockout timed by the kernel clock, the SIM from `config.sim`), its boot gates, and its
 * games holder (the suspended games), which power-off clears.
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
  const simCard = normaliseSim(config.sim ?? STOCK_DEFAULT_SIM);
  const sim = simCard.id;
  // Plan 30 D9, D10: the host's IMEI and preload, checked before anything is written.
  const imei = config.imei === undefined ? undefined : checkImei(config.imei);
  const preload = checkPreload(config.preload);
  const { clock, date } = config;
  const firmware = internals.firmware ?? STOCK_FIRMWARE;
  const storage = config.storage ?? createMemoryStorage();
  const eeprom = new StockEeprom(storage, firmwareRecords(firmware));
  const t9 = stockT9(eeprom, config.t9?.english);
  // Plan 18b D5: without a T9 dictionary the virgin editor is multi-tap (Dictionary off).
  const settings = createStockSettings(eeprom, t9.english ? {} : NO_T9_VIRGIN_CHOICES, firmware);
  applyPreload(preload, storage, eeprom, settings, firmware);
  let now = 0;
  const security = new StockSecurity(eeprom, settings, { now: () => now, sim });
  const skip = config.boot === "skip";
  // Plan 21 D1: the phone's time is the host's clock plus its own offset; the menu, its pages
  // and the games read the phone's time.
  const phoneTime = new StockClock({ host: { clock, date }, settings, eeprom, now: () => now });
  registerClock(eeprom, settings, phoneTime);
  const ports = phoneTime.ports;
  const port = config.sound;
  const sequencer = new SoundSequencer((event) => port?.change(event));
  // Plan 27 (D8): the Composer's saved tones are Ringing tone options 35-41.
  const composer = composerOf({ eeprom });
  const sounder = new StockSounder(sequencer, settings, () => now, {
    userTones: (index) => composer.userRingingTone(index),
  });
  const lightsPort = config.lights;
  const lights = new StockLights(
    (event) => lightsPort?.change(event),
    () => now,
  );
  // Plan 25 D7: Games › Settings › Lights during play, timed from the games' own cues; it reads
  // the suspended game from the holder below.
  const lightRules = new StockLightRules({
    lights,
    settings,
    games: {
      get suspended() {
        return games.suspended;
      },
    },
    now: () => now,
  });
  const clockGames = createStockGames(ports, () => now);
  const games: StockGames = {
    ...clockGames,
    ...(internals.seed === undefined ? {} : { seed: () => internals.seed! }),
    cues: lightRules.cues(internals.cues ?? sounder),
    // Plan 21: an alert falling due pauses Snake II (it shows at standby, D3).
    events: () => phoneTime.alerts.queued,
  };
  const network = config.network ?? createSyntheticNetwork();
  const messaging = stockMessaging(eeprom, settings, simCard, network);
  messaging.connect();
  const phoneBook = new StockPhoneBook(eeprom, simCard);
  // The menu's leaves see these services without the IMEI (plan 30 D9: only standby's `*#06#`).
  const menuServices = stockServices(
    ports,
    settings,
    games,
    security,
    sounder,
    eeprom,
    messaging,
    t9,
    phoneBook,
    undefined,
    firmware,
  );
  const services: StockServices = {
    ...menuServices,
    ...(imei === undefined ? {} : { imei }),
  };
  // Plan 21: the clock's features over this phone's services (the alarm's minute listener, the
  // countdown's expiry).
  const alarm = phoneAlarm(services);
  const countdown = phoneCountdown(services);
  const stopwatch = phoneStopwatch(services);
  // Plan 22: the telephone, its register and its clock (plan 21's phone time, D11); calls ring through the network port.
  const callLog = new StockCallLog(eeprom);
  const callClock = new CallClock(
    () => ports.clock?.(),
    () => ports.date?.(),
    () => now,
  );
  const telephone = new StockTelephone({
    network,
    sounder,
    tones: STOCK_CALL_TONES,
    settings,
    log: callLog,
    clock: callClock,
    nameOf: (number) => phoneBook.byNumber(number)?.name,
    now: () => now,
  });
  network.subscribeCalls?.((call, link) => telephone.ring(call, link));
  // Plan 17 D7: the power key's list, over the same services as the menu's leaves.
  const power = new PowerListState();
  const reminders = phoneReminders(services);
  registerTelephone(eeprom, telephone, power);
  let keyguardCall: PhoneApplication | undefined;
  const phone: Phone = createPhone({
    menu: firmwareMenu(menuServices, simCard),
    // Plan 18 D11: the envelope while Inbox holds unread messages, blinking while every slot is
    // used (`sms/full-arrival`: 480 ms steps; its phase is UNVERIFIED). Plan 17 D6: the silent
    // icon while the active profile's Incoming call alert is Off. Plan 21 D10: the alarm, timer
    // and stopwatch indicators.
    standbyIndicators: () => {
      const store = messaging.store;
      const message = store.full() ? Math.floor(now / FULL_BLINK_MS) % 2 === 0 : store.unread() > 0;
      const silent = standbySilent(settings);
      // The kernel keeps only the flags that are true.
      return { message, silent, divert: telephone.divert, ...phoneTime.indicators() };
    },
    carrier: config.carrier,
    // Plan 21 D10: standby shows the phone's time, hidden or 12-hour as Clock settings say.
    clock: () => phoneTime.standbyClock(),
    // Plan 21 D4: the alarm switches a powered-off phone on.
    wake: () => alarm.wake(),
    bootTimeline: BOOT_TIMELINE,
    ...(skip ? { bootMs: 0 } : {}),
    // Plan 15 D9: the security code and the welcome note hold the boot after the self-test.
    bootGates: stockBootGates({ security, settings, skip, sound: (lines) => sounder.note(lines) }),
    // Plan 22 (D3): ▲ opens the dialled numbers; plan 19 D5: ▼ opens the phone book's name list
    // (S1: the captures correct the spec's arrows, which plan 14 copied). Both are standby
    // applications after standby's 23 ms leaving frame (`handover/notice-up`).
    standbyKeys: {
      up: dialledStandbyList(services),
      down: new StockFlowApplication("stock:phone-book", () => standbyList(services)),
    },
    standbyKeyDelayMs: STANDBY_KEY_DELAY_MS,
    menuOpenDelayMs: STOCK_MENU_OPEN_DELAY_MS,
    shortcutWindowMs: STOCK_SHORTCUT_WINDOW_MS,
    // Rows levels keep the stateful circular window of the stock painter (plan 14 D3).
    rowsWindow: VISIBLE_ROWS,
    // Stock shortcut digits: menu numbers, delayed opening, Invalid shortcut (plan 14 D14).
    shortcutEntry: { openDelayMs: STOCK_SHORTCUT_OPEN_DELAY_MS, invalid: invalidShortcut(sounder) },
    // Plan 17: the active profile's line under the operator (D5).
    standbyLine: standbyProfileLine(settings),
    standbyPower: powerList(services, power),
    // Plan 22 (D2): digits, `*` and `#` start standby's number entry.
    standbyEntry: stockStandbyEntry(services),
    // Plan 22 (D4): a ring interrupts whatever shows; an answered call over another screen comes
    // back once connected. The telephone goes first, then plan 21 D3's clock alerts (at standby).
    interruption: (): PhoneApplication | undefined => {
      if (keyguardCall !== undefined) {
        const application = keyguardCall;
        keyguardCall = undefined;
        return application;
      }
      const resumed = telephone.callToShow();
      if (resumed !== undefined) {
        return incomingCallApplication(services, telephone, resumed, { kind: "other" });
      }
      const ringing = telephone.takeRing();
      if (ringing === undefined) {
        return phoneTime.alerts.interruption(() => {
          if (standbySince !== undefined) return standbySince;
          // Standby reached within this tick (an alert's exit) counts from now.
          const screen: ScreenModel = phone.screen;
          return screen.kind === "standby" && !screen.leaving ? now : undefined;
        });
      }
      if (keyguard.engine.pass().activity) lights.activity();
      const entry = shownEntry(telephone);
      const below = keyguard.engine.locked
        ? { kind: "keyguard" as const }
        : entry !== undefined
          ? { kind: "entry" as const, text: entry.text }
          : { kind: phone.screen.kind === "standby" ? ("standby" as const) : ("other" as const) };
      return incomingCallApplication(services, telephone, ringing, below);
    },
  });
  // Plan 25 D4: the keyguard over the kernel, which stays at standby underneath it.
  const keyguard = new KeyguardOverlay(phone, {
    now: () => now,
    noteSound: (lines) => sounder.note(lines),
    calls: {
      dial(number) {
        const call = telephone.dial(number, true);
        keyguard.engine.pass();
        keyguardCall = incomingCallApplication(services, telephone, call, { kind: "standby" });
      },
    },
  });
  // Plan 25 K7, L7: an arrival lights the phone, but not a locked one.
  const arrivals = stockArrivals(phone, services, () => {
    const engine = keyguard.engine;
    if ((engine.locked ? engine.arrivedWhileLocked() : { activity: true }).activity) {
      lights.activity();
    }
  });
  // Plan 22 (S21): missed calls show their notice at standby (List opens Missed calls).
  let noticed = 0;
  const missedNotice = (): void => {
    const missed = callLog.missedCalls();
    if (missed === noticed) return;
    if (missed === 0) {
      noticed = 0;
      return;
    }
    if (phone.screen.kind !== "standby" || telephone.active) return;
    noticed = missed;
    phone.setNotice({
      text: `${missed}\nmissed\ncall${missed === 1 ? "" : "s"}`,
      softkey: "List",
      open: missedCallsList(services),
    });
  };
  // When standby was last drawn (kernel time), while it is on screen (plan 21 D3).
  let standbySince: number | undefined;
  // Power-off loses the suspended game (it survives standby, Task 0 C8) and silences the phone.
  // Plan 25: the light tick runs from the power-on; the boot lights the LEDs at the self-test's
  // first frame and again where the firmware shows its clock prompt (nokia-os: standby).
  let poweredOn = false;
  let booting = false;
  phone.subscribe((snapshot) => {
    if (!snapshot.poweredOn) powerOffGames(games);
    // Plan 18 D9: messages delivered while off land once power-on reaches standby.
    if (snapshot.poweredOn && snapshot.screen.kind === "standby") {
      messaging.atStandby();
      arrivals.atStandby();
    }
    if (snapshot.poweredOn !== poweredOn) {
      poweredOn = snapshot.poweredOn;
      booting = poweredOn;
      alarm.power(poweredOn);
      countdown.power(poweredOn);
      stopwatch.power(poweredOn);
      reminders.power(poweredOn);
      if (poweredOn) {
        powerOnGames(games);
        sounder.powerOn({ boot: !skip });
        lights.powerOn(now);
        telephone.powerOn();
        // Plan 21 D13: Auto update of date and time at the end of power-on.
        autoUpdate(services);
      } else {
        telephone.powerOff();
        sounder.powerOff();
        lights.powerOff();
        keyguard.reset();
        messaging.poweredOff();
      }
    }
    if (!booting) return;
    const { screen } = snapshot;
    if (screen.kind === "boot" && screen.frame > 0 && !lights.display) lights.activity();
    if (screen.kind === "standby") {
      booting = false;
      lights.activity();
    }
  });
  // Snapshots: the kernel's, with the keyguard's screen while it shows one (D4). The keyguard's
  // frames change on its own timers too, so every wrapper call ends by publishing a change.
  const subscribers = new Set<(snapshot: PhoneSnapshot) => void>();
  let overlay: PhoneSnapshot["screen"] | undefined;
  const deliver = (snapshot: PhoneSnapshot): void => {
    for (const callback of subscribers) {
      try {
        callback(snapshot);
      } catch {
        // Host subscribers cannot be allowed to corrupt firmware state (as the kernel's).
      }
    }
  };
  // Plan 22: the handset drawn over the screen below a call (a ring rejected over a menu, an
  // answered call before it connects).
  let handset:
    | { readonly under: PhoneSnapshot["screen"]; readonly screen: PhoneSnapshot["screen"] }
    | undefined;
  const withHandset = (screen: PhoneSnapshot["screen"]): PhoneSnapshot["screen"] => {
    if (!poweredOn || !telephone.handsetOverlay()) {
      handset = undefined;
      return screen;
    }
    if (handset?.under === screen) return handset.screen;
    const fb = new Framebuffer();
    paintStockScreen(fb, screen);
    const sprite = WIDGET_SPRITES["call/handset"]!;
    // Over another screen the handset sits at the top left (`interrupt/menu-reject` e).
    fb.blitBitmap(sprite.bitmap, HANDSET_OVER_X, sprite.y);
    const painted: PhoneSnapshot["screen"] = {
      kind: "custom",
      appId: "stock:handset",
      frame: { width: fb.width, height: fb.height, pixels: fb.pixels },
    };
    // Plan 30 D11: the screen text is the screen's below.
    attachDescription(painted.frame, describeStockScreen(screen));
    handset = { under: screen, screen: painted };
    return painted;
  };
  const shownScreen = (): PhoneSnapshot["screen"] => keyguard.screen ?? withHandset(phone.screen);
  phone.subscribe((snapshot) => {
    overlay = keyguard.screen ?? withHandset(snapshot.screen);
    deliver(overlay === snapshot.screen ? snapshot : { ...snapshot, screen: overlay });
  });
  let callLights = false;
  const publish = (): void => {
    const call = telephone.call;
    const holdsLights =
      call !== undefined && !call.done && (call.emergency || telephone.phase(call) === "ringing");
    if (holdsLights !== callLights) lights.force(holdsLights ? "on" : null);
    callLights = holdsLights;
    if (!holdsLights) lightRules.update(phone.path);
    if (!telephone.active) keyguard.engine.resume();
    const screen = shownScreen();
    if (screen === overlay) return;
    overlay = screen;
    deliver({ path: phone.path, screen, poweredOn });
  };
  const send = (event: KeyEvent): void => {
    if (event.type === "up") {
      const notice = noticeShown();
      if (!(poweredOn && keyguard.keyUp(event.key))) phone.send(event);
      // Plan 30 Task 0 M (`sms/slots/*`): C held on a notice clears it too, at its release (the
      // kernel's long press at standby does nothing).
      if (event.key === "c" && notice !== undefined && noticeShown() === notice) {
        phone.setNotice(null);
      }
      sounder.keyUp(event.key);
      publish();
      return;
    }
    arrivals.keyDown();
    if (!poweredOn) {
      phone.send(event);
      publish();
      return;
    }
    // Plan 25: a locked keypad takes every key, the power key included (its hint, not plan 17's
    // profile list: `hint/pwr`).
    const outcome = keyguard.keyDown(event.key);
    if (outcome.activity) lights.activity();
    if (outcome.consumed) {
      if (!outcome.silent) sounder.keyDown(event.key, { holdBeeps: false });
    } else {
      const options = keyDownOptions(event.key, phone, power);
      // Plan 17 D4: a key that activates a profile beeps at that profile's level.
      const activation = activationBeep(phone, event.key, settings, power);
      // D7: the power key's list draws the standby it opened over.
      if (event.key === "power") {
        const screen = phone.screen;
        power.standby = screen.kind === "standby" ? screen : undefined;
      }
      phone.send(event);
      if (activation !== undefined) sounder.keyBeepLevel(activation);
      // The beep follows the key's handling: a widget may set this key's level or replace it. A
      // key that switched the phone off has none: the power-off tone plays (Switch off!, P5).
      if (poweredOn) sounder.keyDown(event.key, options);
    }
    publish();
  };
  /** The text of the notice standby shows, if any. */
  function noticeShown(): string | undefined {
    const screen = phone.screen;
    return screen.kind === "standby" ? screen.notice?.text : undefined;
  }
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
      phoneTime.tick();
      const screen = phone.screen;
      if (screen.kind !== "standby" || screen.leaving) standbySince = undefined;
      else standbySince ??= now;
      messaging.tick(now);
      callClock.tick();
      phone.tick(nowMs);
      telephone.tick();
      missedNotice();
      sounder.tick();
      sequencer.advance(now);
      lights.tick();
      publish();
    },
    navigate(path) {
      phone.navigate(path);
      publish();
    },
    setNotice(notice) {
      phone.setNotice(notice);
      publish();
    },
    get path() {
      return phone.path;
    },
    get screen() {
      return shownScreen();
    },
    subscribe(callback) {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
    on: (event, callback) => phone.on(event, callback),
  };
  return wrapper;
}

/**
 * How a key-down beeps where the phone is (Task 0): the power key beeps at standby only
 * (`boot/power-key`; not in the Ringing tone list, `boot/power-off`), and C in the menu
 * carousel leaves the menu at its key-down, so it has no long press to beep at.
 */
function keyDownOptions(key: PhoneKey, phone: Phone, power: PowerListState): KeyDownOptions {
  // Plan 17: and in the power key's list, where it moves the highlight.
  const listed = power.selected !== undefined;
  if (key === "power")
    return { beeps: phone.screen.kind === "standby" || listed, holdBeeps: false };
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
function stockArrivals(phone: Phone, services: StockServices, arrived: () => void) {
  const { messaging, sounder } = services;
  const inbox = new StockFlowApplication("stock:inbox", () => openBox(services, "inbox"));
  let waiting = false;
  const received = () => {
    const unread = messaging.store.unread();
    const text = `${unread}\nmessage${unread === 1 ? "" : "s"}\nreceived`;
    phone.setNotice({ text, softkey: "Read", open: inbox });
  };
  messaging.onArrival((_sms, result) => {
    // Light activity (plan 25 L7; UNVERIFIED for a refused arrival and one away from standby,
    // whose goldens are lit already).
    arrived();
    const atStandby = phone.screen.kind === "standby";
    if (result === "full") {
      if (atStandby) phone.setNotice({ text: "No space\nfor new\nmessages", softkey: "OK" });
      return;
    }
    // D15: the active profile's message alert (the Tones settings alias the active profile's,
    // plan 17 D1).
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
