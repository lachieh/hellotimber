// One clock per phone (plan 21): the phone registers the clock it builds over the host's ports;
// feature bindings find it by the phone's EEPROM. A menu built without a phone (tests) gets one
// over its own ports.
import type { RecordStore } from "../../../services/storage";
import type { StockPorts } from "../ports";
import type { StockSettings } from "../settings";
import { StockClock } from "./service";

const CLOCKS = new WeakMap<RecordStore, StockClock>();
/** The same clocks by the phone's settings store (the pages' value readers get only that). */
const BY_SETTINGS = new WeakMap<StockSettings, StockClock>();

/** Makes `clock` the clock of the phone whose EEPROM is `eeprom` and settings `settings`. */
export function registerClock(
  eeprom: RecordStore,
  settings: StockSettings,
  clock: StockClock,
): void {
  CLOCKS.set(eeprom, clock);
  BY_SETTINGS.set(settings, clock);
}

/** The clock of the phone whose settings store this is, if one was built. */
export function clockOfSettings(settings: StockSettings): StockClock | undefined {
  return BY_SETTINGS.get(settings);
}

/** The clock of the phone whose services these are. */
export function phoneClock(services: {
  readonly eeprom: RecordStore;
  readonly settings: StockSettings;
  readonly ports: StockPorts;
}): StockClock {
  let clock = CLOCKS.get(services.eeprom);
  if (clock === undefined) {
    clock = new StockClock({
      host: services.ports,
      settings: services.settings,
      eeprom: services.eeprom,
    });
    registerClock(services.eeprom, services.settings, clock);
  }
  return clock;
}
