// The clock's alerts (plan 21 D3, Task 0): the alarm, the countdown's expiry, reminders and
// Auto update's notes wait in a queue and show one at a time when the phone is at standby (v6.39
// shows none over a menu, a note, an editor or a game), through phone-core's `interruption`.
import type { PhoneApplication } from "@hellotimber/phone-core";
import { StockFlowApplication, type Widget } from "../../../widgets/flow";

/** One alert: what it shows (a flow of widgets; its end returns to standby). */
export interface ClockAlert {
  readonly id: string;
  readonly root: () => Widget;
}

/**
 * An alert that arrives while the phone is elsewhere shows this long after standby is drawn
 * again (plan21 `*-elsewhere-*-standby`: standby, then the alert ≈85-115 ms later).
 */
export const ALERT_AT_STANDBY_MS = 85;

export class StockAlerts {
  readonly #now: () => number;
  readonly #pending: { readonly alert: ClockAlert; readonly atMs: number }[] = [];
  #active: ClockAlert | undefined;

  /** `now`: the kernel time. */
  constructor(now: () => number) {
    this.#now = now;
  }

  /** Queues `alert` (`first`: ahead of the others). */
  queue(alert: ClockAlert, options: { readonly first?: boolean } = {}): void {
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

  get pending(): readonly ClockAlert[] {
    return this.#pending.map((entry) => entry.alert);
  }

  /** The alert on screen, if one is. */
  get active(): ClockAlert | undefined {
    return this.#active;
  }

  /**
   * The next alert while the phone shows standby (since `standbySince`, kernel time; undefined
   * while it is elsewhere): at once when it fell due at standby, else ALERT_AT_STANDBY_MS after
   * standby is drawn. An application whose exit returns to standby. phone-core polls this only
   * while no interruption runs, so a poll also ends the alert shown before.
   */
  interruption(standbySince: number | undefined): PhoneApplication | undefined {
    this.#active = undefined;
    const next = this.#pending[0];
    if (standbySince === undefined || next === undefined) return undefined;
    if (next.atMs < standbySince && this.#now() - standbySince < ALERT_AT_STANDBY_MS) {
      return undefined;
    }
    this.#pending.shift();
    const alert = next.alert;
    this.#active = alert;
    return new StockFlowApplication(`stock:alert:${alert.id}`, alert.root);
  }
}
