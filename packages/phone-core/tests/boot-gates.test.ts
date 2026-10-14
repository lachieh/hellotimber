// Plan 15 Task 3: PhoneConfig.bootGates, applications that hold the boot at offsets into it.
import { describe, expect, it } from "vite-plus/test";
import { createPhone, LONG_PRESS_MS, PhoneApplication, Timeline } from "../src/index";
import type {
  ApplicationContext,
  BootGate,
  DeactivationReason,
  KeyEvent,
  Phone,
  PhoneApplicationSession,
  PhoneConfig,
  PhoneSnapshot,
} from "../src/index";
import { testConfig } from "./fixtures";

/** A gate application that records what reaches it and exposes its context. */
class GateApp extends PhoneApplication {
  readonly keys: KeyEvent[] = [];
  readonly deactivations: DeactivationReason[] = [];
  context: ApplicationContext | undefined;
  sessions = 0;
  tickedMs = 0;

  constructor(
    id: string,
    private readonly text = id,
  ) {
    super(id);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    this.context = context;
    this.sessions += 1;
    return {
      onKey: (event) => {
        this.keys.push(event);
      },
      tick: (dtMs) => {
        this.tickedMs += dtMs;
      },
      render: () => ({ kind: "confirm", text: this.text, softkey: "OK" }),
      onDeactivate: (reason) => {
        this.deactivations.push(reason);
      },
    };
  }
}

class ThrowingApp extends PhoneApplication {
  createSession(): PhoneApplicationSession {
    throw new Error("broken gate");
  }
}

const TIMELINE = new Timeline([
  { frame: 0, durationMs: 100 },
  { frame: 1, durationMs: 100 },
  { frame: 2, durationMs: 100 },
]);

/** A gate that opens `app` (once per call to open). */
function gate(atMs: number, app: PhoneApplication | undefined): BootGate & { opened: number } {
  const g = {
    atMs,
    opened: 0,
    open(): PhoneApplication | undefined {
      g.opened += 1;
      return app;
    },
  };
  return g;
}

/** Holds power until the long press fires at `LONG_PRESS_MS`; the boot starts then. */
function powerOn(phone: Phone): number {
  phone.tick(0);
  phone.send({ type: "down", key: "power" });
  phone.tick(LONG_PRESS_MS);
  phone.send({ type: "up", key: "power" });
  return LONG_PRESS_MS;
}

function config(overrides: Partial<PhoneConfig>): PhoneConfig {
  return testConfig({ bootMs: undefined, bootTimeline: TIMELINE, ...overrides });
}

describe("boot gates: validation", () => {
  it("throws for gates out of ascending order", () => {
    expect(() =>
      createPhone(config({ bootGates: [gate(200, undefined), gate(100, undefined)] })),
    ).toThrow(/ascending/);
  });

  it("throws for a non-integer or out-of-range atMs", () => {
    for (const atMs of [1.5, -1, 301, Number.NaN]) {
      expect(() => createPhone(config({ bootGates: [gate(atMs, undefined)] })), `${atMs}`).toThrow(
        /atMs/,
      );
    }
  });

  it("accepts equal offsets, 0 and the boot's end", () => {
    expect(() =>
      createPhone(
        config({ bootGates: [gate(0, undefined), gate(100, undefined), gate(100, undefined)] }),
      ),
    ).not.toThrow();
    expect(() => createPhone(config({ bootGates: [gate(300, undefined)] }))).not.toThrow();
  });

  it("works with the legacy boot (no bootTimeline)", () => {
    const app = new GateApp("legacy-gate");
    const phone = createPhone(testConfig({ bootMs: 3000, bootGates: [gate(1000, app)] }));
    const start = powerOn(phone);
    phone.tick(start + 1000);
    expect(phone.screen).toEqual({ kind: "confirm", text: "legacy-gate", softkey: "OK" });
    app.context!.exit();
    expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 5 });
    phone.tick(start + 1000 + 1999);
    expect(phone.screen.kind).toBe("boot");
    phone.tick(start + 1000 + 2000);
    expect(phone.screen.kind).toBe("standby");
  });
});

