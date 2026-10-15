// Plan 21's acceptance (docs/plans/21-clock-and-reminders.md Task 12): the clock's, the alarm's,
// the timers' and Reminders' goldens, from the scenarios of tests/support/clock.ts. Timelines
// replay their recording's keys on the parent screen the generator reached; stills replay the
// generator's steps from a fresh phone.
import type { PhoneKey } from "@hellotimber/phone-core";
import { expect } from "vite-plus/test";
import { CLOCK_STILLS } from "../../scripts/capture-sets/21-clock-and-reminders.ts";
import { acceptancePlan, type Scenario } from "../support/acceptance.ts";
import {
  clockRig,
  clockScenario,
  clockSound,
  play,
  setAlarm,
  toClock,
  toClockSettings,
  toStandby,
  untilShows,
  type ClockRig,
} from "../support/clock.ts";
import { CLOCK_ALERTS } from "../../src/resources";
import type { SoundProgram } from "../../src/sound/program";
import { goto } from "../support/drive.ts";
import { TAP_DOWN_MS } from "../support/calculator.ts";
import { STOPWATCH_BLINK_MS } from "../../src/firmware/features/clock/stopwatch";
import { expectLcd, expectTimeline } from "../support/golden.ts";
import { loadSoundGolden } from "../support/sound.ts";
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

/** The alarm set to 10:11, on its On/Off rows (Alarm clock › Select). */
const onOffList = (c: ClockRig) => {
  setAlarm(c.rig, "1011");
  toClock(c.rig, 0);
  play(c.rig, "menu +3000");
};

/**
 * The standby clock in the ring recordings: run_synced set the next minute at each RTC edge,
 * and standby showed 10:12 from 121 s after the ring (plan21 alarm/ring-*-standby, image w).
 */
const RING_NEXT_MINUTE_MS = 121_035 - 1_087;

/** A ring at standby: the alarm 10:11 set, the host's clock moving to 10:11 on the trigger. */
const ring =
  (state: "virgin" | "factory"): Scenario =>
  (id) => {
    const c = clockRig({ state });
    setAlarm(c.rig, "1011");
    clockScenario(id, c.rig, {
      sampled: true,
      edge: {
        host: c.host,
        clock: "10:11",
        later: [{ atMs: RING_NEXT_MINUTE_MS, clock: "10:12" }],
      },
    });
  };

/** On the ring, `ms` in. */
const ringing =
  (ms = 3000) =>
  (c: ClockRig) => {
    setAlarm(c.rig, "1011");
    c.host.clock = "10:11";
    c.rig.advance(ms);
  };

/** A key on the ring: from the ring's picture the recording starts on (`wait_ring`'s poll). */
const ringKey =
  (state: "virgin" | "factory"): Scenario =>
  (id) => {
    const c = clockRig({ state });
    setAlarm(c.rig, "1011");
    c.host.clock = "10:11";
    const rows = loadGolden(id).timeline!;
    untilShows(c.rig, goldenImage(id, rows[0]!.image), 3000);
    clockScenario(id, c.rig);
  };

const RING_STATES = ["factory", "virgin"] as const;

/** An alert program's repeating part, ms. */
const loopMs = ({ steps, loopFrom = 0 }: SoundProgram): number =>
  steps.slice(loopFrom).reduce((ms, step) => ms + step.ms, 0);

/**
 * The minutes standby showed in the re-ring recordings, from their first change (the
 * generator's settime at each RTC edge; the capture's software clock ran a minute behind the
 * RTC after the alarm's minute).
 */
const shownMinutes = (from: number, count: number, stepMs = 60_000) =>
  Array.from({ length: count }, (_, i) => ({
    atMs: (i + 1) * stepMs,
    clock: `10:${String(from + i + 1).padStart(2, "0")}`,
  }));

/** Untouched, the ring snoozes itself; the re-ring 6 minutes after the ring's minute. */
const autoResnooze =
  (state: "virgin" | "factory"): Scenario =>
  (id) => {
    const c = clockRig({ state });
    ringing(RING_NEXT_MINUTE_MS)(c);
    c.host.clock = "10:12";
    c.rig.advance(135_000 - RING_NEXT_MINUTE_MS);
    c.rig.advance(loadGolden(id).timeline![1]!.startMs - 1);
    clockScenario(id, c.rig, {
      sampled: true,
      edge: { host: c.host, clock: "10:13", later: shownMinutes(13, 5) },
    });
  };

