// Plan 21 Task 4 (D4): PhoneConfig.wake, an application that switches a powered-off phone on.
import { describe, expect, it } from "vite-plus/test";
import { createPhone, LONG_PRESS_MS, PhoneApplication, Timeline } from "../src/index";
import type {
  ApplicationContext,
  DeactivationReason,
  KeyEvent,
  Phone,
  PhoneApplicationSession,
  PhoneConfig,
  PhoneSnapshot,
} from "../src/index";
import { testConfig } from "./fixtures";

class WakeApp extends PhoneApplication {
  readonly keys: KeyEvent[] = [];
  readonly ticks: number[] = [];
  readonly deactivations: DeactivationReason[] = [];
  context: ApplicationContext | undefined;

  createSession(context: ApplicationContext): PhoneApplicationSession {
    this.context = context;
    return {
      onKey: (event) => {
        this.keys.push(event);
      },
      tick: (dtMs) => {
        this.ticks.push(dtMs);
      },
      render: () => ({ kind: "confirm", text: this.id, softkey: "Stop" }),
      onDeactivate: (reason) => {
        this.deactivations.push(reason);
      },
    };
  }
}

class ThrowingApp extends PhoneApplication {
  createSession(): PhoneApplicationSession {
    throw new Error("broken wake");
  }
}

const TIMELINE = new Timeline([
  { frame: 0, durationMs: 100 },
  { frame: 1, durationMs: 100 },
]);

const ALARM = { kind: "confirm", text: "alarm", softkey: "Stop" };

/** A host source: `due` is returned by every poll until cleared. */
function source(): {
  polls: number;
  due: PhoneApplication | undefined;
  poll: () => PhoneApplication | undefined;
} {
  const s = {
    polls: 0,
    due: undefined as PhoneApplication | undefined,
    poll(): PhoneApplication | undefined {
      s.polls += 1;
      const due = s.due;
      s.due = undefined;
      return due;
    },
  };
  return s;
}

function phoneWith(overrides: Partial<PhoneConfig> = {}): {
  phone: Phone;
  wake: ReturnType<typeof source>;
} {
  const wake = source();
  const phone = createPhone(
    testConfig({ bootMs: undefined, bootTimeline: TIMELINE, wake: wake.poll, ...overrides }),
  );
  phone.tick(0);
  return { phone, wake };
}

/** Holds power for a long press starting at `at`. */
function longPower(phone: Phone, at: number): number {
  phone.send({ type: "down", key: "power" });
  phone.tick(at + LONG_PRESS_MS);
  phone.send({ type: "up", key: "power" });
  return at + LONG_PRESS_MS;
}

describe("wake: polling", () => {
  it("is polled on every tick while off, never while on", () => {
    const { phone, wake } = phoneWith();
    const before = wake.polls;
    phone.tick(100);
    phone.tick(200);
    expect(wake.polls - before).toBe(2);
    const on = longPower(phone, 200);
    const polls = wake.polls;
    phone.tick(on + 50); // booting
    phone.tick(on + 500); // standby
    phone.tick(on + 600);
    expect(wake.polls).toBe(polls);
    longPower(phone, on + 600);
    expect(phone.screen).toEqual({ kind: "off" });
    phone.tick(on + 2000);
    expect(wake.polls).toBeGreaterThan(polls);
  });

  it("produces identical snapshots with a seam that never wakes", () => {
    const record = (overrides: Partial<PhoneConfig>): unknown[] => {
      const phone = createPhone(
        testConfig({ bootMs: undefined, bootTimeline: TIMELINE, ...overrides }),
      );
      const snaps: unknown[] = [];
      phone.subscribe((snap) => snaps.push(snap));
      for (let t = 0; t <= 500; t += 50) phone.tick(t);
      const on = longPower(phone, 500);
      for (let t = on; t <= on + 400; t += 25) phone.tick(t);
      longPower(phone, on + 400);
      phone.tick(on + 2000);
      return snaps;
    };
    expect(record({ wake: () => undefined })).toEqual(record({}));
  });

  it("contains an exception from the poll", () => {
    let calls = 0;
    const phone = createPhone(
      testConfig({
        wake: () => {
          calls += 1;
          throw new Error("broken host");
        },
      }),
    );
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    expect(() => phone.tick(100)).not.toThrow();
    phone.tick(200);
    expect(calls).toBe(2);
    expect(phone.screen).toEqual({ kind: "off" });
    expect(snaps).toHaveLength(0);
    phone.pressKey("power", 1000);
    expect(phone.screen.kind).toBe("standby");
  });

  it("contains an exception from createSession: the phone stays off", () => {
    const { phone, wake } = phoneWith();
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    wake.due = new ThrowingApp("broken");
    phone.tick(100);
    expect(phone.screen).toEqual({ kind: "off" });
    expect(snaps).toHaveLength(0);
  });
});