describe("boot gates: the hold", () => {
  it("stops the boot at atMs and shows the gate's screen; keys reach it; the path is standby", () => {
    const app = new GateApp("gate");
    const phone = createPhone(config({ bootGates: [gate(150, app)] }));
    const start = powerOn(phone);
    phone.tick(start + 149);
    expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 1 });
    phone.tick(start + 150);
    expect(phone.screen).toEqual({ kind: "confirm", text: "gate", softkey: "OK" });
    expect(phone.path).toBe("standby");
    phone.tick(start + 5000);
    expect(phone.screen.kind).toBe("confirm");
    phone.pressKey("5");
    phone.pressKey("navi");
    expect(app.keys.map((k) => `${k.type}:${k.key}`)).toEqual([
      "down:5",
      "up:5",
      "down:navi",
      "up:navi",
    ]);
    expect(phone.path).toBe("standby");
  });

  it("ticks the gate's session with the time since the boot reached atMs only", () => {
    const app = new GateApp("gate");
    const phone = createPhone(config({ bootGates: [gate(150, app)] }));
    const start = powerOn(phone);
    phone.tick(start + 140);
    phone.tick(start + 400);
    expect(app.tickedMs).toBe(250);
    phone.tick(start + 401);
    expect(app.tickedMs).toBe(251);
  });

  it("emits snapshots of the gate's screen only while it holds", () => {
    const app = new GateApp("gate");
    const phone = createPhone(config({ bootGates: [gate(150, app)] }));
    const start = powerOn(phone);
    phone.tick(start + 150);
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    for (let t = start + 151; t < start + 1000; t += 50) phone.tick(t);
    expect(snaps.length).toBeGreaterThan(0);
    for (const snap of snaps) {
      expect(snap.screen).toEqual({ kind: "confirm", text: "gate", softkey: "OK" });
      expect(snap.path).toBe("standby");
    }
  });

  it("returns no segments from menuIndicator()", () => {
    const app = new GateApp("gate");
    const phone = createPhone(config({ bootGates: [gate(0, app)] }));
    powerOn(phone);
    expect(app.context!.menuIndicator!()).toEqual({ segments: [], awaitingNext: false });
  });

  it("lets the boot go on when open() returns undefined", () => {
    const g = gate(100, undefined);
    const phone = createPhone(config({ bootGates: [g] }));
    const start = powerOn(phone);
    phone.tick(start + 150);
    expect(g.opened).toBe(1);
    expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 1 });
    phone.tick(start + 300);
    expect(phone.screen.kind).toBe("standby");
  });
});

describe("boot gates: exits", () => {
  it("exit() resumes the timeline at atMs with the remaining duration exact", () => {
    const app = new GateApp("gate");
    const phone = createPhone(config({ bootGates: [gate(150, app)] }));
    const start = powerOn(phone);
    phone.tick(start + 400); // the gate opened at 150 although the tick came later
    expect(phone.screen.kind).toBe("confirm");
    phone.tick(start + 1000);
    app.context!.exit();
    expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 1 });
    expect(app.deactivations).toEqual(["exit"]);
    phone.tick(start + 1000 + 49);
    expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 1 });
    phone.tick(start + 1000 + 50);
    expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 2 });
    phone.tick(start + 1000 + 149);
    expect(phone.screen.kind).toBe("boot");
    phone.tick(start + 1000 + 150);
    expect(phone.screen.kind).toBe("standby");
  });

  it("runs two gates at the same offset in order", () => {
    const first = new GateApp("first");
    const second = new GateApp("second");
    const phone = createPhone(config({ bootGates: [gate(100, first), gate(100, second)] }));
    const start = powerOn(phone);
    phone.tick(start + 100);
    expect(phone.screen).toMatchObject({ text: "first" });
    phone.tick(start + 500);
    first.context!.exit();
    expect(phone.screen).toMatchObject({ text: "second" });
    second.context!.exit();
    expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 1 });
  });

  it("exit({ to: 'standby' }) ends the boot at once", () => {
    const first = new GateApp("first");
    const later = gate(200, new GateApp("later"));
    const phone = createPhone(config({ bootGates: [gate(100, first), later] }));
    const start = powerOn(phone);
    phone.tick(start + 100);
    first.context!.exit({ to: "standby" });
    expect(phone.screen.kind).toBe("standby");
    expect(later.opened).toBe(0);
  });

  it("throws for levels, select and row", () => {
    const app = new GateApp("gate");
    const phone = createPhone(config({ bootGates: [gate(100, app)] }));
    const start = powerOn(phone);
    phone.tick(start + 100);
    expect(() => app.context!.exit({ levels: 1 })).toThrow(/boot gate/);
    expect(() => app.context!.exit({ select: "messages" })).toThrow(/boot gate/);
    expect(() => app.context!.exit({ select: "messages", row: "top" })).toThrow(/boot gate/);
    expect(phone.screen.kind).toBe("confirm");
  });

  it("open() replaces the gate application in place", () => {
    const next = new GateApp("next");
    const app = new GateApp("gate");
    const phone = createPhone(config({ bootGates: [gate(100, app)] }));
    const start = powerOn(phone);
    phone.tick(start + 100);
    app.context!.open(next);
    expect(app.deactivations).toEqual(["replace"]);
    expect(phone.screen).toMatchObject({ text: "next" });
    expect(phone.path).toBe("standby");
    next.context!.exit();
    expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 1 });
  });
});

