// The reminders' alerts (plan 21 D2, D3, Task 0): at each minute edge while the phone is on, the
// reminders due (their alarm or snooze minute reached, also after a jump over it or while the
// phone was off) queue an alert each, the later-added first; it shows at standby: the text, the
// reminder icon, `Snooze`, the buzzer until a key. Snooze: `Alarm postponed for 10 min`, then
// it alerts again 10 minutes later; any other key ends it.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { AlertModel } from "../../../kit/ui/display/widgets";
import { CLOCK_ALERTS } from "../../../kit/ui/resources";
import type { SoundPlay } from "../../../kit/ui/sound/sequencer";
import type { Flow, Widget } from "../../../kit/ui/widgets/flow";
import type { StockServices } from "../feature";
import {
  alertExit,
  alertLeadIn,
  StandbyFrame,
  ALERT_EXIT_MS,
  standbyOf,
  type AlertStandby,
} from "../clock/alerts";
import { phoneClock } from "../clock/registry";
import type { StockClock } from "../clock/service";
import { minuteIndex } from "../clock/time";
import { REMINDER_SNOOZE_MINUTES, StockReminders, type Reminder } from "./store";

/** Snooze clears the ladders this long before `Alarm postponed` (plan21 alert-key-snooze 17 ms). */
const POSTPONED_BARE_MS = 17;
/** `Alarm postponed for 10 min` shows this long (plan21 reminders/alert-key-snooze 1488 ms). */
const POSTPONED_MS = 1488;

/** The reminder text's lines on the alert: small face, from x 6, this wide before the icon. */
const ALERT_TEXT_WIDTH = 58;

const SERVICES = new WeakMap<StockClock, PhoneReminders>();

/** The reminders of the phone whose services these are. */
export function phoneReminders(services: StockServices): PhoneReminders {
  const clock = phoneClock(services);
  let reminders = SERVICES.get(clock);
  if (reminders === undefined) {
    reminders = new PhoneReminders(clock, services);
    SERVICES.set(clock, reminders);
  }
  return reminders;
}

export class PhoneReminders {
  readonly store: StockReminders;
  readonly #clock: StockClock;
  readonly #services: StockServices;
  #poweredOn = true;

  constructor(clock: StockClock, services: StockServices) {
    this.#clock = clock;
    this.#services = services;
    this.store = new StockReminders(services.eeprom);
    clock.onMinute((at) => this.#minute(at));
  }

  /** The phone switched on or off: due reminders wait for the first edge after power-on. */
  power(on: boolean): void {
    this.#poweredOn = on;
  }

  /** An erased reminder's queued alert goes too. */
  erased(reminder: Reminder): void {
    this.#clock.alerts.drop((alert) => alert.id === idOf(reminder));
  }

  #minute(at: Parameters<StockReminders["due"]>[0]): void {
    if (!this.#poweredOn) return;
    for (const reminder of this.store.due(at)) {
      this.store.answered(reminder, null);
      const standby: AlertStandby = () => standbyOf(this.#clock);
      this.#clock.alerts.queue({
        id: idOf(reminder),
        root: (deferred) => {
          const alert = () => new ReminderAlert(this, this.#services, reminder, standby);
          return deferred ? alertLeadIn(standby, alert) : alert();
        },
      });
    }
  }

  /** @internal Snooze on `reminder`'s alert: it alerts again REMINDER_SNOOZE_MINUTES later. */
  snooze(reminder: Reminder): void {
    const now = this.#clock.now();
    if (now === undefined) return;
    this.store.answered(reminder, minuteIndex(now) + REMINDER_SNOOZE_MINUTES);
  }

  /** @internal The clock as standby shows it (the postponed note keeps it). */
  standbyClock(): string | undefined {
    return this.#clock.standbyClock();
  }
}

const idOf = (reminder: Reminder): string => `reminder:${reminder.added}`;

/** A reminder's text as the alert breaks it: small-face lines ALERT_TEXT_WIDTH wide, at most 3. */
function alertLines(text: string): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    // ≈6 px a character in the small face (UNVERIFIED for long texts: no capture shows one).
    if (line !== "" && (line.length + 1) * 6 > ALERT_TEXT_WIDTH) {
      lines.push(line);
      line = ch === " " ? "" : ch;
    } else line += ch;
  }
  if (line !== "") lines.push(line);
  return lines.slice(0, 3);
}

/**
 * The reminder's alert (plan21 reminders/alert-*): static; the buzzer until a key, which acts as
 * it goes down.
 */
class ReminderAlert implements Widget {
  readonly #reminders: PhoneReminders;
  readonly #services: StockServices;
  readonly #reminder: Reminder;
  readonly #standby: AlertStandby;
  #sound: SoundPlay | undefined;

  constructor(
    reminders: PhoneReminders,
    services: StockServices,
    reminder: Reminder,
    standby: AlertStandby,
  ) {
    this.#reminders = reminders;
    this.#services = services;
    this.#reminder = reminder;
    this.#standby = standby;
    const { stepMs, firstMs } = CLOCK_ALERTS.ascend;
    this.#sound = services.sounder.alert(CLOCK_ALERTS.programs.reminder, {
      stepMs,
      firstMs: firstMs.reminder,
    });
  }

  render(): AlertModel {
    return {
      kind: "alert",
      ...this.#standby(),
      lines: alertLines(this.#reminder.text),
      align: "left",
      sprites: ["reminder/alert"],
      softkey: "Snooze",
    };
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    this.#silence();
    if (key !== "navi") {
      flow.replace(alertExit(this.#standby));
      return;
    }
    this.#reminders.snooze(this.#reminder);
    const clock = this.#reminders.standbyClock();
    const shown = clock === undefined ? {} : { clock };
    // The ladders go first (17 ms), then the note (clock top right, no ladders), then standby.
    flow.replace(
      new TimedModel({ ...this.render(), bare: true }, POSTPONED_BARE_MS, (f) =>
        f.replace(
          new TimedModel(
            {
              kind: "alert",
              ...shown,
              lines: ["Alarm", "postponed", `for ${REMINDER_SNOOZE_MINUTES} min`],
              align: "edge",
              softkey: "",
              bare: true,
            },
            POSTPONED_MS,
            (g) => g.replace(new StandbyFrame(this.#standby, ALERT_EXIT_MS, (h) => h.back())),
          ),
        ),
      ),
    );
  }

  #silence(): void {
    if (this.#sound !== undefined) this.#services.sounder.stop(this.#sound);
    this.#sound = undefined;
  }

  close(): void {
    this.#silence();
  }
}

/** A fixed picture for `ms`, then `then`. */
class TimedModel implements Widget {
  readonly #model: AlertModel;
  readonly #ms: number;
  readonly #then: (flow: Flow) => void;
  #elapsed = 0;

  constructor(model: AlertModel, ms: number, then: (flow: Flow) => void) {
    this.#model = model;
    this.#ms = ms;
    this.#then = then;
  }

  render(): AlertModel {
    return this.#model;
  }

  tick(dtMs: number, flow: Flow): void {
    this.#elapsed += dtMs;
    if (this.#elapsed >= this.#ms) this.#then(flow);
  }
}
