// The alarm clock (plan 21 Task 8, Task 0c's captures): its time and On/Off in the clock record,
// the ring at its minute (a one-shot: the alarm is Off once it rings), Snooze (`Snooze active`,
// a new ring 5 minutes later rounded up to a whole minute), the automatic snooze after the
// ring's minute, Stop, and the ring that switches a powered-off phone on (D4, composed).
import type { PhoneApplication, PhoneKey } from "@hellotimber/phone-core";
import type { AlertModel } from "@hellotimber/nokia-kit/ui/display/widgets";
import { CLOCK_ALERTS } from "@hellotimber/nokia-kit/ui/resources";
import type { SoundPlay } from "@hellotimber/nokia-kit/ui/sound/sequencer";
import { confirmQuery } from "@hellotimber/nokia-kit/ui/widgets/confirm";
import {
  StockFlowApplication,
  type Flow,
  type Widget,
} from "@hellotimber/nokia-kit/ui/widgets/flow";
import { freshKeys } from "@hellotimber/nokia-kit/ui/widgets/fresh-keys";
import { note } from "@hellotimber/nokia-kit/ui/widgets/note";
import { timelineByName } from "@hellotimber/nokia-kit/ui/timelines";
import type { StockServices } from "../feature";
import type { AlarmTime } from "@hellotimber/nokia-kit/system/clock/record";
import { alertExit, alertLeadIn } from "@hellotimber/nokia-kit/system/clock/alerts";
import { phoneClock } from "@hellotimber/nokia-kit/system/clock/registry";
import type { StockClock } from "@hellotimber/nokia-kit/system/clock/service";
import { formatClock, minuteIndex, type PhoneTime } from "@hellotimber/nokia-kit/system/clock/time";

/**
 * Screens no capture shows, composed from captured widgets with v6.39's own strings (plan 21 D12,
 * UNVERIFIED in docs/specs/stock/clock-and-reminders.md).
 */
export const COMPOSED_FLOWS = [
  {
    id: "alarm/wake",
    evidence:
      "the emulator cannot advance a powered-off phone (Task 0 P15): the captured ring, then " +
      "`Activate\nphone\nfor calls?` (string 0x0e6) as a confirm query",
  },
] as const;

/**
 * Snooze rings again 5 minutes later rounded up to a whole minute (Task 0: Snooze at 10:11:05
 * re-armed the CCONT alarm for 10:17); nokia-os counts minutes, so the minute after next five.
 */
export const ALARM_SNOOZE_MINUTES = 6;

/**
 * The ring's text first goes off this long after the ring starts (plan21 alarm/ring-factory-
 * standby 918 ms, ring-virgin-standby 931 ms), then blinks every RING_TEXT_MS (both captures:
 * 118-119 steps of 480.96 ms from there; the first shown phase is shorter than a step).
 */
const RING_TEXT_OFF_MS = 925;
const RING_TEXT_MS = 480.96;

/** A text step this close to a bell step is drawn with it (plan21 ring-factory-standby 918 ms). */
const RING_JOIN_MS = 8;

/** The ring's bell steps: the first, the second (held back to the text's first), then every stepMs. */
function ringBellStep(n: number): number {
  const { ring } = CLOCK_ALERTS;
  if (n === 0) return ring.bellsFirstMs;
  if (n === 1) return ring.textFirstMs;
  return ring.bellsFirstMs + n * CLOCK_ALERTS.bells.stepMs;
}

/** Text step `k` (0 shown, 1 hidden, …), drawn with a bell step it falls on. */
function ringTextStep(k: number): number {
  const at = k === 0 ? CLOCK_ALERTS.ring.textFirstMs : RING_TEXT_OFF_MS + (k - 1) * RING_TEXT_MS;
  const n = Math.max(
    0,
    Math.round((at - CLOCK_ALERTS.ring.bellsFirstMs) / CLOCK_ALERTS.bells.stepMs),
  );
  for (const m of [n - 1, n, n + 1]) {
    if (m >= 0 && Math.abs(ringBellStep(m) - at) <= RING_JOIN_MS) return ringBellStep(m);
  }
  return at;
}