describe("boot gates: navigate and power", () => {
  it("navigate() during a gate records the target, applied when the boot ends", () => {
    const app = new GateApp("gate");
    const phone = createPhone(config({ bootGates: [gate(100, app)] }));
    const start = powerOn(phone);
    phone.tick(start + 100);
    phone.navigate("menu/messages");
    expect(phone.path).toBe("standby");
    expect(phone.screen.kind).toBe("confirm");
    app.context!.exit();
    expect(phone.path).toBe("standby");
    phone.tick(start + 300);
    expect(phone.path).toBe("menu/messages");
  });

  it("applies a recorded target when the gate ends the boot", () => {
    const app = new GateApp("gate");
    const phone = createPhone(config({ bootGates: [gate(100, app)] }));
    const start = powerOn(phone);
    phone.tick(start + 100);
    phone.navigate("menu/messages");
    app.context!.exit({ to: "standby" });
    expect(phone.path).toBe("menu/messages");
  });

  it("power long press deactivates the gate once with power-off; the next power-on opens it again", () => {
    const app = new GateApp("gate");
    const g = gate(100, app);
    const phone = createPhone(config({ bootGates: [g] }));
    const start = powerOn(phone);
    phone.tick(start + 100);
    phone.send({ type: "down", key: "power" });
    phone.tick(start + 100 + LONG_PRESS_MS);
    phone.send({ type: "up", key: "power" });
    expect(phone.screen).toEqual({ kind: "off" });
    expect(app.deactivations).toEqual(["power-off"]);
    expect(app.keys.filter((k) => k.key === "power")).toEqual([{ type: "down", key: "power" }]);
    const again = start + 100 + LONG_PRESS_MS + 10;
    phone.tick(again);
    phone.send({ type: "down", key: "power" });
    phone.tick(again + LONG_PRESS_MS);
    phone.send({ type: "up", key: "power" });
    phone.tick(again + LONG_PRESS_MS + 100);
    expect(g.opened).toBe(2);
    expect(app.sessions).toBe(2);
    expect(phone.screen.kind).toBe("confirm");
    expect(app.deactivations).toEqual(["power-off"]);
  });
});

describe("boot gates: bootMs 0", () => {
  it("runs the gates in order at power-on, then standby", () => {
    const first = new GateApp("first");
    const second = new GateApp("second");
    const phone = createPhone(
      testConfig({ bootMs: 0, bootGates: [gate(0, first), gate(0, second)] }),
    );
    powerOn(phone);
    expect(phone.screen).toMatchObject({ text: "first" });
    first.context!.exit();
    expect(phone.screen).toMatchObject({ text: "second" });
    second.context!.exit();
    expect(phone.screen.kind).toBe("standby");
  });

  it("applies a deep link after the gates", () => {
    const app = new GateApp("gate");
    const phone = createPhone(testConfig({ bootMs: 0, bootGates: [gate(0, app)] }));
    phone.navigate("menu/messages"); // powers on with a target
    expect(phone.screen.kind).toBe("confirm");
    expect(phone.path).toBe("standby");
    app.context!.exit();
    expect(phone.path).toBe("menu/messages");
  });

  it("goes straight to standby when no gate opens", () => {
    const phone = createPhone(testConfig({ bootMs: 0, bootGates: [gate(0, undefined)] }));
    powerOn(phone);
    expect(phone.screen.kind).toBe("standby");
  });
});

describe("boot gates: containment", () => {
  it("skips a gate whose open() throws", () => {
    const after = new GateApp("after");
    const phone = createPhone(
      config({
        bootGates: [
          {
            atMs: 100,
            open() {
              throw new Error("broken");
            },
          },
          gate(100, after),
        ],
      }),
    );
    const start = powerOn(phone);
    phone.tick(start + 100);
    expect(phone.screen).toMatchObject({ text: "after" });
  });

  it("skips a gate whose createSession throws", () => {
    const phone = createPhone(config({ bootGates: [gate(100, new ThrowingApp("broken"))] }));
    const start = powerOn(phone);
    phone.tick(start + 100);
    expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 1 });
    phone.tick(start + 300);
    expect(phone.screen.kind).toBe("standby");
  });

  it("produces identical models without gates", () => {
    const record = (overrides: Partial<PhoneConfig>): unknown[] => {
      const phone = createPhone(config(overrides));
      const screens: unknown[] = [];
      phone.subscribe((snap) => screens.push(snap));
      const start = powerOn(phone);
      for (let t = start; t <= start + 400; t += 25) phone.tick(t);
      return screens;
    };
    expect(record({ bootGates: [] })).toEqual(record({}));
  });
});
