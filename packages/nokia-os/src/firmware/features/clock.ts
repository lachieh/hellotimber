// Clock (menu 11; plan 21): phone time over the host clock (D1) on the Clock pages and standby,
// Clock settings (Hide clock / Show clock, Set the time, Time format), Date setting, and the
// clock's records. The alarm, the stopwatch and the countdown add their screens in their tasks.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { PromptLayout } from "../../widgets/prompt";
import type { Flow, Widget } from "../../widgets/flow";
import { confirmQuery } from "../../widgets/confirm";
import { note, type NoteOptions } from "../../widgets/note";
import { Playback } from "../../widgets/playback";
import { timeEntry, type EntryMask } from "../../widgets/time-entry";
import type { EepromRecord } from "../eeprom";
import { timelineById, timelineByName } from "../timelines";
import { WIDGET_TIMELINE_BY_NODE } from "../../resources";
import { CLOCK_RECORD } from "./clock/record";
import { phoneClock } from "./clock/registry";
import { TIME_FORMAT } from "./clock/service";
import { formatClock, formatDate, parseHostTime } from "./clock/time";
import type { StockFeature, StockServices } from "./feature";

export { TIME_FORMAT };

const PEN_BOX_START: PromptLayout = { icons: ["pen"], entry: "start" };

/** The widget timeline of node `node`'s own recording (plan 14): an entry's cursor, a note. */
export function entryBlink(node: string) {
  const id = WIDGET_TIMELINE_BY_NODE[node];
  if (id === undefined) throw new Error(`No cursor timeline for ${node}.`);
  return timelineById(id, `the entry at ${node}`);
}

/** A note from a named timeline (`lines` as the firmware draws them). */
export function clockNote(
  services: StockServices,
  lines: readonly string[],
  name: string,
  end: NoteOptions["end"] = "back",
): Widget {
  return note({ lines, timeline: timelineByName(name), end, sound: services.noteSound });
}

/**
 * A note that, when it ends (or a key ends it), is replaced by `next` instead of going back:
 * `Clock needs to be set first`, then the `Time:` entry (plan21 no-time/*).
 */
export function noteThen(inner: Widget, next: () => Widget): Widget {
  const redirect = (flow: Flow): Flow => ({
    ...flow,
    push: (w) => flow.push(w),
    replace: (w) => flow.replace(w),
    back: () => flow.replace(next()),
    standby: () => flow.standby(),
    indicator: () => flow.indicator(),
  });
  return {
    render: (flow) => inner.render(redirect(flow)),
    onKey: (key: PhoneKey, flow) => inner.onKey?.(key, redirect(flow)),
    onKeyDown: (key: PhoneKey, flow) => inner.onKeyDown?.(key, redirect(flow)),
    tick: (dt, flow) => inner.tick?.(dt, redirect(flow)),
    close: () => inner.close?.(),
  };
}

/** A time or date entry with the prompt's pen, `label` and soft key. */
export function clockEntry(
  services: StockServices,
  options: {
    readonly label: string;
    readonly softkey?: string;
    readonly mask: EntryMask;
    readonly initial?: string;
    readonly node: string;
    readonly done: (value: string, flow: Flow) => void;
    readonly validate?: (value: string) => readonly string[] | undefined;
    /** The cursor's blink, when it is not the node's own from its start. */
    readonly blink?: Playback;
  },
): Widget & ReturnType<typeof timeEntry> {
  return timeEntry({
    icons: ["prompt/pen"],
    label: [options.label],
    softkey: options.softkey ?? "OK",
    mask: options.mask,
    ...(options.initial === undefined ? {} : { initial: options.initial }),
    blink: options.blink ?? entryBlink(options.node),
    invalid: timelineByName(options.mask === "hh:mm" ? "invalid-time" : "invalid-date"),
    sound: services.noteSound,
    done: options.done,
    ...(options.validate === undefined ? {} : { validate: options.validate }),
  });
}

/** `Time:` on the phone's time (`hh:mm` without one), then `Time is set` and `after`. */
export function setTimeEntry(services: StockServices, end: NoteOptions["end"]): Widget {
  const clock = phoneClock(services);
  const now = clock.now();
  // Without a time, `hh:mm` shows its cursor a blink step later (plan21 no-time/set-time).
  const blink = new Playback(entryBlink("11-2-2"));
  if (now === undefined) blink.advance(blink.timeline.timeline.steps[0]?.durationMs ?? 0);
  return clockEntry(services, {
    blink,
    label: "Time:",
    mask: "hh:mm",
    ...(now === undefined ? {} : { initial: formatClock(now, false) }),
    node: "11-2-2",
    done: (value, flow) => {
      clock.setTime(Number(value.slice(0, 2)), Number(value.slice(3)));
      flow.replace(clockNote(services, ["Time", "is set"], "time-is-set", end));
    },
  });
}

/**
 * Without a time (the host gives none): `Clock needs to be set first`, then the `Time:` entry
 * (plan21 no-time/alarm, date, reminder); else `open()`.
 */
