// Plan 21's acceptance (docs/plans/21-clock-and-reminders.md Task 12): the clock's, the alarm's,
// the timers' and Reminders' goldens, from the scenarios of tests/support/clock.ts. Timelines
// replay their recording's keys on the parent screen the generator reached; stills replay the
// generator's steps from a fresh phone.
import type { PhoneKey } from "@hellotimber/phone-core";
import { expect } from "vite-plus/test";
import { CLOCK_STILLS } from "../../scripts/capture-sets/21-clock-and-reminders.ts";
import { acceptancePlan, type Scenario } from "../support/acceptance.ts";
import {
  addReminder,
  blinkScenario,
  recordingOf,
  clockRig,
  clockScenario,
  eraseAllReminders,
  clockSound,
  play,
  setAlarm,
  toClock,
  toClockSettings,
  toReminders,
  toStandby,
  untilShows,
  type ClockRig,
  type HostClock,
} from "../support/clock.ts";
import { CLOCK_ALERTS } from "../../src/kit/ui/resources";
import { goto } from "../support/drive.ts";
import { TAP_DOWN_MS } from "../support/calculator.ts";
import { STOPWATCH_BLINK_MS } from "../../src/firmware/features/clock/stopwatch";
import { expectLcd, expectTimeline, lcdMismatch } from "../support/golden.ts";
import { expectSoundTimeline, loadSoundGolden } from "../support/sound.ts";
import { goldenImage, loadGolden } from "../support/goldens.ts";
import { seededStorage, stockRig, type Rig } from "../support/rig.ts";
import type { StockStorage } from "../../src/index";
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import { SNAKE_SETTINGS } from "../../src/widgets/snake";

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

// R reminders: the generator's `reminders` section (virgin), from its forks' parents.

/**
 * A recording the generator took before the one a scenario plays (`take`): each key tapped
 * (60 ms) `gap` ms after the previous, then `tail` ms, so prompts' cursors keep their phase.
 */
const took = ({ rig }: ClockRig, keys: string, gap = 600, tail = 3000) => {
  for (const key of keys.split(" ")) {
    rig.press(key === "menu" ? "navi" : (key as PhoneKey), 60);
    rig.advance(gap - 60);
  }
  rig.advance(tail);
};

/** The empty Reminders level (the virgin junk reminder erased: `erase_all`). */
const emptyReminders = ({ rig }: ClockRig) => {
  eraseAllReminders(rig);
  toReminders(rig, 0);
};
const addOpen = (c: ClockRig) => {
  emptyReminders(c);
  took(c, "menu");
};
/** `Remind about:` holding `A`. */
const textTyped = (c: ClockRig) => {
  addOpen(c);
  play(c.rig, "2 +1600");
};
const alarmChoice = (c: ClockRig) => {
  textTyped(c);
  took(c, "menu", 600, 2500);
};
const dateOpen = (c: ClockRig) => {
  alarmChoice(c);
  took(c, "menu");
};
const timeOpen = (c: ClockRig) => {
  dateOpen(c);
  took(c, "menu");
};
/** `n` characters typed into `Remind about:` (2 and 3 alternately, 1 s apart). */
const typeText = ({ rig }: ClockRig, n: number) => {
  for (let i = 0; i < n; i++) play(rig, `${i % 2 === 0 ? "2" : "3"} +1000`);
  rig.advance(1000);
};

/** View all's reminders, added in the generator's order: `A` 10:11, `De` no alarm, `Ggg` 12:00. */
const VIEW_REMINDERS = [
  { text: "2", hhmm: "1011" },
  { text: "3 3", alarm: false },
  { text: "4 4 4", hhmm: "1200" },
] as const;
const withReminders = (n: number) => (c: ClockRig) => {
  eraseAllReminders(c.rig);
  for (const reminder of VIEW_REMINDERS.slice(0, n)) addReminder(c.rig, reminder);
};
const viewLevel = (n: number) => (c: ClockRig) => {
  withReminders(n)(c);
  toReminders(c.rig, 1);
};
const viewOpen = (n: number) => (c: ClockRig) => {
  viewLevel(n)(c);
  took(c, "menu");
};
const viewKeys = (n: number) => (c: ClockRig) => {
  viewOpen(n)(c);
  took(c, "down down down up", 1500, 2000);
};
const viewOptions = (n: number) => (c: ClockRig) => {
  viewKeys(n)(c);
  took(c, "menu", 600, 2500);
};
const eraseOpen = (c: ClockRig) => {
  withReminders(3)(c);
  toReminders(c.rig, 2);
  took(c, "menu", 600, 2500);
};
/** Ten reminders without an alarm (the generator's `reminders-full`). */
const fullMemory = ({ rig }: ClockRig) => {
  eraseAllReminders(rig);
  for (let n = 0; n < 10; n++) {
    toReminders(rig, 0);
    play(rig, `menu +2500 ${2 + (n % 8)} +1600 menu +2000 down +1000 menu +4000`);
    toStandby(rig);
  }
};