/** Snoozed on the ring; the re-ring. */
const resnooze =
  (state: "virgin" | "factory"): Scenario =>
  (id) => {
    const c = clockRig({ state });
    ringing()(c);
    play(c.rig, "menu +8000");
    c.rig.advance(loadGolden(id).timeline![1]!.startMs - 1);
    clockScenario(id, c.rig, {
      sampled: true,
      edge: { host: c.host, clock: "10:12", later: shownMinutes(12, 5) },
    });
  };

/** Where the alarm's minute finds the phone (the generator's `alarm-ring-elsewhere`). */
const ELSEWHERE: Readonly<Record<string, (c: ClockRig) => void>> = {
  "menu-page": ({ rig }) => toClock(rig, 0),
  "menu-list": ({ rig }) => toClockSettings(rig, 0),
  editor: ({ rig }) => play(rig, "menu +300 down +2000 menu +1500 menu +2000"),
  snake: ({ rig }) => {
    goto(rig, "8-1-1");
    play(rig, "+1000 menu +1000");
  },
};

/** The ring after C held from `where`, 20 s after the alarm's minute. */
const elsewhereStandby =
  (where: string): Scenario =>
  (id) => {
    const c = clockRig({ state: "factory" });
    setAlarm(c.rig, "1011");
    ELSEWHERE[where]!(c);
    c.host.clock = "10:11";
    c.rig.advance(20_000);
    clockScenario(id, c.rig);
  };

/** Countdown timer › Start `hhmm` from its idle prompt; the kernel time it expires. */
const startCountdown = ({ rig }: ClockRig, hhmm: string): number => {
  toClock(rig, 4);
  play(rig, `menu +2500 ${hhmm.split("").join(" ")}`);
  // Start goes on the key's release (TAP_DOWN_MS after it goes down).
  const startedAt = rig.now + TAP_DOWN_MS;
  play(rig, "menu +4000");
  return startedAt + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2))) * 60_000;
};

/** A 5-minute countdown 70 s in, on its Change time / Stop timer rows (the generator's order). */
const countdownList = (c: ClockRig) => {
  startCountdown(c, "0005");
  c.rig.advance(66_000);
  toStandby(c.rig);
  c.rig.advance(5000);
  toClock(c.rig, 4);
  play(c.rig, "menu +3000");
};

/** A 1-minute countdown from standby, 1 ms before it expires. */
const beforeExpiry = (c: ClockRig) => {
  const endsAt = startCountdown(c, "0001");
  toStandby(c.rig);
  c.rig.advance(endsAt - 1 - c.rig.now);
};

/**
 * The countdown's alert 2 s in, a key: the recordings' first change is a bell step 8 ms after the
 * key went down, the key's own redraw the next (frame 2). The bells are lined up on frame 1 (a
 * step after the picture frame 0 shows) and the key goes down on frame 2's row.
 */
const expireKey =
  (key: PhoneKey, holdMs = 0): Scenario =>
  (id) => {
    const c = clockRig({ state: "factory" });
    beforeExpiry(c);
    c.rig.advance(2000);
    const golden = loadGolden(id);
    const rows = golden.timeline!;
    untilShows(c.rig, goldenImage(id, rows[0]!.image), 3000);
    // The record's trigger is 1 ms in: the bell step falls on it.
    c.rig.advance(Math.round(CLOCK_ALERTS.bells.stepMs) - 2);
    const at = Math.round(rows[2]!.startMs - rows[1]!.startMs);
    const last = rows[rows.length - 1]!;
    const recorded = c.rig.record(
      last.startMs + last.durationMs - rows[1]!.startMs + 100,
      () => {},
      [
        { atMs: at, run: () => c.rig.hold(key) },
        { atMs: at + holdMs, run: () => c.rig.release(key) },
      ],
    );
    expectTimeline(recorded, golden, `${id}: ${key} on frame 2`);
  };

