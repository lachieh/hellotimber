// Plan 21's acceptance (docs/plans/21-clock-and-reminders.md Task 12): the clock's, the alarm's,
// the timers' and Reminders' goldens, from the scenarios of tests/support/clock.ts. Timelines
// replay their recording's keys on the parent screen the generator reached; stills replay the
// generator's steps from a fresh phone.
import { expect } from "vite-plus/test";
import { CLOCK_STILLS } from "../../scripts/capture-sets/21-clock-and-reminders.ts";
import { acceptancePlan, type Scenario } from "../support/acceptance.ts";
import {
  clockRig,
  clockScenario,
  play,
  toClock,
  toClockSettings,
  toStandby,
  type ClockRig,
} from "../support/clock.ts";
import { expectLcd } from "../support/golden.ts";
import { goldenImage, loadGolden } from "../support/goldens.ts";
import type { Rig } from "../support/rig.ts";

type RigOptions = Parameters<typeof clockRig>[0];

/** A timeline golden: its parent screen from `setup`, then its keys. */
const timeline =
  (setup: (c: ClockRig) => void, options: RigOptions = {}): Scenario =>
  (id) => {
    const c = clockRig(options);
    setup(c);
    clockScenario(id, c.rig);
  };

/** A still fixture: each image from a fresh phone, by name. */
const stills =
  (images: Readonly<Record<string, (c: ClockRig) => void>>, options: RigOptions = {}): Scenario =>
  (id) => {
    const golden = loadGolden(id);
    expect(golden.images.map((image) => image.name).sort()).toEqual(Object.keys(images).sort());
    for (const [name, setup] of Object.entries(images)) {
      const c = clockRig(options);
      setup(c);
      expectLcd(c.rig.paint(), goldenImage(id, name), `${id} ${name}`);
    }
  };

/** A scroll fixture: image n after n-1 presses of ▼ from `setup`'s screen. */
const scroll =
  (setup: (c: ClockRig) => void, options: RigOptions = {}): Scenario =>
  (id) => {
    const golden = loadGolden(id);
    const c = clockRig(options);
    setup(c);
    golden.images.forEach((image, i) => {
      if (i > 0) play(c.rig, "down +1500");
      expectLcd(c.rig.paint(), goldenImage(id, image.name), `${id} ${image.name}`);
    });
  };

const hide = ({ rig }: ClockRig) => {
  toClockSettings(rig, 0);
  play(rig, "menu +4000");
};
const twelveHour = ({ rig }: ClockRig) => {
  toClockSettings(rig, 2);
  play(rig, "menu +1500 down +1000 menu +4000");
  toStandby(rig);
};
const noTime = { clock: undefined, date: undefined } as const;
const FORMAT_TIMES = ["00:05", "09:41", "12:00", "13:07", "23:59"] as const;
const SET_TIME_VALUES = ["keys", "c", "c-typed", "2500", "1260", "0", "123", "2400", "1959"];
const DATE_VALUES = ["keys", "c", "31022026", "29022026", "29022028", "31042026", "00002026"];