/** Whether the ring's `Alarm!` and time show `t` ms into it. */
export function ringTextShown(t: number): boolean {
  const nominal = t < RING_TEXT_OFF_MS ? 0 : 1 + Math.floor((t - RING_TEXT_OFF_MS) / RING_TEXT_MS);
  let k = nominal + 1;
  while (k > 0 && ringTextStep(k) > t) k--;
  if (k === 0 && ringTextStep(0) > t) return false;
  return k % 2 === 0;
}

/** Stop on `Snooze active`: the screen without its ladders this long before `Snooze off`. */
const SNOOZE_OFF_BARE_MS = 20;

const ALARMS = new WeakMap<StockClock, StockAlarm>();

/** The alarm of the phone whose services these are. */
export function phoneAlarm(services: StockServices): StockAlarm {
  const clock = phoneClock(services);
  let alarm = ALARMS.get(clock);
  if (alarm === undefined) {
    alarm = new StockAlarm(clock, services);
    ALARMS.set(clock, alarm);
  }
  return alarm;
}

export class StockAlarm {
  readonly #clock: StockClock;
  readonly #services: StockServices;
  /** A ring or `Snooze active` on screen (their own re-ring replaces them). */
  #shown: { readonly reRing: () => void } | undefined;
  #ringing = false;
  /** While the phone is off: a ring that should switch it on. */
  #wake = false;
  #poweredOn = true;