describe("wake: the activation", () => {
  it("powers the phone on without the boot: path standby, the application's screen", () => {
    const { phone, wake } = phoneWith();
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    const alarm = new WakeApp("alarm");
    wake.due = alarm;
    phone.tick(100);
    expect(snaps).toEqual([{ path: "standby", screen: ALARM, poweredOn: true }]);
    phone.tick(150);
    expect(alarm.ticks).toEqual([50]);
    phone.pressKey("navi");
    phone.pressKey("power"); // a short press reaches the application
    expect(alarm.keys.map((k) => `${k.type}:${k.key}`)).toEqual([
      "down:navi",
      "up:navi",
      "down:power",
      "up:power",
    ]);
    expect(phone.screen).toEqual(ALARM);
    expect(alarm.context!.menuIndicator!()).toEqual({ segments: [], awaitingNext: false });
  });

  it("exit() powers the phone off again (deactivation reason exit)", () => {
    const { phone, wake } = phoneWith();
    const alarm = new WakeApp("alarm");
    wake.due = alarm;
    phone.tick(100);
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    alarm.context!.exit();
    expect(phone.screen).toEqual({ kind: "off" });
    expect(snaps.at(-1)).toEqual({ path: "standby", screen: { kind: "off" }, poweredOn: false });
    expect(alarm.deactivations).toEqual(["exit"]);
    const polls = wake.polls;
    phone.tick(200);
    expect(wake.polls).toBe(polls + 1);
  });

  it("exit({ to: 'standby' }) runs the normal power-on with its boot gates", () => {
    const gateApp = new WakeApp("pin");
    let opened = 0;
    const { phone, wake } = phoneWith({
      bootGates: [
        {
          atMs: 100,
          open: () => {
            opened += 1;
            return gateApp;
          },
        },
      ],
    });
    const alarm = new WakeApp("alarm");
    wake.due = alarm;
    phone.tick(100);
    alarm.context!.exit({ to: "standby" });
    expect(alarm.deactivations).toEqual(["exit"]);
    expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 0 });
    phone.tick(200);
    expect(opened).toBe(1);
    expect(phone.screen).toMatchObject({ text: "pin" });
    gateApp.context!.exit();
    phone.tick(300);
    expect(phone.screen.kind).toBe("standby");
  });

  it("throws for levels, select and row", () => {
    const { phone, wake } = phoneWith();
    const alarm = new WakeApp("alarm");
    wake.due = alarm;
    phone.tick(100);
    expect(() => alarm.context!.exit({ levels: 1 })).toThrow(/wake/);
    expect(() => alarm.context!.exit({ select: "messages" })).toThrow(/wake/);
    expect(phone.screen).toEqual(ALARM);
  });

  it("the power long press powers off (deactivation reason power-off)", () => {
    const { phone, wake } = phoneWith();
    const alarm = new WakeApp("alarm");
    wake.due = alarm;
    phone.tick(100);
    longPower(phone, 100);
    expect(phone.screen).toEqual({ kind: "off" });
    expect(alarm.deactivations).toEqual(["power-off"]);
  });

  it("does not poll interruption during a wake activation", () => {
    let interruptions = 0;
    const { phone, wake } = phoneWith({
      interruption: () => {
        interruptions += 1;
        return undefined;
      },
    });
    const alarm = new WakeApp("alarm");
    wake.due = alarm;
    phone.tick(100);
    phone.tick(200);
    phone.tick(300);
    expect(interruptions).toBe(0);
    alarm.context!.exit({ to: "standby" });
    phone.tick(500);
    expect(phone.screen.kind).toBe("standby");
    expect(interruptions).toBeGreaterThan(0);
  });

  it("records navigate() during it for the power-on; exit() discards it", () => {
    for (const toStandby of [true, false]) {
      const { phone, wake } = phoneWith();
      const alarm = new WakeApp("alarm");
      wake.due = alarm;
      phone.tick(100);
      phone.navigate("menu/messages");
      expect(phone.path).toBe("standby");
      expect(phone.screen).toEqual(ALARM);
      alarm.context!.exit(toStandby ? { to: "standby" } : undefined);
      phone.tick(400);
      if (toStandby) expect(phone.path).toBe("menu/messages");
      else expect(phone.screen).toEqual({ kind: "off" });
    }
  });
});
