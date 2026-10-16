// When a call happened (plan 22 D11) and how Time of call reads it: `13.10.2026` and `10:10:00`
// (`register/time-of-call`), `10:10:00 am` in the 12-hour Time format (`register/time-of-call-12h`).
// The date, hour and minute are the phone's (the host's `clock()`/`date()`, plan 21's phone time
// when it lands); the firmware keeps the seconds itself, so the phone counts them from the moment
// it saw the minute change (`00` until it has seen one: the captures' frozen RTC shows `10:10:00`).

export interface CallStamp {
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

const two = (n: number): string => String(n).padStart(2, "0");

/** Parses the host's `HH:MM` and `DD.MM.YYYY` (the captured formats); undefined when unset. */
export function parseHostTime(
  clock: string | undefined,
  date: string | undefined,
): Omit<CallStamp, "second"> | undefined {
  const t = /^(\d{1,2}):(\d{2})/.exec(clock ?? "");
  const d = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(date ?? "");
  if (t === null || d === null) return undefined;
  return {
    year: Number(d[3]),
    month: Number(d[2]),
    day: Number(d[1]),
    hour: Number(t[1]),
    minute: Number(t[2]),
  };
}

/** The phone's call clock: the host's minute plus the seconds counted since it changed. */
export class CallClock {
  readonly #clock: () => string | undefined;
  readonly #date: () => string | undefined;
  readonly #now: () => number;
  #minute: string | undefined;
  /** Kernel time the minute was seen to change; undefined until it has changed once. */
  #changedAt: number | undefined;

  constructor(clock: () => string | undefined, date: () => string | undefined, now: () => number) {
    this.#clock = clock;
    this.#date = date;
    this.#now = now;
  }

  /** Watches the host clock (each tick). */
  tick(): void {
    const minute = this.#clock();
    if (this.#minute !== undefined && minute !== this.#minute) this.#changedAt = this.#now();
    this.#minute = minute;
  }

  /** The stamp of a call happening now; undefined while the phone has no time. */
  stamp(): CallStamp | undefined {
    const time = parseHostTime(this.#clock(), this.#date());
    if (time === undefined) return undefined;
    const second =
      this.#changedAt === undefined ? 0 : Math.floor((this.#now() - this.#changedAt) / 1000) % 60;
    return { ...time, second };
  }
}

/** Time of call's date line: `13.10.2026`. */
export function callDate(stamp: CallStamp): string {
  return `${two(stamp.day)}.${two(stamp.month)}.${stamp.year}`;
}

/** Time of call's time line: `10:10:00`, or `10:10:00 am` in the 12-hour Time format. */
export function callTime(stamp: CallStamp, twelveHour = false): string {
  if (!twelveHour) return `${two(stamp.hour)}:${two(stamp.minute)}:${two(stamp.second)}`;
  const hour = stamp.hour % 12 === 0 ? 12 : stamp.hour % 12;
  const mark = stamp.hour < 12 ? "am" : "pm";
  return `${two(hour)}:${two(stamp.minute)}:${two(stamp.second)} ${mark}`;
}
