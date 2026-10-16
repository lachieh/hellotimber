// The clock's alerts (plan 21 D3, Task 0): the alarm, the countdown's expiry, reminders and
// Auto update's notes wait in a queue and show one at a time when the phone is at standby (v6.39
// shows none over a menu, a note, an editor or a game), through phone-core's `interruption`.
import type { PhoneApplication } from "@hellotimber/phone-core";
import type { AlertModel } from "../../../display/widgets";
import { StockFlowApplication, type Flow, type Widget } from "../../../widgets/flow";
import type { StockClock } from "./service";

/** One alert: what it shows (a flow of widgets; its end returns to standby). */
export interface ClockAlert {
  readonly id: string;
  /** `deferred`: it fell due while the phone was elsewhere and shows on the return to standby. */
  readonly root: (deferred: boolean) => Widget;
}

/**
 * Standby without its operator line, between an alert and standby: this long before an alert
 * that waited for standby (plan21 alarm/ring-elsewhere-*-standby: 88-91 ms, standby itself not
 * drawn), and ALERT_EXIT_MS after one that ends.
 */
export const ALERT_LEAD_IN_MS = 91;

/**
 * Leaving an alert (a key that stops it): standby is drawn without its operator line this long
 * before the whole of it (plan21 alarm/ring-*-key-c: 80 ms; countdown 87-102 ms; reminders 93 ms).
 */
export const ALERT_EXIT_MS = 90;

/** What an alert's standby frames show: standby's clock and indicators. */
export type AlertStandby = () => Pick<AlertModel, "clock" | "indicators">;

/** Standby's clock and indicators, as an alert draws them. */
export function standbyOf(clock: StockClock): Pick<AlertModel, "clock" | "indicators"> {
  const shown = clock.standbyClock();
  return { ...(shown === undefined ? {} : { clock: shown }), indicators: clock.indicators() };
}

/** Standby without its operator line for `ms`, then `then` (back to standby, or the alert). */
export class StandbyFrame implements Widget {
  readonly #standby: AlertStandby;
  readonly #ms: number;
  readonly #then: (flow: Flow) => void;
  #elapsed = 0;

  constructor(standby: AlertStandby, ms: number, then: (flow: Flow) => void) {
    this.#standby = standby;
    this.#ms = ms;
    this.#then = then;
  }

  render(): AlertModel {
    return { kind: "alert", ...this.#standby(), lines: [], align: "block", softkey: "Menu" };
  }

  tick(dtMs: number, flow: Flow): void {
    this.#elapsed += dtMs;
    if (this.#elapsed >= this.#ms) this.#then(flow);
  }
}

/** The standby frame an alert ends with (then standby). */
export const alertExit = (standby: AlertStandby): Widget =>
  new StandbyFrame(standby, ALERT_EXIT_MS, (flow) => flow.back());

/** `alert` after the standby frame that leads in an alert which waited for standby. */
export const alertLeadIn = (standby: AlertStandby, alert: () => Widget): Widget =>
  new StandbyFrame(standby, ALERT_LEAD_IN_MS, (flow) => flow.replace(alert()));

export class StockAlerts {
  readonly #now: () => number;
  readonly #pending: { readonly alert: ClockAlert; readonly atMs: number }[] = [];
  #active: ClockAlert | undefined;
  /** When the alert on screen showed. */
  #activeFrom = 0;
  /** The last alert's span: one that fell due during it follows it at once (alert-two). */
  #last: { readonly from: number; readonly to: number } | undefined;
  #queued = 0;

  /** `now`: the kernel time. */
  constructor(now: () => number) {
    this.#now = now;
  }

  /** Queues `alert` (`first`: ahead of the others). */
  queue(alert: ClockAlert, options: { readonly first?: boolean } = {}): void {
    this.#queued++;
    const entry = { alert, atMs: this.#now() };
    if (options.first) this.#pending.unshift(entry);
    else this.#pending.push(entry);
  }

  /** Drops queued alerts that `match` (a stopped countdown's expiry, an erased reminder). */
  drop(match: (alert: ClockAlert) => boolean): void {
    for (let i = this.#pending.length - 1; i >= 0; i--) {
      if (match(this.#pending[i]!.alert)) this.#pending.splice(i, 1);
    }
  }

  /** How many alerts have fallen due (Snake II pauses at each, `StockGames.events`). */
  get queued(): number {
    return this.#queued;
  }

  get pending(): readonly ClockAlert[] {
    return this.#pending.map((entry) => entry.alert);
  }

  /** The alert on screen, if one is. */
  get active(): ClockAlert | undefined {
    return this.#active;
  }

  /**
   * The next alert while the phone shows standby (since `since()`, kernel time; undefined while
   * it is elsewhere; asked only while an alert waits), at once: `deferred` when it fell due before standby was reached,
   * unless it fell due while the alert before it showed (it then follows that one at once). An
   * application whose exit returns to standby. phone-core polls this only while no interruption
   * runs, so a poll also ends the alert shown before.
   */
  interruption(since: () => number | undefined): PhoneApplication | undefined {
    if (this.#active !== undefined) this.#last = { from: this.#activeFrom, to: this.#now() };
    this.#active = undefined;
    const next = this.#pending[0];
    if (next === undefined) return undefined;
    const standbySince = since();
    if (standbySince === undefined) return undefined;
    this.#pending.shift();
    const alert = next.alert;
    const last = this.#last;
    const followsLast = last !== undefined && next.atMs >= last.from && next.atMs <= last.to;
    const deferred = !followsLast && next.atMs < standbySince;
    this.#active = alert;
    this.#activeFrom = this.#now();
    return new StockFlowApplication(`stock:alert:${alert.id}`, () => alert.root(deferred));
  }
}