/**
 * Sound golden `id`: the alert from the minute edge (its first event), then its keys (Navi) at
 * the golden's key times (t 0 = the first key).
 */
const reminderSound = (id: string, c: ClockRig) => {
  const golden = loadSoundGolden(id);
  const start = c.rig.now;
  const seen = c.rig.sounds.length;
  c.host.clock = "10:11";
  // The edge's tick starts the alert: golden t 0 is that much later.
  const origin = start - golden.rows[0]!.ms;
  const keyTimes = (golden.keys ?? []).map((k) => k.ms);
  for (const at of keyTimes) {
    c.rig.advance(origin + at - c.rig.now);
    c.rig.press("navi");
  }
  c.rig.advance(origin + golden.rows.at(-1)!.ms + 500 - c.rig.now);
  expectSoundTimeline(
    { originMs: origin, endMs: c.rig.now, events: c.rig.sounds.slice(seen) },
    golden,
    `${id}: ${golden.note ?? ""}`,
  );
};

/** The kernel's long press: the power key turns the phone on this long after it goes down. */
const POWER_LONG_PRESS_MS = 800;

/** A recording on a blinking prompt (`blinkScenario`): its blink edge row and its keys' rows. */
const onBlink =
  (setup: (c: ClockRig) => void, edgeRow: number, keyRows: readonly number[]): Scenario =>
  (id) => {
    const c = clockRig();
    setup(c);
    blinkScenario(id, c.rig, edgeRow, keyRows);
  };

/** A timeline from the first moment `setup`'s screen shows the golden's frame 0 (a cursor). */
const fromFrame0 =
  (setup: (c: ClockRig) => void): Scenario =>
  (id) => {
    const c = clockRig();
    setup(c);
    untilShows(c.rig, goldenImage(id, loadGolden(id).timeline![0]!.image), 1000);
    clockScenario(id, c.rig);
  };

// R reminder alerts: the generator's `reminder-alerts` sections (factory unless said), the
// reminder `A` at 10:11 (`add_reminder`), the host clock moved as `settime` moved the phone's.

/** A phone holding the reminder `A` at 10:11 (and `more`), at standby at 10:10. */
const withAlert = (
  state: "factory" | "virgin" = "factory",
  more: string[] = [],
  storage?: StockStorage,
): ClockRig => {
  const c = clockRig({
    ...(state === "factory" ? { state } : {}),
    ...(storage === undefined ? {} : { storage }),
    multitap: true,
  });
  addReminder(c.rig);
  for (const text of more) addReminder(c.rig, { text });
  return c;
};

/** The alert 3 s in (`alert_now`, then 3 s), from the moment it shows golden `id`'s frame 0. */
const alertShown = (id: string): ClockRig => {
  const c = withAlert();
  c.host.clock = "10:11";
  c.rig.advance(3000);
  untilShows(c.rig, goldenImage(id, loadGolden(id).timeline![0]!.image), 1000);
  return c;
};

/** Snoozed at 10:11 (the alert-key-snooze recording, then 6 s). */
const snoozed = (): ClockRig => {
  const c = withAlert();
  c.host.clock = "10:11";
  c.rig.advance(3000);
  play(c.rig, "menu +6000");
  return c;
};

/**
 * Where the reminder's minute finds the phone (the generator's `reminder-alerts` elsewhere): the
 * screen, then the recording's trigger, `edgeMs` before the minute edge.
 */