export function needsClock(services: StockServices, open: () => Widget): Widget {
  if (phoneClock(services).now() !== undefined) return open();
  return noteThen(clockNote(services, ["Clock", "needs to", "be set first"], "clock-not-set"), () =>
    setTimeEntry(services, "back"),
  );
}

/** Auto update of date and time (11-6): On, Confirm first, Off (virgin Off, unset). */
export const AUTO_UPDATE = {
  key: "clock/auto-update-of-date-and-time",
  on: 0,
  confirm: 1,
} as const;

/**
 * Auto update at the end of power-on (D13): the network's time is the host's, so On clears the
 * phone's offset (`Date and time updated` at standby when that changed its time) and Confirm
 * first asks first (`Update date and time of the phone?`, OK clears it). The note's place (the
 * capture shows it during the boot, after the security code) is UNVERIFIED for nokia-os.
 */
export function autoUpdate(services: StockServices): void {
  const clock = phoneClock(services);
  const choice = services.settings.choice(AUTO_UPDATE.key);
  if (choice === AUTO_UPDATE.on && clock.clearOffset()) {
    clock.alerts.queue({
      id: "date-and-time-updated",
      root: () => clockNote(services, ["Date and", "time", "updated"], "reminder-set", "standby"),
    });
  }
  if (choice === AUTO_UPDATE.confirm && clock.offsetMinutes() !== 0) {
    clock.alerts.queue({
      id: "update-date-and-time",
      root: () =>
        confirmQuery({
          lines: ["Update date", "and time of", "the phone?"],
          softkey: "OK",
          confirm: (flow) => {
            clock.clearOffset();
            flow.standby();
          },
          cancel: (flow) => flow.standby(),
        }),
    });
  }
}

export const clockFeature: StockFeature = {
  name: "clock",
  placeholders: {
    "11-4": "21", // Stopwatch
  },
  screens: {
    // Hide clock / Show clock (plan21 settings/hide, show): the note, then the Clock settings page.
    "11-2-1": (services) => () => {
      const clock = phoneClock(services);
      const hidden = clock.hidden();
      clock.setHidden(!hidden);
      // Clock hidden plays plan 14's own recording of it (`tree/11-clock/11-2-1.leaf`).
      return hidden
        ? clockNote(services, ["Clock", "displayed"], "clock-displayed", { levels: 2 })
        : note({
            lines: ["Clock", "hidden"],
            timeline: entryBlink("11-2-1"),
            end: { levels: 2 },
            sound: services.noteSound,
          });
    },
    // Set the time (plan21 settings/set-time-*): `Time is set`, then the Clock settings page.
    "11-2-2": (services) => () => setTimeEntry(services, { levels: 2 }),
    // Date setting (plan21 date/*): `Date is set`, then its page.
    "11-3": (services) => () =>
      needsClock(services, () => {
        const clock = phoneClock(services);
        return clockEntry(services, {
          label: "Date:",
          mask: "dd.mm.yyyy",
          initial: formatDate(clock.now()!),
          node: "11-3",
          done: (value, flow) => {
            const [day, month, year] = value.split(".").map(Number);
            clock.setDate(day!, month!, year!);
            flow.replace(clockNote(services, ["Date", "is set"], "date-is-set"));
          },
        });
      }),
  },
  labels: {
    // Hide clock reads Show clock while the clock is hidden or there is no time to show
    // (plan21 settings/list-show, no-time/clock-settings).
    "11-2": (services, child) => {
      const clock = phoneClock(services);
      return child === "hide-clock" && (clock.hidden() || clock.now() === undefined)
        ? "Show clock"
        : undefined;
    },
  },
  widgets: {
    promptLayouts: {
      "11-1": PEN_BOX_START,
      "11-2-2": PEN_BOX_START,
      "11-3": PEN_BOX_START,
      "11-5": PEN_BOX_START,
    },
    // Clock settings returns to its page (`tree/11-clock/11-2-3-1.choose` image e).
    noteEnds: { "11-2-3-*": { levels: 2 } },
  },
  settings: {
    // The Clock pages show the phone's time (D1): the clock in the chosen Time format, the date;
    // without a time `--:--` and `--.--.----` (plan21 no-time/clock-pages).
    hostValues: {
      "clock/clock-settings": (ports, settings) => {
        const now = parseHostTime(ports.clock?.(), ports.date?.() ?? "01.01.2000");
        if (now === undefined) return "--:--";
        return formatClock(now, settings.choice(TIME_FORMAT.key) === TIME_FORMAT.twelveHour);
      },
      "clock/date-setting": (ports) => {
        const now = parseHostTime(ports.clock?.() ?? "00:00", ports.date?.());
        return now === undefined ? "--.--.----" : formatDate(now);
      },
    },
  },
  // Plan 21 D7: the alarm, its snooze, the time offset and Hide clock.
  records: [CLOCK_RECORD as EepromRecord<unknown>],
};
