// The keyguard state machine (plan 25 D4-D8, Task 5): pure, on an injected clock, no widget.
// Durations are the generated widget timelines' (plan 25's resource registration); windows and
// leads are checked against the goldens they come from.
import { describe, expect, it } from "vite-plus/test";
import type { PhoneKey } from "@hellotimber/phone-core";
import {
  KEYGUARD_HINT_LEAD_MS,
  KEYGUARD_HINT_SCROLL_LEAD_MS,
  KEYGUARD_HINT_SCROLL_PARTIAL_MS,
  KEYGUARD_LOCK_WINDOW_MS,
  KEYGUARD_TIMES,
  KEYGUARD_UNLOCK_LEAD_MS,
  KeyguardEngine,
  type KeyguardCalls,
  type KeyguardOutcome,
} from "../src/firmware/features/keyguard";
import { timelineByName } from "../src/firmware/timelines";
import { findGoldenImage } from "../scripts/golden-format.ts";
import { loadGolden } from "./support/goldens.ts";

function rig(calls?: KeyguardCalls) {
  let now = 0;
  const engine = new KeyguardEngine({ now: () => now, ...(calls ? { calls } : {}) });
  return {
    engine,
    get now() {
      return now;
    },
    /** Moves the clock to `ms` and lets the engine's timers run. */
    at(ms: number) {
      now = ms;
      engine.tick();
    },
    key(key: PhoneKey, atStandby = false): KeyguardOutcome {
      return engine.keyDown(key, atStandby);
    },
  };
}

/** A locked engine at time `t` (Menu at standby at 0, `*` at 300, the lock note played out). */
function locked(calls?: KeyguardCalls) {
  const r = rig(calls);
  r.key("navi", true);
  r.at(300);
  r.key("*");
  r.at(300 + KEYGUARD_TIMES.lockNoteMs);
  expect(r.engine.state).toBe("locked");
  return r;
}

const PASS: KeyguardOutcome = { consumed: false, activity: true, silent: false };
const SWALLOWED: KeyguardOutcome = { consumed: true, activity: false, silent: true };

describe("the generated durations and the goldens' windows", () => {
  it("takes every duration from the widget timelines", () => {
    const total = (name: string) => timelineByName(name).timeline.durationMs;
    expect(KEYGUARD_TIMES).toEqual({
      lockNoteMs: total("keypad-locked"),
      hintMs: total("keyguard-hint"),
      hintScrollMs: total("keyguard-hint-scroll"),
      nowPressMs: total("keyguard-now-press"),
      activeNoteMs: total("keypad-active"),
      emergencyMs: total("keyguard-emergency"),
    });
    expect(KEYGUARD_TIMES.lockNoteMs).toBe(442 + 232 + 240 + 1972 + 9);
    expect(KEYGUARD_TIMES.nowPressMs).toBe(1448);
    expect(KEYGUARD_TIMES.emergencyMs).toBe(3879);
  });

  it("puts the lock window between the last locking gap and the first that is not", () => {
    const note = findGoldenImage(loadGolden("keyguard/lock"), "d").pixels;
    const locks = (gap: number) =>
      loadGolden(`keyguard/lock-gap/${gap}`).images.some((image) =>
        image.pixels.every((p, i) => p === note[i]),
      );
    expect([2900, 2910, 2920].map(locks)).toEqual([true, true, true]);
    expect([2930, 2940, 3000].map(locks)).toEqual([false, false, false]);
    expect(KEYGUARD_LOCK_WINDOW_MS).toBeGreaterThan(2920);
    expect(KEYGUARD_LOCK_WINDOW_MS).toBeLessThanOrEqual(2930);
  });

  it("takes the leads from the frames the goldens show before their timelines", () => {
    const frame = (id: string, n: number) => loadGolden(id).timeline![n]!.durationMs;
    expect(KEYGUARD_HINT_LEAD_MS).toBe(frame("keyguard/hint", 1));
    expect(KEYGUARD_HINT_SCROLL_LEAD_MS).toBe(frame("keyguard/hint/up", 1));
    expect(KEYGUARD_UNLOCK_LEAD_MS).toBe(frame("keyguard/unlock", 2));
  });

  it("closes C's, ▲'s and ▼'s hint with the digits' partial draw, for its own time", () => {
    const up = loadGolden("keyguard/hint/up");
    const digits = loadGolden("keyguard/hint");
    const partial = up.timeline![10]!;
    expect(KEYGUARD_HINT_SCROLL_PARTIAL_MS).toBe(partial.durationMs);
    expect(findGoldenImage(up, partial.image).pixels).toEqual(
      findGoldenImage(digits, digits.timeline![10]!.image).pixels,
    );
    // The generated timeline stops where the partial starts.
    const start = (rows: typeof up.timeline, n: number) => rows![n]!.startMs - rows![2]!.startMs;
    expect(KEYGUARD_TIMES.hintScrollMs).toBe(start(up.timeline, 10));
  });
});

