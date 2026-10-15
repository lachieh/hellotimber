// Plan 21's resource evidence (plan 29 registration): the clock's standby indicators, the am/pm
// marks, the reminder icons, the alerts' bell pictures and the clock's note icons, and the named
// notes the clock and Reminders show.
import type { ResourceDeclarations } from "../resource-declarations.ts";

/** The note icons' rectangle (plan 14's `NOTE_ICON`). */
const NOTE_ICON = { x0: 63, x1: 83, y0: 1, y1: 23 } as const;
/** The alerts' bell row (clear of the ladders, the antenna and the battery icon). */
const BELLS = { x0: 5, x1: 78, y0: 26, y1: 35 } as const;

export const resources: ResourceDeclarations = {
  textRuns: {
    // Auto update's page after Confirm first: its value in the thin face (C, f, i, r, s drawn
    // nowhere else in it).
    "clock/auto-update/choose-confirm": {
      f: [{ font: "thin", text: "Confirm first", top: 29, left: 28, right: 79 }],
    },
    // View all's header: the reminder's number, and its alarm's time and date in the digits
    // face, right-aligned (the face's `.` and space are drawn nowhere else).
    "reminders/view-3-keys": {
      a: [
        { font: "digits", text: "1", top: 0, left: 0, right: 5 },
        { font: "digits", text: "10:11 13.10", top: 0, left: 28, right: 83 },
      ],
    },
  },
  spriteBatches: [
    {
      order: 210,
      entries: [
        // Standby: the indicators left of the clock and the 12-hour marks after it (plan21
        // settings/format, alarm, countdown, stopwatch standby).
        {
          id: "clock/alarm",
          group: "clock-standby",
          golden: "clock/alarm/screens",
          image: "standby-icon",
          x0: 40,
          x1: 45,
          y0: 0,
          y1: 5,
        },
        {
          id: "clock/timer",
          group: "clock-standby",
          golden: "clock/countdown/screens",
          image: "standby-icon",
          x0: 38,
          x1: 45,
          y0: 0,
          y1: 5,
        },
        {
          id: "clock/stopwatch",
          group: "clock-standby",
          golden: "clock/stopwatch/standby",
          image: "b",
          x0: 39,
          x1: 45,
          y0: 0,
          y1: 5,
        },
        {
          id: "clock/am",
          group: "clock-standby",
          golden: "clock/settings/format",
          image: "12-0005-standby",
          x0: 74,
          x1: 76,
          y0: 0,
          y1: 2,
        },
        {
          id: "clock/pm",
          group: "clock-standby",
          golden: "clock/settings/format",
          image: "12-1307-standby",
          x0: 74,
          x1: 76,
          y0: 3,
          y1: 5,
        },
        // Reminders: the alert's icon, and View all's (with an alarm, without one).
        {
          id: "reminder/alert",
          group: "clock-reminder",
          golden: "reminders/alert-key-snooze",
          image: "a",
          x0: 65,
          x1: 76,
          y0: 7,
          y1: 14,
        },
        {
          id: "reminder/alarm",
          group: "clock-reminder",
          golden: "reminders/view-3-keys",
          image: "a",
          x0: 0,
          x1: 13,
          y0: 7,
          y1: 14,
        },
        {
          id: "reminder/note",
          group: "clock-reminder",
          golden: "reminders/view-3-keys",
          image: "c",
          x0: 0,
          x1: 13,
          y0: 7,
          y1: 14,
        },
        // The clock's note icons: Time is set and Clock displayed (an alarm clock), and Reminder
        // erased's dustbin, six poses (plan21 reminders/erase-one-yes b-g).
        {
          id: "note/alarm-clock",
          group: "note-icon",
          golden: "clock/settings/set-time-keys",
          image: "l",
          ...NOTE_ICON,
        },
        {
          id: "note/clock-displayed",
          group: "note-icon",
          golden: "clock/settings/show",
          image: "b",
          ...NOTE_ICON,
        },
        ...(["b", "c", "d", "e", "f", "g"] as const).map((image, i) => ({
          id: `note/dustbin-${i + 1}`,
          group: "note-icon",
          golden: "reminders/erase-one-yes",
          image,
          ...NOTE_ICON,
        })),
        // The alerts' bell row: the countdown's nine positions (plan21 countdown/expire-standby
        // b-j, one every ≈232 ms).
        ...(["b", "c", "d", "e", "f", "g", "h", "i", "j"] as const).map((image, i) => ({
          id: `clock/bells-${i + 1}`,
          group: "clock-bells",
          golden: "clock/countdown/expire-standby",
          image,
          ...BELLS,
        })),
      ],
    },
  ],
  timelineBatches: [
    {
      order: 210,
      entries: [
        { golden: "clock/settings/hide", kind: "note", name: "clock-hidden" },
        { golden: "clock/settings/show", kind: "note", name: "clock-displayed" },
        { golden: "clock/settings/set-time-keys", kind: "note", name: "time-is-set" },
        { golden: "clock/date/keys", kind: "note", name: "date-is-set" },
        { golden: "clock/date/31022026", kind: "note", name: "invalid-date" },
        { golden: "clock/countdown/0", kind: "note", name: "invalid-time" },
        { golden: "clock/no-time/alarm", kind: "note", name: "clock-not-set" },
        { golden: "clock/alarm/set", kind: "note", name: "alarm-on" },
        { golden: "clock/alarm/off", kind: "note", name: "alarm-off" },
        { golden: "clock/alarm/ring-factory-snooze-stop", kind: "note", name: "snooze-off" },
        { golden: "clock/countdown/keys", kind: "note", name: "timer-running" },
        { golden: "clock/countdown/stop", kind: "note", name: "timer-stopped" },
        { golden: "reminders/add-alarm-off", kind: "note", name: "reminder-set" },
        { golden: "reminders/erase-one-yes", kind: "note", name: "reminder-erased" },
        // Auto update › Confirm first's Done (no tree recording of its own: plan 14 has 11-6-1's).
        { golden: "clock/auto-update/choose-confirm", kind: "note", node: "11-6-2" },
      ],
    },
  ],
};
