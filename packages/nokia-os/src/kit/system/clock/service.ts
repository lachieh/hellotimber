// The phone's clock (plan 21): phone time over the host clock plus a stored offset (D1), the
// standby clock reader (D10), and minute edges (D2), observed on kernel ticks. Alerts, the
// countdown and the stopwatch are added by their own modules over this service.
import type { StandbyIndicators } from "@hellotimber/phone-core";
import type { EepromRecord, RecordStore } from "../../../services/storage";
import type { StockPorts } from "../ports";
import type { StockSettings } from "../settings";
import { StockAlerts } from "./alerts";
import { CLOCK_RECORD, type ClockState } from "./record";
import {
  addMinutes,
  formatClock,
  formatDate,
  minuteIndex,
  parseHostTime,
  type PhoneTime,
} from "./time";

/** The Time format setting (11-2-3) and its 12-hour option. */
export const TIME_FORMAT = { key: "clock/clock-settings/time-format", twelveHour: 1 } as const;

export interface StockClockDeps {
  /** The host's real-time clock (`HH:MM`, `DD.MM.YYYY`), re-read whenever the time is needed. */
  readonly host: StockPorts;
  readonly settings: StockSettings;
  readonly eeprom: RecordStore;
  /** The kernel time (the phone's `tick`); default 0 (a menu without a phone). */
  readonly now?: () => number;
}

/** One minute edge (D2): the phone time's minute changed forwards. */
export type MinuteListener = (at: PhoneTime) => void;

export class StockClock {
  readonly #host: StockPorts;
  readonly #settings: StockSettings;
  readonly #eeprom: RecordStore;
  readonly #listeners: MinuteListener[] = [];
  /** The minute the last tick saw (minuteIndex), undefined without a time. */
  #minute: number | undefined;

  /**
   * The phone-time readers the menu, its pages and the games read in place of the host's: the
   * 24-hour `HH:MM` and `DD.MM.YYYY` of `now()`, undefined without a time.
   */
  readonly ports: StockPorts;
  /** The kernel time. */
  readonly kernelNow: () => number;
  /** Alerts waiting for standby (D3). */
  readonly alerts: StockAlerts;

  constructor(deps: StockClockDeps) {
    this.kernelNow = deps.now ?? (() => 0);
    this.alerts = new StockAlerts(this.kernelNow);
    this.#host = deps.host;
    this.#settings = deps.settings;
    this.#eeprom = deps.eeprom;
    this.ports = {
      clock: () => {
        const now = this.now();
        return now === undefined ? undefined : formatClock(now, false);
      },
      date: () => {
        const now = this.now();
        return now === undefined ? undefined : formatDate(now);
      },
    };
    this.#minute = this.#index();
  }

  /** The clock record (the alarm's state lives there too), read on every tick: not a copy. */
  state(): Readonly<ClockState> {
    return this.#eeprom.peek(CLOCK_RECORD);
  }

  /** Writes fields of the clock record. */
  update(change: Partial<ClockState>): void {
    this.#eeprom.write(CLOCK_RECORD as EepromRecord<ClockState>, { ...this.state(), ...change });
  }

  /** now()'s last inputs and result: it is read several times on every tick. */
  #memo:
    | {
        clock: string | undefined;
        date: string | undefined;
        offset: number;
        time: PhoneTime | undefined;
      }
    | undefined;

  /** The phone's time: the host's plus the stored offset (D1); undefined when the host gives no
   * time (or a malformed one). */
  now(): PhoneTime | undefined {
    const clock = this.#host.clock?.();
    const date = this.#host.date?.();
    const offset = this.state().offsetMinutes;
    const memo = this.#memo;
    if (
      memo !== undefined &&
      memo.clock === clock &&
      memo.date === date &&
      memo.offset === offset
    ) {
      return memo.time;
    }
    const host = parseHostTime(clock, date);
    const time = host === undefined ? undefined : addMinutes(host, offset);
    this.#memo = { clock, date, offset, time };
    return time;
  }

  #index(): number | undefined {
    const now = this.now();
    return now === undefined ? undefined : minuteIndex(now);
  }

  /** Whether Time format is 12-hour. */
  twelveHour(): boolean {
    return this.#settings.choice(TIME_FORMAT.key) === TIME_FORMAT.twelveHour;
  }

  /** The clock as standby shows it (D10): undefined while hidden or without a time. */
  standbyClock(): string | undefined {
    if (this.state().hidden) return undefined;
    const now = this.now();
    return now === undefined ? undefined : formatClock(now, this.twelveHour());
  }

  /** Clock settings › Hide clock / Show clock. */
  hidden(): boolean {
    return this.state().hidden;
  }

  setHidden(hidden: boolean): void {
    this.update({ hidden });
  }

  /**
   * Set the time: the phone's time of day becomes `hour:minute`, the date kept (the offset moves;
   * the host is untouched). Without a host time nothing can anchor it: nothing changes.
   */
  setTime(hour: number, minute: number): void {
    const now = this.now();
    if (now === undefined) return;
    this.#shift(minuteIndex({ ...now, hour, minute }) - minuteIndex(now));
  }

  /** Date setting: the phone's date becomes `day.month.year`, the time of day kept. */
  setDate(day: number, month: number, year: number): void {
    const now = this.now();
    if (now === undefined) return;
    this.#shift(minuteIndex({ ...now, day, month, year }) - minuteIndex(now));
  }

  /** Phone time minus host time (Set the time, Date setting). */
  offsetMinutes(): number {
    return this.state().offsetMinutes;
  }

  /** Clears the offset (Auto update, D13); returns whether the phone's time changed. */
  clearOffset(): boolean {
    const offset = this.state().offsetMinutes;
    if (offset === 0) return false;
    this.#shift(-offset);
    return true;
  }

  #shift(minutes: number): void {
    this.update({ offsetMinutes: this.state().offsetMinutes + minutes });
    // Setting the time or the date fires nothing (D2): the next edge counts from here.
    this.#minute = this.#index();
  }

  /** Standby's indicators (D10): set by the alarm, the countdown and the stopwatch. */
  indicators(): StandbyIndicators {
    const flags: Record<string, boolean> = {};
    for (const source of this.#indicatorSources) Object.assign(flags, source());
    return flags;
  }

  readonly #indicatorSources: (() => StandbyIndicators)[] = [];

  /** Adds a source of standby indicators (the alarm, the countdown, the stopwatch). */
  addIndicators(source: () => StandbyIndicators): void {
    this.#indicatorSources.push(source);
  }

  /** Called on each forwards minute edge, with the new minute. */
  onMinute(listener: MinuteListener): void {
    this.#listeners.push(listener);
  }

  readonly #tickListeners: (() => void)[] = [];

  /** Called on every kernel tick, before the minute edge (the countdown's expiry, D5). */
  onTick(listener: () => void): void {
    this.#tickListeners.push(listener);
  }

  /**
   * Observes the phone time on a kernel tick: one edge when its minute moved forwards since the
   * last tick (however far), none when it moved back or there is no time (D2).
   */
  tick(): void {
    for (const listener of this.#tickListeners) listener();
    const minute = this.#index();
    const before = this.#minute;
    this.#minute = minute;
    if (minute === undefined || before === undefined || minute <= before) return;
    const at = this.now()!;
    for (const listener of this.#listeners) listener(at);
  }
}
