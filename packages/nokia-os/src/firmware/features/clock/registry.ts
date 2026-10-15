// One clock per phone (plan 21): the phone registers the clock it builds over the host's ports;
// feature bindings find it by the phone's EEPROM. A menu built without a phone (tests) gets one
// over its own ports.
import type { StockEeprom } from "../../eeprom";
import type { StockPorts } from "../../ports";
import type { StockSettings } from "../../settings";
import { StockClock } from "./service";

const CLOCKS = new WeakMap<StockEeprom, StockClock>();

/** Makes `clock` the clock of the phone whose EEPROM is `eeprom`. */
export function registerClock(eeprom: StockEeprom, clock: StockClock): void {
  CLOCKS.set(eeprom, clock);
}

/** The clock of the phone whose services these are. */
export function phoneClock(services: {
  readonly eeprom: StockEeprom;
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
    CLOCKS.set(services.eeprom, clock);
  }
  return clock;
}