/** Where the expiry finds the phone (the generator's `countdown-expiry`). */
const EXPIRE_ELSEWHERE: Readonly<Record<string, (c: ClockRig) => void>> = {
  "menu-page": ({ rig }) => toClock(rig, 0),
  "menu-list": ({ rig }) => toClockSettings(rig, 0),
  editor: ({ rig }) => play(rig, "menu +300 down +2000 menu +1500 menu +2000"),
  snake: ({ rig }) => {
    goto(rig, "8-1-1");
    play(rig, "+1000 menu +1000");
  },
};

/** The countdown's alert after C held from `where`, 20 s after the expiry. */
const expireElsewhereStandby =
  (where: string): Scenario =>
  (id) => {
    const c = clockRig({ state: "factory" });
    const endsAt = startCountdown(c, "0001");
    toStandby(c.rig);
    if (where === "note") {
      toClockSettings(c.rig, 0);
      c.rig.advance(endsAt - 600 - c.rig.now);
      play(c.rig, "menu");
    } else {
      EXPIRE_ELSEWHERE[where]!(c);
    }
    c.rig.advance(endsAt + 20_000 - c.rig.now);
    clockScenario(id, c.rig);
  };

/** The stopwatch's screen from standby (Clock › Stopwatch › Select). */
const toStopwatch = ({ rig }: ClockRig) => {
  toClock(rig, 3);
  play(rig, "menu +2500");
};

/** Started, run `ms`, stopped (the generator's 60 s run unless said). */
const stoppedAfter = (c: ClockRig, ms = 60_000) => {
  toStopwatch(c);
  c.rig.press("navi");
  c.rig.advance(ms);
  c.rig.press("navi");
  c.rig.advance(3000);
};

/** Stopped after 60 s, its Options open. */
const stopwatchOptions = (c: ClockRig) => {
  stoppedAfter(c);
  play(c.rig, "menu +2500");
};

/** How long `toClock(rig, 3)` takes. */
const TO_CLOCK_MS = (() => {
  const { rig } = clockRig();
  const from = rig.now;
  toClock(rig, 3);
  return rig.now - from;
})();

/** The stopwatch's time when stopwatch/reentry-standby opens it again (its frame c). */
const REENTRY_STANDBY_MS = 63_600;

/** A stopwatch golden with the running digits' tolerance. */
const stopwatch =
  (setup: (c: ClockRig) => void, options: RigOptions = {}): Scenario =>
  (id) => {
    const c = clockRig(options);
    setup(c);
    clockScenario(id, c.rig, { stopwatch: true });
  };