describe("locking (D5)", () => {
  it("locks on * within the window after Menu at standby, at the * key-down", () => {
    const r = rig();
    expect(r.key("navi", true)).toEqual(PASS);
    r.at(2920);
    // The locking * is not light activity; its note's warning tone replaces the beep.
    expect(r.key("*")).toEqual(SWALLOWED);
    expect(r.engine.view).toEqual({ state: "locking", since: 2920 });
    expect(r.engine.locked).toBe(true);
    r.at(2920 + KEYGUARD_TIMES.lockNoteMs - 1);
    expect(r.engine.state).toBe("locking");
    r.at(2920 + KEYGUARD_TIMES.lockNoteMs);
    expect(r.engine.view).toEqual({ state: "locked", since: 2920 + KEYGUARD_TIMES.lockNoteMs });
  });

  it("does not lock after the window, without Menu at standby, or after another key", () => {
    const late = rig();
    late.key("navi", true);
    late.at(2930);
    expect(late.key("*")).toEqual(PASS);
    expect(late.engine.state).toBe("unlocked");

    const notStandby = rig();
    notStandby.key("navi", false);
    notStandby.at(300);
    expect(notStandby.key("*")).toEqual(PASS);

    for (const between of ["down", "1", "c", "navi"] as PhoneKey[]) {
      const r = rig();
      r.key("navi", true);
      r.at(300);
      r.key(between);
      r.at(600);
      expect(r.key("*"), between).toEqual(PASS);
      expect(r.engine.state, between).toBe("unlocked");
    }
  });
});

describe("the locked phone (K3, D6)", () => {
  it("shows the hint for every key but Unlock, silent and dark; the power key lights", () => {
    for (const key of ["0", "5", "9", "*", "#", "c", "up", "down", "power"] as PhoneKey[]) {
      const r = locked();
      r.at(10_000);
      expect(r.key(key), key).toEqual({ ...SWALLOWED, activity: key === "power" });
      const scroll = key === "c" || key === "up" || key === "down" || key === "power";
      expect(r.engine.view, key).toEqual({
        state: "hint",
        since: 10_000,
        scroll,
        lead: {
          ms: scroll ? KEYGUARD_HINT_SCROLL_LEAD_MS : KEYGUARD_HINT_LEAD_MS,
          under: { screen: "locked-standby" },
        },
      });
    }
  });

  it("returns to the locked standby when the hint has played, and restarts it on a key", () => {
    const r = locked();
    r.at(10_000);
    r.key("5");
    const ends = 10_000 + KEYGUARD_HINT_LEAD_MS + KEYGUARD_TIMES.hintMs;
    r.at(11_000);
    r.key("6");
    // A key during the hint restarts it at once: no lead (keyguard/hint-during).
    expect(r.engine.view).toEqual({ state: "hint", since: 11_000, scroll: false });
    r.at(ends + 500); // past the first hint's end: the second still shows
    expect(r.engine.state).toBe("hint");
    r.at(11_000 + KEYGUARD_TIMES.hintMs - 1);
    expect(r.engine.state).toBe("hint");
    r.at(11_000 + KEYGUARD_TIMES.hintMs);
    expect(r.engine.state).toBe("locked");

    const c = locked();
    c.at(10_000);
    c.key("c");
    const scrollEnds =
      10_000 +
      KEYGUARD_HINT_SCROLL_LEAD_MS +
      KEYGUARD_TIMES.hintScrollMs +
      KEYGUARD_HINT_SCROLL_PARTIAL_MS;
    c.at(scrollEnds - 1);
    expect(c.engine.state).toBe("hint");
    c.at(scrollEnds);
    expect(c.engine.state).toBe("locked");
  });

  it("swallows the key-ups of the keys it took", () => {
    const r = locked();
    expect(r.engine.keyUp("5")).toBe(false); // never went down while locked
    r.key("5");
    expect(r.engine.keyUp("5")).toBe(true);
  });
});

