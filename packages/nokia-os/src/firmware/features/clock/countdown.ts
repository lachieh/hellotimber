// The countdown timer (plan 21 Task 9, D5): RAM state on kernel time (it expires exactly
// hh × 3600 + mm × 60 s after Start, nominal; lost at power-off), the page's time left rounded up
// to a minute, the standby timer icon, and the `Countdown` / `time up` alert with its bells and its
// sound (≈29 s, ascending), which stays until a key.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { AlertModel } from "../../../kit/ui/display/widgets";
import { CLOCK_ALERTS } from "../../../kit/ui/resources";
import type { SoundPlay } from "../../../kit/ui/sound/sequencer";
import type { Flow, Widget } from "../../../kit/ui/widgets/flow";
import type { StockServices } from "../feature";
import { bellsAt } from "./alarm";
import {
  alertExit,
  alertLeadIn,
  standbyOf,
  type AlertStandby,
} from "../../../kit/system/clock/alerts";
import { phoneClock } from "../../../kit/system/clock/registry";
import type { StockClock } from "../../../kit/system/clock/service";

/**
 * The countdown alert's bells step first this long after it is drawn (plan21 countdown/
 * expire-standby 214 ms, expire-virgin 214 ms), then every `CLOCK_ALERTS.bells.stepMs`.
 */
const COUNTDOWN_BELLS_FIRST_MS = 214;

const COUNTDOWNS = new WeakMap<StockClock, StockCountdown>();

/** The countdown of the phone whose services these are. */
export function phoneCountdown(services: StockServices): StockCountdown {
  const clock = phoneClock(services);
  let countdown = COUNTDOWNS.get(clock);
  if (countdown === undefined) {
    countdown = new StockCountdown(clock, services);
    COUNTDOWNS.set(clock, countdown);
  }
  return countdown;
}

/** The countdown of `clock`'s phone, if its phone built one (the page's value reader). */
export function countdownOf(clock: StockClock): StockCountdown | undefined {
  return COUNTDOWNS.get(clock);
}

/** `hh:mm` of a whole number of minutes. */
export function formatMinutes(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export class StockCountdown {
  readonly #clock: StockClock;
  readonly #services: StockServices;
  /** The running countdown: when it expires (kernel time). */
  #run: { readonly endsAt: number } | undefined;
  /** Expired, its alert not yet answered. */
  #alerting = false;

  constructor(clock: StockClock, services: StockServices) {
    this.#clock = clock;
    this.#services = services;
    clock.onTick(() => this.#tick());
    // The icon stays until the alert is answered (plan21 countdown/expire-standby).
    clock.addIndicators(() => (this.#run === undefined && !this.#alerting ? {} : { timer: true }));
  }

  running(): boolean {
    return this.#run !== undefined;
  }

  /** The time left, rounded up to a whole minute (`hh:mm`), while it runs. */
  remaining(): string | undefined {
    if (this.#run === undefined) return undefined;
    const ms = Math.max(0, this.#run.endsAt - this.#clock.kernelNow());
    return formatMinutes(Math.ceil(ms / 60_000));
  }

  /** Starts `hh:mm` from now (00:00 stops it instead: `Timer stopped`). */
  start(value: string): void {
    const minutes = Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    if (minutes === 0) {
      this.stop();
      return;
    }
    this.#run = { endsAt: this.#clock.kernelNow() + minutes * 60_000 };
  }

  stop(): void {
    this.#run = undefined;
  }

  /** The phone switched off: the countdown is RAM (Task 0). */
  power(on: boolean): void {
    if (!on) this.#run = undefined;
  }

  #tick(): void {
    if (this.#run === undefined || this.#clock.kernelNow() < this.#run.endsAt) return;
    this.#run = undefined;
    this.#alerting = true;
    const standby: AlertStandby = () => standbyOf(this.#clock);
    const answered = () => (this.#alerting = false);
    this.#clock.alerts.queue({
      id: "countdown",
      root: (deferred) => {
        const alert = () => new CountdownAlert(this.#services, standby, answered);
        return deferred ? alertLeadIn(standby, alert) : alert();
      },
    });
  }
}

/**
 * `Countdown` / `time up` with the bell row and `OK` (plan21 countdown/expire-*): the sound for
 * `countdownSoundMs`, then silence; the screen until a key, which ends it as it goes down.
 */
class CountdownAlert implements Widget {
  readonly #services: StockServices;
  readonly #standby: AlertStandby;
  readonly #answered: () => void;
  #elapsed = 0;
  #sound: SoundPlay | undefined;

  constructor(services: StockServices, standby: AlertStandby, answered: () => void) {
    this.#services = services;
    this.#standby = standby;
    this.#answered = answered;
    const { stepMs, firstMs } = CLOCK_ALERTS.ascend;
    this.#sound = services.sounder.alert(CLOCK_ALERTS.programs.countdown, {
      stepMs,
      firstMs: firstMs.countdown,
    });
  }

  render(): AlertModel {
    return {
      kind: "alert",
      ...this.#standby(),
      lines: ["Countdown", "time up"],
      align: "block",
      sprites: [bellsAt(this.#elapsed, COUNTDOWN_BELLS_FIRST_MS)],
      softkey: "OK",
    };
  }

  tick(dtMs: number): void {
    this.#elapsed += dtMs;
    if (this.#elapsed >= CLOCK_ALERTS.countdownSoundMs) this.#silence();
  }

  onKeyDown(_key: PhoneKey, flow: Flow): void {
    this.#silence();
    this.#answered();
    flow.replace(alertExit(this.#standby));
  }

  #silence(): void {
    if (this.#sound !== undefined) this.#services.sounder.stop(this.#sound);
    this.#sound = undefined;
  }

  close(): void {
    this.#silence();
    this.#answered();
  }
}