const SCENARIOS: Record<string, Scenario> = {
  // W stopwatch
  "clock/stopwatch/open": timeline(({ rig }) => toClock(rig, 3)),
  "clock/no-time/stopwatch": timeline(({ rig }) => toClock(rig, 3), noTime),
  "clock/stopwatch/run": stopwatch(toStopwatch),
  "clock/stopwatch/stop": stopwatch((c) => {
    toStopwatch(c);
    c.rig.press("navi");
    c.rig.advance(60_000);
  }),
  "clock/stopwatch/options-open": stopwatch((c) => stoppedAfter(c)),
  "clock/stopwatch/options": scroll(stopwatchOptions),
  "clock/stopwatch/resume": stopwatch(stopwatchOptions),
  "clock/stopwatch/stop-again": stopwatch((c) => {
    stopwatchOptions(c);
    play(c.rig, "menu +5000");
  }),
  "clock/stopwatch/reset": stopwatch(stopwatchOptions),
  "clock/stopwatch/start-after-reset": stopwatch((c) => {
    stopwatchOptions(c);
    play(c.rig, "down +1500 menu +3000");
  }),
  "clock/stopwatch/exit": stopwatch(stopwatchOptions),
  "clock/stopwatch/reentry-after-exit": stopwatch((c) => {
    stopwatchOptions(c);
    play(c.rig, "down +1500 down +1500 menu +3000");
    toClock(c.rig, 3);
  }),
  "clock/stopwatch/options-c": stopwatch(stopwatchOptions),
  "clock/stopwatch/options-c-c": stopwatch((c) => {
    stopwatchOptions(c);
    play(c.rig, "c +2500");
  }),
  "clock/stopwatch/c-running": stopwatch((c) => {
    toStopwatch(c);
    play(c.rig, "menu +3000");
  }),
  "clock/stopwatch/reentry": stopwatch((c) => {
    toStopwatch(c);
    play(c.rig, "menu +3000 c +2500");
  }),
  "clock/stopwatch/c-held-running": stopwatch((c) => {
    toStopwatch(c);
    play(c.rig, "menu +3000 c +2500 menu +3000");
  }),
  "clock/stopwatch/c-held-again": stopwatch((c) => {
    toStopwatch(c);
    play(c.rig, "menu +3000 c +2500 menu +3000 c@1500 +4000");
  }),
  "clock/stopwatch/standby": (id) => {
    const c = clockRig();
    toStopwatch(c);
    play(c.rig, "menu +3000");
    toStandby(c.rig);
    const rows = loadGolden(id).timeline!;
    untilShows(c.rig, goldenImage(id, rows[0]!.image), 1000);
    c.rig.advance(STOPWATCH_BLINK_MS - 2);
    clockScenario(id, c.rig, { edge: { host: c.host, clock: c.host.clock! } });
  },
  "clock/stopwatch/reentry-standby": stopwatch((c) => {
    // The generator's order: C, back in, C held twice, standby to a minute edge, back in.
    toStopwatch(c);
    const started = c.rig.now + TAP_DOWN_MS;
    play(c.rig, "menu +3000 c +2500 menu +3000 c@1500 +4000 c@1500 +4000");
    toStandby(c.rig);
    c.rig.advance(started + REENTRY_STANDBY_MS - TO_CLOCK_MS - c.rig.now);
    toClock(c.rig, 3);
  }),
  "clock/stopwatch/c-stopped": stopwatch((c) => {
    toStopwatch(c);
    play(c.rig, "menu +3000 menu +1500");
  }),
  "clock/stopwatch/reentry-stopped": stopwatch((c) => {
    toStopwatch(c);
    play(c.rig, "menu +3000 menu +1500 c +2500");
  }),
  "clock/countdown/expire-elsewhere-stopwatch-standby": stopwatch((c) => {
    startCountdown(c, "0001");
    toStandby(c.rig);
    toClock(c.rig, 3);
    play(c.rig, "menu +2500");
    const started = c.rig.now + TAP_DOWN_MS;
    play(c.rig, "menu +1000");
    // The recording starts with the stopwatch at 55.79 s, past the expiry.
    c.rig.advance(started + 55_790 - c.rig.now);
  }),
  // T countdown
  "clock/countdown/prompt": timeline(({ rig }) => toClock(rig, 4)),
  "clock/countdown/prompt-c": timeline(({ rig }) => toClock(rig, 4)),
  ...Object.fromEntries(
    ["keys", "0000", "2400", "9959", "2359", "0", "006"].map((v) => [
      `clock/countdown/${v}`,
      timeline(({ rig }) => toClock(rig, 4)),
    ]),
  ),
  "clock/countdown/open-running": timeline((c) => {
    countdownList(c);
    toStandby(c.rig);
    toClock(c.rig, 4);
  }),
  "clock/countdown/list": scroll(countdownList),
  "clock/countdown/stop": timeline(countdownList),
  "clock/countdown/change": timeline(countdownList),
  "clock/countdown/change-keys": timeline((c) => {
    countdownList(c);
    play(c.rig, "menu +3000");
  }),
  "clock/countdown/list-c": timeline(countdownList),
  "clock/countdown/screens": stills({
    "page-30s": (c) => {
      startCountdown(c, "0005");
      c.rig.advance(26_000);
    },
    "page-70s": (c) => {
      startCountdown(c, "0005");
      c.rig.advance(66_000);
    },
    "standby-icon": (c) => {
      startCountdown(c, "0005");
      c.rig.advance(66_000);
      toStandby(c.rig);
    },
    "standby-stopped": (c) => {
      countdownList(c);
      play(c.rig, "down +1500 menu +4000");
      toStandby(c.rig);
    },
  }),
  "clock/countdown/expire-standby": (id) => {
    const c = clockRig({ state: "factory" });
    beforeExpiry(c);
    clockScenario(id, c.rig, { sampled: true });
  },
  "clock/countdown/expire-virgin": (id) => {
    const c = clockRig();
    beforeExpiry(c);
    clockScenario(id, c.rig, { sampled: true });
  },
  "clock/countdown/expire-key-ok": expireKey("navi"),
  "clock/countdown/expire-key-c": expireKey("c"),
  "clock/countdown/expire-key-5": expireKey("5"),
  "clock/countdown/expire-key-up": expireKey("up"),
  "clock/countdown/expire-key-c-held": expireKey("c", 1500),
  "clock/countdown/expire-elsewhere-note": (id) => {
    const c = clockRig({ state: "factory" });
    const endsAt = startCountdown(c, "0001");
    toStandby(c.rig);
    toClockSettings(c.rig, 0);
    c.rig.advance(endsAt - 600 - c.rig.now);
    clockScenario(id, c.rig);
  },
  ...Object.fromEntries(
    [...Object.keys(EXPIRE_ELSEWHERE), "note"].map((where) => [
      `clock/countdown/expire-elsewhere-${where}-standby`,
      expireElsewhereStandby(where),
    ]),
  ),
  "clock/no-time/countdown": timeline(({ rig }) => toClock(rig, 4), noTime),
  ...Object.fromEntries(
    RING_STATES.map((state) => [
      `sound/clock/countdown-${state}`,
      (id: string) => {
        const c = clockRig(state === "factory" ? { state } : {});
        const endsAt = startCountdown(c, "0001");
        toStandby(c.rig);
        const golden = loadSoundGolden(id);
        c.rig.advance(endsAt - golden.rows[0]!.ms - c.rig.now);
        clockSound(id, c.rig, () => {});
      },
    ]),
  ),
  // A alarm
  "clock/alarm/prompt": timeline(({ rig }) => toClock(rig, 0)),
  "clock/alarm/set": timeline(({ rig }) => toClock(rig, 0)),
  "clock/alarm/on-off-open": timeline((c) => {
    setAlarm(c.rig, "1011");
    toClock(c.rig, 0);
  }),
  "clock/alarm/on": timeline(onOffList),
  "clock/alarm/change": timeline((c) => {
    onOffList(c);
    play(c.rig, "menu +3000");
  }),
  "clock/alarm/on-c": timeline(onOffList),
  "clock/alarm/off": timeline(onOffList),
  "clock/alarm/on-off-c": timeline(onOffList),
  "clock/alarm/off-prompt": timeline((c) => {
    onOffList(c);
    play(c.rig, "down +1500 menu +4000");
    toStandby(c.rig);
    toClock(c.rig, 0);
  }),
  "clock/alarm/on-off": scroll((c) => onOffList(c)),
  ...Object.fromEntries(
    ["111", "1111", "1112"].map((digits) => [
      `clock/alarm/shortcut-${digits}`,
      (id: string) => {
        const c = clockRig();
        setAlarm(c.rig, "1011");
        clockScenario(id, c.rig);
      },
    ]),
  ),
  "clock/alarm/screens": stills({
    page: ({ rig }) => {
      toClock(rig, 0);
      play(rig, "menu +2500 1 0 1 1 menu +4000");
    },
    "standby-icon": ({ rig }) => setAlarm(rig, "1011"),
    "standby-off": (c) => {
      onOffList(c);
      play(c.rig, "down +1500 menu +4000");
      toStandby(c.rig);
    },
  }),
  ...Object.fromEntries(
    RING_STATES.flatMap((state) => [
      [`clock/alarm/ring-${state}-standby`, ring(state)],
      [`clock/alarm/ring-${state}-resnooze`, resnooze(state)],
      [`clock/alarm/ring-${state}-auto-resnooze`, autoResnooze(state)],
      ...["snooze", "c", "up", "5", "hash", "c-held"].map((key) => [
        `clock/alarm/ring-${state}-key-${key}`,
        ringKey(state),
      ]),
      [
        `clock/alarm/ring-${state}-snooze-stop`,
        timeline(
          (c) => {
            ringing()(c);
            play(c.rig, "menu +8000");
          },
          { state },
        ),
      ],
      [
        `clock/alarm/ring-${state}-screens`,
        stills(
          {
            [`ring-${state}-after-untouched`]: (c) => {
              ringing(RING_NEXT_MINUTE_MS)(c);
              c.host.clock = "10:12";
              c.rig.advance(135_000 - RING_NEXT_MINUTE_MS);
            },
            [`ring-${state}-snoozed-standby`]: (c) => {
              ringing()(c);
              play(c.rig, "menu +8000");
            },
            [`ring-${state}-page-after-stop`]: (c) => {
              ringing()(c);
              play(c.rig, "c +8000");
              toClock(c.rig, 0);
            },
            [`ring-${state}-page-after-snooze-stop`]: (c) => {
              ringing()(c);
              play(c.rig, "menu +8000 menu +6000");
              toClock(c.rig, 0);
            },
          },
          { state },
        ),
      ],
    ]),
  ),
  "clock/alarm/ring-elsewhere-menu-page": (id) => {
    const c = clockRig({ state: "factory" });
    setAlarm(c.rig, "1011");
    toClock(c.rig, 0);
    clockScenario(id, c.rig, { edge: { host: c.host, clock: "10:11" } });
  },
  ...Object.fromEntries(
    Object.keys(ELSEWHERE).map((where) => [
      `clock/alarm/ring-elsewhere-${where}-standby`,
      elsewhereStandby(where),
    ]),
  ),
  ...Object.fromEntries(
    RING_STATES.map((state) => [
      `sound/clock/alarm-${state}`,
      (id: string) => {
        const c = clockRig({ state });
        setAlarm(c.rig, "1011");
        clockSound(id, c.rig, () => (c.host.clock = "10:11"));
      },
    ]),
  ),
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
    "clock/stopwatch/c-held-again":
      "C held on the Stopwatch page: v6.39 goes back a level as C goes down and reaches standby " +
      "≈475 ms later; the kernel's long press (phone-core LONG_PRESS_MS, plan 14) at 800 ms",
    ...Object.fromEntries(
      [...Object.keys(EXPIRE_ELSEWHERE), "note"].map((where) => [
        `clock/countdown/expire-elsewhere-${where}-standby`,
        "C held: v6.39 goes back a level as C goes down and reaches standby ≈475 ms later; " +
          "the kernel's long press (phone-core LONG_PRESS_MS, plan 14) reaches standby at 800 ms. " +
          "The alert after standby is checked from the standby frame in tests/clock-countdown.test.ts",
      ]),
    ),
    ...Object.fromEntries(
      ["1111", "1112"].map((digits) => [
        `clock/alarm/shortcut-${digits}`,
        "Menu 1 1 1 then a digit: v6.39 takes the digit into the alarm's On/Off rows (D9's " +
          "Deviation); nokia-os's 11-1 is an application, where the kernel's shortcut ends",
      ]),
    ),
    ...Object.fromEntries(
      RING_STATES.flatMap((state) =>
        ["resnooze", "auto-resnooze"].map((kind) => [
          `clock/alarm/ring-${state}-${kind}`,
          "standby's digits ran a minute behind the RTC in this capture (the generator's " +
            "settime at each edge): the CCONT alarm re-rang at RTC 10:17, 5 minutes after the " +
            "snooze rounded up (as nokia-os rings), while standby showed 10:16",
        ]),
      ),
    ),
    ...Object.fromEntries(
      Object.keys(ELSEWHERE).map((where) => [
        `clock/alarm/ring-elsewhere-${where}-standby`,
        "C held: v6.39 goes back a level as C goes down and reaches standby ≈475 ms later; " +
          "the kernel's long press (phone-core LONG_PRESS_MS, plan 14) reaches standby at 800 ms. " +
          "The ring after standby is checked from the standby frame in tests/clock-alarm.test.ts",
      ]),
    ),
  },
  // Each image builds a phone and navigates to it (20 images); the rings run 135 s each.
  timeoutsMs: {
    "clock/settings/format": 20_000,
    ...Object.fromEntries(
      RING_STATES.flatMap((state) => [
        [`clock/alarm/ring-${state}-standby`, 60_000],
        [`clock/alarm/ring-${state}-screens`, 60_000],
        [`clock/alarm/ring-${state}-resnooze`, 120_000],
        [`clock/alarm/ring-${state}-auto-resnooze`, 120_000],
        [`clock/countdown/expire-${state === "factory" ? "standby" : "virgin"}`, 60_000],
      ]),
    ),
  },
});