describe("unlocking (K4, K5)", () => {
  it("shows Now press * on Unlock, and unlocks on * within it", () => {
    const r = locked();
    r.at(10_000);
    expect(r.key("navi")).toEqual(SWALLOWED);
    expect(r.engine.view).toEqual({ state: "unlocking", since: 10_000 });
    r.at(10_000 + 1440);
    // The unlocking * lights the LEDs and beeps.
    expect(r.key("*")).toEqual({ consumed: true, activity: true, silent: false });
    expect(r.engine.view).toEqual({ state: "unlocked-note", since: 11_440 });
    expect(r.engine.locked).toBe(false);
    r.at(11_440 + KEYGUARD_UNLOCK_LEAD_MS + KEYGUARD_TIMES.activeNoteMs);
    expect(r.engine.view).toEqual({
      state: "unlocked",
      since: 11_440 + KEYGUARD_UNLOCK_LEAD_MS + KEYGUARD_TIMES.activeNoteMs,
    });
  });

  it("closes the window when Now press * ends: * then shows the hint", () => {
    const r = locked();
    r.at(10_000);
    r.key("navi");
    r.at(10_000 + KEYGUARD_TIMES.nowPressMs);
    expect(r.engine.state).toBe("locked");
    r.at(10_000 + 1450);
    expect(r.key("*")).toEqual(SWALLOWED);
    expect(r.engine.state).toBe("hint");
  });

  it("restarts Now press * on a second Unlock; a digit or C shows the hint", () => {
    const r = locked();
    r.at(10_000);
    r.key("navi");
    r.at(10_700);
    r.key("navi");
    expect(r.engine.view).toEqual({ state: "unlocking", since: 10_700 });
    r.at(10_700 + 1440);
    expect(r.key("*").activity).toBe(true);

    for (const key of ["5", "c"] as PhoneKey[]) {
      const s = locked();
      s.at(10_000);
      s.key("navi");
      s.at(10_300);
      expect(s.key(key), key).toEqual(SWALLOWED);
      expect(s.engine.state, key).toBe("hint");
    }
  });

  it("treats Unlock during the hint as Unlock (UNVERIFIED)", () => {
    const r = locked();
    r.at(10_000);
    r.key("5");
    r.at(10_500);
    r.key("navi");
    expect(r.engine.state).toBe("unlocking");
  });
});

describe("emergency numbers (D6)", () => {
  const type = (r: ReturnType<typeof rig>, digits: string, from: number): KeyguardOutcome[] =>
    digits.split("").map((d, i) => {
      r.at(from + 500 * i);
      return r.key(d as PhoneKey);
    });

  it("shows 112 for its time when the digits typed end in it, lighting the LEDs", () => {
    for (const digits of ["112", "2112", "0112"]) {
      const r = locked();
      const outcomes = type(r, digits, 10_000);
      const at = 10_000 + 500 * (digits.length - 1);
      expect(outcomes.at(-1), digits).toEqual({ consumed: true, activity: true, silent: true });
      expect(
        outcomes.slice(0, -1).every((o) => !o.activity),
        digits,
      ).toBe(true);
      expect(r.engine.view, digits).toEqual({ state: "emergency", since: at, number: "112" });
      r.at(at + KEYGUARD_TIMES.emergencyMs);
      expect(r.engine.state, digits).toBe("locked");
    }
  });

  it("shows the hint for other numbers and for a digit during the display", () => {
    for (const digits of ["911", "999", "000", "08", "110", "113", "1122"]) {
      const r = locked();
      type(r, digits, 10_000);
      expect(r.engine.state, digits).toBe("hint");
    }
  });

  it("ends the display at once on C; Call dials through plan 22's hook, else stays", () => {
    const c = locked();
    type(c, "112", 10_000);
    c.at(12_000);
    expect(c.key("c")).toEqual(SWALLOWED);
    expect(c.engine.state).toBe("locked");

    const dialled: string[] = [];
    const call = locked({ dial: (number) => dialled.push(number) });
    type(call, "112", 10_000);
    call.at(12_000);
    expect(call.key("navi")).toEqual({ consumed: true, activity: true, silent: false });
    expect(dialled).toEqual(["112"]);

    const none = locked();
    type(none, "112", 10_000);
    none.at(12_000);
    none.key("navi");
    expect(none.engine.state).toBe("emergency");
  });

  it("forgets the digits once the locked standby returns (UNVERIFIED)", () => {
    const r = locked();
    type(r, "11", 10_000);
    r.at(20_000);
    expect(r.engine.state).toBe("locked");
    r.key("2");
    expect(r.engine.state).toBe("hint");
  });
});

describe("calls and messages (D8)", () => {
  it("passes keys to the kernel during a call and locks again after it", () => {
    const r = locked();
    r.at(10_000);
    expect(r.engine.pass()).toEqual({ activity: true });
    expect(r.engine.state).toBe("passing");
    expect(r.key("navi")).toEqual(PASS);
    r.at(15_000);
    r.engine.resume();
    expect(r.engine.view).toEqual({ state: "locking", since: 15_000 });
    r.at(15_000 + KEYGUARD_TIMES.lockNoteMs);
    expect(r.engine.state).toBe("locked");
  });

  it("keeps a message arriving while locked dark", () => {
    const r = locked();
    expect(r.engine.arrivedWhileLocked()).toEqual({ activity: false });
    expect(r.engine.state).toBe("locked");
  });

  it("leaves an unlocked phone's keys and calls alone", () => {
    const r = rig();
    expect(r.key("5")).toEqual(PASS);
    expect(r.engine.pass()).toEqual({ activity: true });
    r.engine.resume();
    expect(r.engine.state).toBe("unlocked");
  });
});

describe("a power-off", () => {
  it("unlocks: the keyguard lives in RAM", () => {
    const r = locked();
    r.engine.reset();
    expect(r.engine.view).toEqual({ state: "unlocked", since: r.now });
  });
});