const ALERT_ELSEWHERE: Readonly<Record<string, { setup: (c: ClockRig) => void; edgeMs: number }>> =
  {
    "menu-page": { setup: ({ rig }) => toClock(rig, 0), edgeMs: 3000 },
    "menu-list": { setup: ({ rig }) => toClockSettings(rig, 0), edgeMs: 3000 },
    note: { setup: ({ rig }) => toClockSettings(rig, 0), edgeMs: 600 },
    "option-list": {
      setup: ({ rig }) => {
        toClockSettings(rig, 2);
        play(rig, "menu +1500");
      },
      edgeMs: 3000,
    },
    editor: {
      setup: ({ rig }) => play(rig, "menu +300 down +2000 menu +1500 menu +2000"),
      edgeMs: 3000,
    },
    snake: {
      setup: ({ rig }) => {
        goto(rig, "8-1-1");
        rig.advance(1000);
      },
      edgeMs: 3000,
    },
  };

/** The recording elsewhere: its keys from the trigger, the minute `edgeMs` after it. */
/** The factory state with Snake II at level 1, as the plan21 factory image had it. */
const factoryLevel1 = (): StockStorage => {
  const storage = seededStorage({ factory: true });
  createStockSettings(new StockEeprom(storage)).setNumber(SNAKE_SETTINGS.level, 1);
  return storage;
};

const alertElsewhere =
  (where: string): Scenario =>
  (id) => {
    const c = withAlert("factory", [], where === "snake" ? factoryLevel1() : undefined);
    const { setup, edgeMs } = ALERT_ELSEWHERE[where]!;
    setup(c);
    const rows = loadGolden(id).timeline!;
    const keyed = recordingOf(id).keys.length > 0;
    if (!keyed) {
      // The first change is the screen's own (the editor's cursor blink): start 1 ms before one.
      const next = goldenImage(id, rows[1]!.image);
      while (lcdMismatch(c.rig.paint().pixels, next, "") === undefined) c.rig.advance(1);
      untilShows(c.rig, next, 2000);
      c.rig.advance(959);
    }
    clockScenario(id, c.rig, {
      edge: {
        host: c.host,
        clock: "10:10",
        later: [{ atMs: Math.round(edgeMs - rows[1]!.startMs), clock: "10:11" }],
      },
    });
  };

/** C held 15 s after the reminder's minute found the phone elsewhere. */
const alertElsewhereStandby =
  (where: string): Scenario =>
  (id) => {
    const c = withAlert("factory", [], where === "snake" ? factoryLevel1() : undefined);
    const { setup, edgeMs } = ALERT_ELSEWHERE[where]!;
    setup(c);
    if (where === "note") play(c.rig, "menu");
    c.rig.advance(edgeMs);
    c.host.clock = "10:11";
    c.rig.advance(15_000);
    clockScenario(id, c.rig);
  };

// F persistence and Restore: the generator's `persist_state`, then a power cycle or Restore.

/** Alarm 10:11, two reminders at 12:00 (today, tomorrow), time 11:00, countdown 00:05, 12-hour. */
const persistState12h = ({ rig }: ClockRig) => {
  setAlarm(rig, "1011");
  addReminder(rig, { hhmm: "1200" });
  addReminder(rig, { text: "3", hhmm: "1200", date: "14102026" });
  toClockSettings(rig, 1);
  play(rig, "menu +2500 1 1 0 0 menu +4000");
  toStandby(rig);
  toClock(rig, 4);
  play(rig, "menu +2500 0 0 0 5 menu +4000");
  toStandby(rig);
  toClockSettings(rig, 2);
  play(rig, "menu +1500 down +800 menu +4000");
  toStandby(rig);
};
/** …and Hide clock. */
const persistState = (c: ClockRig) => {
  persistState12h(c);
  toClockSettings(c.rig, 0);
  play(c.rig, "menu +4000");
  toStandby(c.rig);
};
/** The power key held until the phone is off, then pressed until it is on (`saveflash`, `reboot`). */
const powerCycle = ({ rig }: ClockRig) => {
  rig.press("power", 2500);
  rig.advance(3000);
  rig.press("power", 1000);
  rig.advance(3000);
};
const rebooted = (c: ClockRig) => {
  persistState(c);
  powerCycle(c);
};
/** Settings › Restore factory settings (Menu 6 4), its code typed. */
const restorePrompt = (c: ClockRig) => {
  persistState(c);
  play(c.rig, "menu 6 4 +1500 1 2 3 4 5");
};
const restored = (c: ClockRig) => {
  restorePrompt(c);
  play(c.rig, "menu +8000");
  toStandby(c.rig);
};
/** View all after `setup` (the generator's `persist_after` view shot). */
const viewAfter = (setup: (c: ClockRig) => void) => (c: ClockRig) => {
  setup(c);
  toReminders(c.rig, 1);
  play(c.rig, "menu +2500");
};