  constructor(clock: StockClock, services: StockServices) {
    this.#clock = clock;
    this.#services = services;
    clock.onMinute((at) => this.#minute(at));
    clock.addIndicators(() =>
      this.on() || this.snoozed() || this.#ringing ? { alarm: true } : {},
    );
  }

  /** The alarm's time (kept while Off), null in the virgin EEPROM. */
  time(): AlarmTime | null {
    return this.#clock.state().alarm;
  }

  on(): boolean {
    return this.#clock.state().alarmOn;
  }

  snoozed(): boolean {
    return this.#clock.state().snooze !== null;
  }

  set(time: AlarmTime): void {
    this.#clock.update({ alarm: time, alarmOn: true, snooze: null });
  }

  off(): void {
    this.#clock.update({ alarmOn: false, snooze: null });
  }

  /** The phone switched on or off (the alarm wakes a phone that is off, D4). */
  power(on: boolean): void {
    this.#poweredOn = on;
    if (on) this.#wake = false;
  }

  #minute(at: PhoneTime): void {
    const state = this.#clock.state();
    const alarm = state.alarm;
    const due =
      (state.alarmOn && alarm !== null && at.hour === alarm.hour && at.minute === alarm.minute) ||
      (state.snooze !== null && minuteIndex(at) >= state.snooze.dueMinute);
    if (!due) return;
    // A one-shot: the alarm is Off once it rings (plan21 alarm/ring-*-page-after-stop).
    this.#clock.update({ alarmOn: false, snooze: null });
    this.#ringing = true;
    if (!this.#poweredOn) {
      this.#wake = true;
      return;
    }
    if (this.#shown !== undefined) {
      this.#shown.reRing();
      return;
    }
    this.#clock.alerts.queue({
      id: "alarm",
      root: (deferred) =>
        deferred
          ? alertLeadIn(
              () => this.standby(),
              () => this.#ring(true),
            )
          : this.#ring(false),
    });
  }

  /**
   * The ring's widget (`deferred`: shown on the return to standby, after its lead-in: no bells,
   * the text from its first frame, plan21 alarm/ring-elsewhere-*-standby).
   */
  #ring(deferred: boolean, onStop?: (flow: Flow) => void): Widget {
    return new AlarmRing(this, this.#services, deferred, onStop);
  }

  /** D4: the ring that switches a powered-off phone on (composed, UNVERIFIED). */
  wake(): PhoneApplication | undefined {
    if (!this.#wake) return undefined;
    this.#wake = false;
    return new StockFlowApplication("stock:alarm:wake", () =>
      this.#ring(false, (flow) =>
        // Stop: `Activate phone for calls?` (firmware string 0x0e6); Yes switches it on, No off.
        flow.replace(
          freshKeys(
            confirmQuery({
              lines: ["Activate", "phone", "for calls?"],
              softkey: "Yes",
              confirm: (f) => f.standby(),
              cancel: (f) => f.back(),
            }),
          ),
        ),
      ),
    );
  }

  /** @internal The ring's state, for its widgets: `widget` shows the ring (or Snooze active). */
  ringShown(widget: { readonly reRing: () => void }): void {
    this.#shown = widget;
  }

  /** @internal `widget` left the screen (its successor may already have taken its place). */
  ringHidden(widget: { readonly reRing: () => void }): void {
    if (this.#shown === widget) this.#shown = undefined;
  }

  /** @internal Snooze: `Snooze active`, a new ring ALARM_SNOOZE_MINUTES later. */
  snooze(): void {
    const now = this.#clock.now();
    this.#ringing = false;
    if (now === undefined) return;
    this.#clock.update({ snooze: { dueMinute: minuteIndex(now) + ALARM_SNOOZE_MINUTES } });
  }

  /** @internal Stop (or Snooze active's Stop): no ring, no snooze. */
  stop(): void {
    this.#ringing = false;
    this.#clock.update({ snooze: null });
  }

  /** @internal The current time, as the ring shows it. */
  clockText(): string {
    const now = this.#clock.now();
    return now === undefined ? "" : formatClock(now, false);
  }

  /** @internal Standby's clock and indicators, as the alert draws them. */
  standby(): Pick<AlertModel, "clock" | "indicators"> {
    const clock = this.#clock.standbyClock();
    return { ...(clock === undefined ? {} : { clock }), indicators: this.#clock.indicators() };
  }
}

/**
 * The bell picture `elapsed` ms into an alert: the first step at `firstMs`, then every stepMs;
 * `secondMs` holds the second step back to that time (the ring's: its text first shows on that
 * redraw, plan21 alarm/ring-*-standby 464 ms).
 */
export function bellsAt(elapsed: number, firstMs: number, secondMs?: number): string {
  const { sprites, stepMs } = CLOCK_ALERTS.bells;
  let step = elapsed < firstMs ? 0 : 1 + Math.floor((elapsed - firstMs) / stepMs);
  if (secondMs !== undefined && step >= 1) step = elapsed < secondMs ? 1 : Math.max(2, step);
  return sprites[step % sprites.length]!;
}

/** The ringing alarm: `Alarm!` and the time blinking, the bell row, `Snooze`. */
class AlarmRing implements Widget {
  readonly #alarm: StockAlarm;
  readonly #services: StockServices;
  readonly #deferred: boolean;
  readonly #onStop: ((flow: Flow) => void) | undefined;
  #elapsed = 0;
  #sound: SoundPlay | undefined;
  #reRung = false;

  constructor(
    alarm: StockAlarm,
    services: StockServices,
    deferred: boolean,
    onStop: ((flow: Flow) => void) | undefined,
  ) {
    this.#alarm = alarm;
    this.#services = services;
    this.#deferred = deferred;
    this.#onStop = onStop;
    alarm.ringShown(this);
    const { alarm: program } = CLOCK_ALERTS.programs;
    const { stepMs, firstMs } = CLOCK_ALERTS.ascend;
    this.#sound = services.sounder.alert(program, { stepMs, firstMs: firstMs.alarm });
  }

  reRing(): void {
    this.#reRung = true;
  }

  render(): AlertModel {
    const { ring } = CLOCK_ALERTS;
    const first = this.#deferred ? 0 : ring.textFirstMs;
    const t = this.#elapsed;
    const shown = this.#deferred
      ? t >= first && Math.floor((t - first) / ring.textMs) % 2 === 0
      : ringTextShown(t);
    return {
      kind: "alert",
      ...this.#alarm.standby(),
      lines: shown ? ["Alarm!", this.#alarm.clockText()] : [],
      align: "block",
      ...(this.#deferred ? {} : { sprites: [bellsAt(t, ring.bellsFirstMs, ring.textFirstMs)] }),
      softkey: "Snooze",
    };
  }

  tick(dtMs: number, flow: Flow): void {
    this.#elapsed += dtMs;
    if (this.#elapsed >= CLOCK_ALERTS.alarmRingMs) this.#snooze(flow);
  }

  // The ring answers a key as it goes down (plan21 alarm/ring-*-key-c-held: 54 ms into the hold).
  onKeyDown(key: PhoneKey, flow: Flow): void {
    if (key === "navi") {
      this.#snooze(flow);
      return;
    }
    // Any other key stops it (plan21 alarm/ring-*-key-c, up, 5, hash, c-held).
    this.#silence();
    this.#alarm.stop();
    if (this.#onStop !== undefined) this.#onStop(flow);
    else flow.replace(alertExit(() => this.#alarm.standby()));
  }

  #snooze(flow: Flow): void {
    this.#silence();
    this.#alarm.snooze();
    flow.replace(new SnoozeActive(this.#alarm, this.#services));
  }

  #silence(): void {
    if (this.#sound !== undefined) this.#services.sounder.stop(this.#sound);
    this.#sound = undefined;
  }

  close(): void {
    this.#silence();
    this.#alarm.ringHidden(this);
    void this.#reRung;
  }
}

/** Snoozed: `Snooze active` with `Stop` at standby until the next ring (plan21 alarm/ring-*-key-snooze). */
class SnoozeActive implements Widget {
  readonly #alarm: StockAlarm;
  readonly #services: StockServices;
  #reRing = false;
  /** Since Stop: the ladders are cleared first (SNOOZE_OFF_BARE_MS), then `Snooze off`. */
  #stopping: number | undefined;
  readonly #downs = new Set<PhoneKey>();

  constructor(alarm: StockAlarm, services: StockServices) {
    this.#alarm = alarm;
    this.#services = services;
    alarm.ringShown(this);
  }

  reRing(): void {
    this.#reRing = true;
  }

  render(): AlertModel {
    return {
      kind: "alert",
      ...this.#alarm.standby(),
      lines: ["Snooze", "active"],
      align: "left",
      softkey: "Stop",
      ...(this.#stopping === undefined ? {} : { bare: true }),
    };
  }

  tick(dtMs: number, flow: Flow): void {
    if (this.#stopping !== undefined) {
      this.#stopping += dtMs;
      if (this.#stopping >= SNOOZE_OFF_BARE_MS) this.#snoozeOff(flow);
      return;
    }
    if (!this.#reRing) return;
    this.#reRing = false;
    flow.replace(new AlarmRing(this.#alarm, this.#services, false, undefined));
  }

  onKeyDown(key: PhoneKey): void {
    this.#downs.add(key);
  }

  // Stop on release, of a key that went down here (not the ring's Snooze).
  onKey(key: PhoneKey): void {
    if (!this.#downs.delete(key) || key !== "navi" || this.#stopping !== undefined) return;
    this.#stopping = 0;
  }

  #snoozeOff(flow: Flow): void {
    this.#alarm.stop();
    flow.replace(
      note({
        lines: ["Snooze", "off"],
        timeline: timelineByName("snooze-off"),
        end: "back",
        sound: this.#services.noteSound,
      }),
    );
  }

  close(): void {
    this.#alarm.ringHidden(this);
  }
}