const SCENARIOS: Record<string, Scenario> = {
  // S settings
  "clock/settings/hide": timeline(({ rig }) => toClockSettings(rig, 0)),
  "clock/settings/show": timeline((c) => {
    hide(c);
    toStandby(c.rig);
    toClockSettings(c.rig, 0);
  }),
  "clock/settings/set-time-prompt": timeline(({ rig }) => toClockSettings(rig, 1)),
  ...Object.fromEntries(
    SET_TIME_VALUES.map((v) => [
      `clock/settings/set-time-${v}`,
      timeline(({ rig }) => toClockSettings(rig, 1)),
    ]),
  ),
  "clock/settings/format-choose-12": timeline((c) => {
    c.host.clock = "00:05";
    toClockSettings(c.rig, 2);
    play(c.rig, "menu +1500 down +1000");
  }),
  "clock/settings/format-choose-24": timeline((c) => {
    c.host.clock = "00:05";
    twelveHour(c);
    toClockSettings(c.rig, 2);
    play(c.rig, "menu +1500 up +1000");
  }),
  "clock/settings/screens": stills({
    "standby-hidden": (c) => {
      hide(c);
      toStandby(c.rig);
    },
    "page-hidden": (c) => {
      hide(c);
      toStandby(c.rig);
      toClock(c.rig, 1);
    },
    "list-show": (c) => {
      hide(c);
      toStandby(c.rig);
      toClockSettings(c.rig, 0);
    },
    "standby-shown": (c) => {
      hide(c);
      toStandby(c.rig);
      toClockSettings(c.rig, 0);
      play(c.rig, "menu +4000");
      toStandby(c.rig);
    },
    "standby-0959": ({ rig }) => {
      toClockSettings(rig, 1);
      play(rig, "menu +1500 0 9 5 9 menu +4000");
      toStandby(rig);
    },
  }),
  "clock/settings/format": stills(
    Object.fromEntries(
      FORMAT_TIMES.flatMap((t) => {
        const slug = t.replace(":", "");
        const at = (c: ClockRig) => (c.host.clock = t);
        return [
          [`24-${slug}-standby`, at],
          [
            `24-${slug}-page`,
            (c: ClockRig) => {
              at(c);
              toClock(c.rig, 1);
            },
          ],
          [
            `12-${slug}-standby`,
            (c: ClockRig) => {
              at(c);
              twelveHour(c);
            },
          ],
          [
            `12-${slug}-page`,
            (c: ClockRig) => {
              at(c);
              twelveHour(c);
              toClock(c.rig, 1);
            },
          ],
        ];
      }),
    ),
  ),
  // D date
  "clock/date/prompt": timeline(({ rig }) => toClock(rig, 2)),
  ...Object.fromEntries(
    [...DATE_VALUES, "0110200", "3210", "1913"].map((v) => [
      `clock/date/${v}`,
      timeline(({ rig }) => toClock(rig, 2)),
    ]),
  ),
  "clock/date/screens": stills({
    "page-after": ({ rig }) => {
      toClock(rig, 2);
      play(rig, "menu +1500 1 4 1 0 2 0 2 6 menu +4000");
      toStandby(rig);
      toClock(rig, 2);
    },
  }),
  // N no time
  "clock/no-time/screens": stills({ "standby-first": () => {}, standby: () => {} }, noTime),
  "clock/no-time/clock-pages": scroll(({ rig }) => toClock(rig, 0), noTime),
  ...Object.fromEntries(
    [
      ["date", 2],
      ["auto-update", 5],
    ].map(([name, page]) => [
      `clock/no-time/${name}`,
      timeline(({ rig }) => toClock(rig, page as number), noTime),
    ]),
  ),
  "clock/no-time/clock-settings": timeline(({ rig }) => toClock(rig, 1), noTime),
  "clock/no-time/set-time": timeline(({ rig }) => toClockSettings(rig, 1), noTime),
  // U auto update
  "clock/auto-update/open": timeline(({ rig }) => toClock(rig, 5)),
  "clock/auto-update/list": scroll(({ rig }) => {
    toClock(rig, 5);
    play(rig, "menu +2500");
  }),
  ...Object.fromEntries(
    ["on", "confirm", "off"].map((choice) => [
      `clock/auto-update/choose-${choice}`,
      timeline(({ rig }) => {
        toClock(rig, 5);
        play(rig, "menu +2500");
      }),
    ]),
  ),
};

// Stills fixtures are registered above by id; any CLOCK_STILLS without a scenario stays pending.
void CLOCK_STILLS;
void ({} as Rig);

acceptancePlan({
  plan: "21",
  scenarios: SCENARIOS,
  knownGaps: {
    "clock/settings/format-choose-12":
      "12-hour clock selected plays plan 14's recording of it (tree/11-clock/11-2-3-2.choose, " +
      "owner of node 11-2-3-2's timeline): this capture's steps run 20 ms longer and end on a " +
      "15 ms partial frame",
  },
  // Each image builds a phone and navigates to it (20 images).
  timeoutsMs: { "clock/settings/format": 20_000 },
});