const PERSIST_SCENARIOS: Record<string, Scenario> = {
  "clock/persist/screens": stills({
    "before-standby-12h": persistState12h,
    "before-standby": persistState,
    "after-reboot-standby": rebooted,
    "after-reboot-view": viewAfter(rebooted),
  }),
  "clock/persist/before-clock-pages": scroll((c) => {
    persistState(c);
    toClock(c.rig, 0);
  }),
  "clock/persist/after-reboot-clock-pages": scroll((c) => {
    rebooted(c);
    toClock(c.rig, 0);
  }),
  "clock/persist/after-reboot-reminders": scroll((c) => {
    rebooted(c);
    toReminders(c.rig, 0);
  }),
  "clock/restore/screens": stills({
    "before-standby-12h": persistState12h,
    "before-standby": persistState,
    "after-standby": restored,
    "after-view": viewAfter(restored),
  }),
  "clock/restore/run": timeline(restorePrompt),
  "clock/restore/before-clock-pages": scroll((c) => {
    persistState(c);
    toClock(c.rig, 0);
  }),
  "clock/restore/after-clock-pages": scroll((c) => {
    restored(c);
    toClock(c.rig, 0);
  }),
  "clock/restore/after-reminders": scroll((c) => {
    restored(c);
    toReminders(c.rig, 0);
  }),
  // Reminders due while the phone was off (`reminders-power-on`, factory): 10:11 and 10:12,
  // powered off, on again at 10:15; they alert at the first minute edge after power-on.
  "reminders/power-on-screens": stills(
    {
      "power-on-standby": (c) => {
        addReminder(c.rig);
        addReminder(c.rig, { text: "3", hhmm: "1012" });
        c.rig.press("power", 2500);
        c.rig.advance(3000);
        c.host.clock = "10:15";
        c.rig.press("power", 1000);
        c.rig.advance(30_000);
      },
    },
    { state: "factory" },
  ),
  "reminders/power-on-minute": (id) => {
    const c = clockRig({ state: "factory" });
    addReminder(c.rig);
    addReminder(c.rig, { text: "3", hhmm: "1012" });
    c.rig.press("power", 2500);
    c.rig.advance(3000);
    c.host.clock = "10:15";
    c.rig.press("power", 1000);
    c.rig.advance(30_000);
    clockScenario(id, c.rig, { edge: { host: c.host, clock: "10:16" } });
  },
  // The power key's profile list (plan 17), then its long press switches the phone off.
  "clock/alarm/power-off": timeline(({ rig }) => setAlarm(rig, "1011")),
  // Opened and left with C held: the Stopwatch page.
  "clock/stopwatch/power-off": timeline(({ rig }) => {
    toClock(rig, 3);
    play(rig, "menu +3000 c@1500 +1500");
  }),
  // Auto update On and a boot whose network time is an hour from the phone's
  // (`auto-update/boot-on-hour`, Phone security On): here the phone's time is set an hour behind
  // the host's (its offset), and the power-on clears it.
  "clock/auto-update/boot-on-hour": (id) => {
    const host: HostClock = { clock: "10:10", date: "13.10.2026" };
    const rig = stockRig({
      clock: () => host.clock,
      date: () => host.date,
      storage: seededStorage(),
      t9: {},
    });
    const powerOn = () => play(rig, "power@1000 +9000 1 2 3 4 5 menu +9000");
    powerOn();
    toClock(rig, 5);
    play(rig, "menu +1500 up up menu +4000");
    toClockSettings(rig, 1);
    play(rig, "menu +2500 0 9 1 0 menu +4000");
    toStandby(rig);
    rig.press("power", 2500);
    rig.advance(3000);
    const golden = loadGolden(id);
    const rows = golden.timeline!;
    const origin = rows[1]!.startMs;
    rig.hold("power");
    rig.advance(POWER_LONG_PRESS_MS - 2);
    const schedule = recordingOf(id).keys.map(([key, down]) => ({
      atMs: Math.round((rows.find((r) => r.startMs > down)?.startMs ?? down) - origin),
      run: () => rig.press(key === "menu" ? "navi" : (key as PhoneKey)),
    }));
    const last = rows[rows.length - 1]!;
    const recorded = rig.record(
      last.startMs + last.durationMs - origin + 100,
      () => {
        rig.advance(1);
        rig.release("power");
      },
      schedule,
    );
    expectTimeline(recorded, golden, `${id}: power on, the code`);
  },
};

