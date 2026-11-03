// The stopwatch (plan 21 Task 10, D5): RAM state on kernel time (it keeps running while the phone
// shows anything else; lost at power-off), and its standby indicator, blinking while it runs.
import type { StockServices } from "../feature";
import { phoneClock } from "@hellotimber/nokia-kit/system/clock/registry";
import type { StockClock } from "@hellotimber/nokia-kit/system/clock/service";

/**
 * The standby indicator blinks while the stopwatch runs: shown, then hidden, this long each
 * (plan21 stopwatch/standby: 59 steps over 28.4 s; the ringing alarm's text blinks as often).
 */
export const STOPWATCH_BLINK_MS = 480.95;

const STOPWATCHES = new WeakMap<StockClock, StockStopwatch>();

/** The stopwatch of the phone whose services these are. */
export function phoneStopwatch(services: StockServices): StockStopwatch {
  const clock = phoneClock(services);
  let stopwatch = STOPWATCHES.get(clock);
  if (stopwatch === undefined) {
    stopwatch = new StockStopwatch(clock);
    STOPWATCHES.set(clock, stopwatch);
  }
  return stopwatch;
}

export class StockStopwatch {
  readonly #now: () => number;
  /** When it last started (kernel time), while it runs. */
  #startedAt: number | undefined;
  /** The time counted before the last start. */
  #banked = 0;
  /** The time its screen last showed (a reopened screen shows it until its first redraw). */
  displayedMs = 0;

  constructor(clock: StockClock) {
    this.#now = clock.kernelNow;
    clock.addIndicators(() =>
      this.#startedAt !== undefined &&
      Math.floor((this.#now() - this.#startedAt) / STOPWATCH_BLINK_MS) % 2 === 0
        ? { stopwatch: true }
        : {},
    );
  }

  running(): boolean {
    return this.#startedAt !== undefined;
  }

  /** The time counted, ms. */
  elapsedMs(): number {
    return this.#banked + (this.#startedAt === undefined ? 0 : this.#now() - this.#startedAt);
  }

  /** Starts (or resumes) counting. */
  start(): void {
    this.#startedAt ??= this.#now();
  }

  stop(): void {
    this.#banked = this.elapsedMs();
    this.#startedAt = undefined;
  }

  reset(): void {
    this.#banked = 0;
    this.#startedAt = undefined;
    this.displayedMs = 0;
  }

  /** The phone switched off: the stopwatch is RAM. */
  power(on: boolean): void {
    if (!on) this.reset();
  }
}

/**
 * The display of `ms`: `h:mm:ss.cc` (the large face; the 10-hour limit of the user guide is
 * UNVERIFIED, so the hours wrap at 10).
 */
export function formatStopwatch(ms: number): string {
  const total = Math.floor(ms / 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  const cs = total % 100;
  const s = Math.floor(total / 100) % 60;
  const m = Math.floor(total / 6000) % 60;
  const h = Math.floor(total / 360_000) % 10;
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}