const REMINDER_SCENARIOS: Record<string, Scenario> = {
  ...PERSIST_SCENARIOS,
  "reminders/alert-standby": (id) => {
    const c = withAlert();
    clockScenario(id, c.rig, { edge: { host: c.host, clock: "10:11" } });
  },
  "reminders/alert-virgin": (id) => {
    const c = withAlert("virgin");
    clockScenario(id, c.rig, { edge: { host: c.host, clock: "10:11" } });
  },
  "reminders/alert-two": (id) => {
    const c = withAlert("factory", ["3"]);
    clockScenario(id, c.rig, { edge: { host: c.host, clock: "10:11" } });
  },
  "reminders/alert-jump-over": (id) => {
    const c = withAlert();
    clockScenario(id, c.rig, { edge: { host: c.host, clock: "10:25" } });
  },
  ...Object.fromEntries(
    ["snooze", "c", "up", "5", "c-held", "power"].map((key) => [
      `reminders/alert-key-${key}`,
      (id: string) => clockScenario(id, alertShown(id).rig),
    ]),
  ),
  ...Object.fromEntries(
    ["1020", "1021", "1022"].map((hhmm) => [
      `reminders/alert-resnooze-${hhmm}`,
      (id: string) => {
        const c = snoozed();
        clockScenario(id, c.rig, {
          edge: { host: c.host, clock: `${hhmm.slice(0, 2)}:${hhmm.slice(2)}` },
        });
      },
    ]),
  ),
  ...Object.fromEntries(
    ["note", "editor", "snake"].map((where) => [
      `reminders/alert-elsewhere-${where}`,
      alertElsewhere(where),
    ]),
  ),
  ...Object.fromEntries(
    Object.keys(ALERT_ELSEWHERE).map((where) => [
      `reminders/alert-elsewhere-${where}-standby`,
      alertElsewhereStandby(where),
    ]),
  ),
  "reminders/alert-over-countdown": (id) => {
    const c = withAlert();
    const endsAt = startCountdown(c, "0001");
    toStandby(c.rig);
    c.rig.advance(endsAt + 100 - c.rig.now);
    const rows = loadGolden(id).timeline!;
    untilShows(c.rig, goldenImage(id, rows[0]!.image), 3000);
    // The record's trigger is 1 ms in: the bell step falls on it.
    c.rig.advance(Math.round(CLOCK_ALERTS.bells.stepMs) - 2);
    const keyDown = recordingOf(id).keys[0]![1];
    clockScenario(id, c.rig, {
      edge: {
        host: c.host,
        clock: "10:10",
        // tominute(15000) ran 15 s past the edge before the key.
        later: [{ atMs: Math.round(keyDown - 15_000 - rows[1]!.startMs), clock: "10:11" }],
      },
    });
  },
  "sound/clock/reminder-factory": (id) => {
    const c = withAlert("factory", ["3"]);
    reminderSound(id, c);
  },
  "sound/clock/reminder-virgin": (id) => {
    const c = withAlert("virgin");
    reminderSound(id, c);
  },

  "reminders/level-virgin": scroll(({ rig }) => toReminders(rig, 0)),
  "reminders/virgin-view": timeline(({ rig }) => toReminders(rig, 0)),
  "reminders/virgin-erase-open": timeline(({ rig }) => toReminders(rig, 0)),
  "reminders/virgin-erase-one": timeline((c) => {
    toReminders(c.rig, 0);
    took(c, "down down menu", 1500, 2500);
  }),
  "reminders/virgin-erase-all": timeline(({ rig }) => {
    toReminders(rig, 0);
    play(rig, "down down menu +2000");
  }),
  "reminders/virgin-erase-all-yes": timeline((c) => {
    toReminders(c.rig, 0);
    play(c.rig, "down down menu +2000");
    took(c, "down menu", 1500, 2500);
  }),
  "reminders/level-empty": scroll((c) => {
    toReminders(c.rig, 0);
    play(c.rig, "down down menu +2000");
    took(c, "down menu", 1500, 2500);
    took(c, "menu", 600, 5000);
  }),
  "reminders/add-open": timeline(emptyReminders),
  "reminders/text": stills(
    Object.fromEntries(
      [1, 20, 35, 36].map((n) => [
        `text-${n}`,
        (c: ClockRig) => {
          addOpen(c);
          typeText(c, n);
        },
      ]),
    ),
  ),
  "reminders/add-c-empty": timeline(addOpen),
  "reminders/add-c-text": onBlink(textTyped, 2, [1, 5]),
  "reminders/add-text-ok": fromFrame0(textTyped),
  "reminders/alarm-choice": scroll(alarmChoice),
  "reminders/add-alarm-off": timeline(alarmChoice),
  "reminders/add-choice-c": timeline(alarmChoice),
  "reminders/add-date-open": timeline(alarmChoice),
  "reminders/add-date-c": timeline(dateOpen),
  ...Object.fromEntries(
    ["31022026", "12102026", "01012027", "29022028"].map((v) => [
      `reminders/add-date-${v}`,
      timeline(dateOpen),
    ]),
  ),
  "reminders/add-time-open": onBlink(dateOpen, 2, [1]),
  "reminders/add-time-c": onBlink(timeOpen, 1, [2]),
  ...Object.fromEntries(
    ["0900", "1010", "2500", "0"].map((v) => [`reminders/add-time-${v}`, timeline(timeOpen)]),
  ),
  "reminders/add-save": timeline(timeOpen),
  ...Object.fromEntries(
    [1, 2, 3].flatMap((n) => [
      [`reminders/view-${n}`, timeline(viewLevel(n))],
      // View all with one reminder: ▲/▼ change nothing (`view-1-keys` is not imported).
      ...(n === 1 ? [] : [[`reminders/view-${n}-keys`, timeline(viewOpen(n))]]),
      [`reminders/view-${n}-options`, timeline(viewKeys(n))],
      [`reminders/view-${n}-options-list`, scroll(viewOptions(n))],
      [`reminders/view-${n}-erase`, timeline(viewOptions(n))],
      [`reminders/view-${n}-edit`, timeline(viewOptions(n))],
      [`reminders/view-${n}-send`, timeline(viewOptions(n))],
      [
        `reminders/view-${n}-edit-ok`,
        timeline((c) => {
          viewOptions(n)(c);
          took(c, "down menu", 1200, 4000);
        }),
      ],
      [`reminders/view-${n}-options-c`, timeline(viewOptions(n))],
      [
        `reminders/view-${n}-c`,
        timeline((c) => {
          viewOptions(n)(c);
          took(c, "c", 600, 2500);
        }),
      ],
    ]),
  ),
  "reminders/erase-open": timeline((c) => {
    withReminders(3)(c);
    toReminders(c.rig, 2);
  }),
  "reminders/erase-one": timeline(eraseOpen),
  "reminders/erase-one-down": timeline((c) => {
    eraseOpen(c);
    took(c, "menu");
  }),
  "reminders/erase-one-ok": timeline((c) => {
    eraseOpen(c);
    took(c, "menu");
    took(c, "down", 600, 2000);
  }),
  "reminders/erase-one-yes": timeline((c) => {
    eraseOpen(c);
    took(c, "menu");
    took(c, "down", 600, 2000);
    took(c, "menu");
  }),
  "reminders/erase-one-next": timeline((c) => {
    eraseOpen(c);
    took(c, "menu");
    took(c, "down", 600, 2000);
    took(c, "menu");
    took(c, "menu", 600, 4000);
  }),
  "reminders/erase-all": timeline(eraseOpen),
  "reminders/erase-all-c": timeline((c) => {
    eraseOpen(c);
    took(c, "down menu", 1200, 2500);
  }),
  "reminders/erase-all-yes": timeline((c) => {
    eraseOpen(c);
    took(c, "down menu", 1200, 2500);
  }),
  "reminders/full-screens": stills(
    Object.fromEntries(
      ["full-after-adds", "full-at-add"].map((name) => [
        name,
        (c: ClockRig) => {
          fullMemory(c);
          toReminders(c.rig, 0);
          play(c.rig, "menu +2500");
        },
      ]),
    ),
  ),
  "reminders/full-add": timeline((c) => {
    fullMemory(c);
    toReminders(c.rig, 0);
  }),
  "reminders/full-yes": timeline((c) => {
    fullMemory(c);
    toReminders(c.rig, 0);
    took(c, "menu", 600, 4000);
  }),
  "reminders/full-no": timeline((c) => {
    fullMemory(c);
    toReminders(c.rig, 0);
    took(c, "menu", 600, 4000);
  }),
  "reminders/full-view": timeline((c) => {
    fullMemory(c);
    toReminders(c.rig, 1);
  }),
};

const SCENARIOS: Record<string, Scenario> = {
  ...REMINDER_SCENARIOS,
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
  "clock/no-time/alarm": timeline(({ rig }) => toClock(rig, 0), noTime),
  "clock/no-time/reminder": timeline(({ rig }) => toReminders(rig, 0), noTime),
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
    "sound/clock/reminder-factory":
      "the second alert's volume rose a note (≈395 ms) later than the first alert's in the same " +
      "recording (UNVERIFIED why); nokia-os raises both on CLOCK_ALERTS.ascend's timer",
    "reminders/alert-over-countdown":
      "a reminder falling due during the countdown's alert replaces it, and the countdown's " +
      "alert comes back after the reminder's Snooze; nokia-os shows one alert at a time and " +
      "queues the reminder after the countdown's",
    "reminders/alert-elsewhere-snake":
      "the food lies elsewhere: the game's seed (plan 23's, recovered for its own captures) is " +
      "not this capture's; the game pausing to its menu at the minute matches",
    ...Object.fromEntries(
      ["menu-page", "menu-list", "note", "option-list", "editor", "snake"].map((where) => [
        `reminders/alert-elsewhere-${where}-standby`,
        "C held: v6.39 goes back a level as C goes down and reaches standby ≈475 ms later; " +
          "the kernel's long press (phone-core LONG_PRESS_MS, plan 14) reaches standby at 800 ms",
      ]),
    ),
    "clock/no-time/reminder":
      "its parent is the Time: prompt holding `2h:mm`, a digit none of the generator's keys " +
      "typed (UNVERIFIED how); its Invalid time is clock/settings/set-time-*'s",
    "clock/auto-update/boot-on-hour":
      "a cold boot of a saved image (the emulator's `reboot`: the LCD black first) where " +
      "nokia-os boots from the power key; and `Date and time updated` comes during the boot " +
      "after Code accepted, where nokia-os shows it at standby (D13, UNVERIFIED place)",
    ...Object.fromEntries(
      ["alarm", "stopwatch"].map((area) => [
        `clock/${area}/power-off`,
        "the kernel switches off at its 800 ms long press (phone-core LONG_PRESS_MS); v6.39 " +
          "≈960-990 ms after the power key went down",
      ]),
    ),
    "reminders/power-on-minute":
      "the emulator's clock stood at 10:15 through the minute edge (its software clock never " +
      "advances, P1); nokia-os alerts when the host's minute changes, so its standby shows 10:16",
    ...Object.fromEntries(
      ["screens", "after-reboot-clock-pages"].map((name) => [
        `clock/persist/${name}`,
        "the emulator loses the alarm and the time at a power cycle (its RTC stops, an artefact); " +
          "nokia-os keeps the alarm and the offset (D7), so standby keeps the alarm icon and " +
          "the Alarm clock page its time",
      ]),
    ),
    ...Object.fromEntries(
      ["edit", "edit-ok", "send"].map((name) => [
        `reminders/view-3-${name}`,
        `Options › ${name === "send" ? "Send" : "Edit"} opened its prompt on the shown blink ` +
          `step here and on the hidden one in view-1-${name} and view-2-${name} (each a whole ` +
          "480 ms step); what picks the step is UNVERIFIED, and nokia-os opens on the hidden one",
      ]),
    ),
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
  // Each image builds a phone and navigates to it (20 images); the rings run 135 s each; the
  // reminder scenarios add up to ten reminders and a power cycle first.
  timeoutsMs: {
    ...Object.fromEntries(
      Object.keys(SCENARIOS)
        .filter((id) => /^(reminders\/|sound\/clock\/reminder|clock\/(persist|restore)\/)/.test(id))
        .map((id) => [id, 120_000]),
    ),
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
