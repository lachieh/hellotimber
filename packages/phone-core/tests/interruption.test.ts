// Plan 21 Task 4 (D3): PhoneConfig.interruption, applications that interrupt whatever is shown.
import { describe, expect, it } from "vite-plus/test";
import {
  createPhone,
  LONG_PRESS_MS,
  MenuGraphic,
  MenuOrder,
  MenuSlug,
  PhoneApplication,
  PhoneMenu,
  ReaderEntry,
  Timeline,
  TopLevelEntry,
} from "../src/index";
import type {
  ApplicationContext,
  DeactivationReason,
  KeyEvent,
  Phone,
  PhoneApplicationSession,
  PhoneConfig,
  PhoneSnapshot,
  StandbyIndicators,
} from "../src/index";
import { bootedPhone, makeFakeApp, testConfig } from "./fixtures";

/** An interrupting application that records what reaches it and exposes its context. */
class AlertApp extends PhoneApplication {
  readonly keys: KeyEvent[] = [];
  readonly ticks: number[] = [];
  readonly deactivations: DeactivationReason[] = [];
  context: ApplicationContext | undefined;
  sessions = 0;

  createSession(context: ApplicationContext): PhoneApplicationSession {
    this.context = context;
    this.sessions += 1;
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
    throw new Error("broken alert");
  }
}

/** A host source: `due` is returned by the next poll, then cleared. */
function alerts(): {
  polls: number;
  due: PhoneApplication | undefined;
  poll: () => PhoneApplication | undefined;
} {
  const source = {
    polls: 0,
    due: undefined as PhoneApplication | undefined,
    poll(): PhoneApplication | undefined {
      source.polls += 1;
      const due = source.due;
      source.due = undefined;
      return due;
    },
  };
  return source;
}

/** Makes `app` due and ticks once so the poll opens it. */
function interrupt(phone: Phone, source: ReturnType<typeof alerts>, app: PhoneApplication): void {
  source.due = app;
  phone.tick(nowOf(phone) + 10);
}

const clocks = new WeakMap<Phone, number>();
function nowOf(phone: Phone): number {
  return clocks.get(phone) ?? 0;
}

/** A booted phone whose ticks are tracked, so tests can tick "a bit later". */
function phoneWith(
  overrides: Partial<PhoneConfig> = {},
  application?: PhoneApplication,
): { phone: Phone; source: ReturnType<typeof alerts> } {
  const source = alerts();
  const phone = bootedPhone({ interruption: source.poll, ...overrides }, application);
  const tick = phone.tick.bind(phone);
  clocks.set(phone, 1000);
  phone.tick = (nowMs: number) => {
    clocks.set(phone, Math.max(nowOf(phone), nowMs));
    tick(nowMs);
  };
  return { phone, source };
}

const ALERT = (id = "alert") => ({ kind: "confirm", text: id, softkey: "Stop" });

describe("interruption: polling", () => {
  it("is polled on every tick while on, after the tick's timers", () => {
    const { phone, source } = phoneWith();
    const before = source.polls;
    phone.tick(1100);
    phone.tick(1200);
    expect(source.polls - before).toBe(2);
    phone.navigate("menu/phone-book");
    phone.tick(1300);
    expect(source.polls - before).toBe(3);
  });

  it("is not polled while off, during the boot or while a boot gate holds", () => {
    const source = alerts();
    const gateApp = new AlertApp("gate");
    const timeline = new Timeline([{ frame: 0, durationMs: 300 }]);
    const phone = createPhone(
      testConfig({
        bootMs: undefined,
        bootTimeline: timeline,
        bootGates: [{ atMs: 100, open: () => gateApp }],
        interruption: source.poll,
      }),
    );
    phone.tick(0);
    phone.tick(100);
    expect(source.polls).toBe(0);
    phone.send({ type: "down", key: "power" });
    const start = 100 + LONG_PRESS_MS;
    phone.tick(start);
    phone.send({ type: "up", key: "power" });
    phone.tick(start + 50);
    expect(phone.screen.kind).toBe("boot");
    phone.tick(start + 100);
    phone.tick(start + 500);
    expect(phone.screen).toEqual(ALERT("gate"));
    expect(source.polls).toBe(0);
    gateApp.context!.exit();
    phone.tick(start + 600);
    expect(phone.screen.kind).toBe("boot");
    expect(source.polls).toBe(0);
    phone.tick(start + 800);
    expect(phone.screen.kind).toBe("standby");
    expect(source.polls).toBe(1); // the tick that ended the boot
  });

  it("runs one interruption at a time: the poll is suspended while one runs", () => {
    const { phone, source } = phoneWith();
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    const polls = source.polls;
    phone.tick(2000);
    phone.tick(3000);
    expect(source.polls).toBe(polls);
    alert.context!.exit();
    phone.tick(3100);
    expect(source.polls).toBe(polls + 1);
  });

  it("contains an exception from the poll; the next tick polls again", () => {
    let calls = 0;
    const phone = bootedPhone({
      interruption: () => {
        calls += 1;
        throw new Error("broken host");
      },
    });
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    expect(() => phone.tick(2000)).not.toThrow();
    phone.tick(2100);
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(phone.screen.kind).toBe("standby");
    expect(snaps).toHaveLength(0);
    phone.pressKey("navi");
    expect(phone.path).toBe("menu");
  });

  it("contains an exception from createSession: the held mode goes on untouched", () => {
    const fake = makeFakeApp();
    const { phone, source } = phoneWith({}, fake.application);
    phone.navigate("menu/messages/write");
    phone.tick(1100);
    const screen = phone.screen;
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    fake.ticks.length = 0;
    source.due = new ThrowingApp("broken");
    phone.tick(1200);
    expect(phone.screen).toEqual(screen);
    expect(phone.path).toBe("menu/messages/write");
    expect(fake.ticks).toEqual([100]);
    phone.pressKey("5");
    expect(fake.keys.at(-1)).toEqual({ type: "up", key: "5" });
    expect(fake.deactivations).toEqual([]);
    expect(snaps.every((snap) => snap.screen.kind === "custom")).toBe(true);
  });

  it("ignores a poll result that is not an application", () => {
    const phone = bootedPhone({
      interruption: () => ({}) as unknown as PhoneApplication,
    });
    phone.tick(2000);
    expect(phone.screen.kind).toBe("standby");
  });
});

describe("interruption: the held mode", () => {
  it("interrupts standby with the path unchanged; exit() restores it with its notice", () => {
    const { phone, source } = phoneWith();
    phone.setNotice({ text: "1 message received", softkey: "Read", path: "menu/messages" });
    const standby = phone.screen;
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    expect(phone.screen).toEqual(ALERT());
    expect(phone.path).toBe("standby");
    phone.pressKey("c"); // reaches the alert, not the notice
    expect(alert.keys.map((k) => `${k.type}:${k.key}`)).toEqual(["down:c", "up:c"]);
    alert.context!.exit();
    expect(phone.screen).toEqual(standby);
    expect(alert.deactivations).toEqual(["exit"]);
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/messages");
  });

  it("holds a menu level with its selection and rows window; keys reach only the interruption", () => {
    const { phone, source } = phoneWith({ rowsWindow: 1 });
    phone.navigate("menu/phone-book");
    phone.pressKey("down");
    const level = phone.screen;
    expect(level).toMatchObject({ kind: "list", selected: 1, windowTop: 1 });
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    expect(phone.path).toBe("menu/phone-book");
    phone.pressKey("down");
    phone.pressKey("c");
    phone.pressKey("c", 1000);
    expect(phone.path).toBe("menu/phone-book");
    expect(alert.keys).toHaveLength(6);
    alert.context!.exit();
    expect(phone.screen).toEqual(level);
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ selected: 0, windowTop: 0 });
  });

  it("holds the shortcut window: its time does not run during the interruption", () => {
    const { phone, source } = phoneWith();
    phone.tick(1000);
    phone.pressKey("navi"); // Menu: the shortcut window opens
    phone.tick(2000);
    const carousel = phone.screen;
    expect(carousel).toMatchObject({ menuIndicator: { awaitingFirst: true } });
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    phone.pressKey("2"); // a digit for the alert, not the shortcut
    phone.tick(20_000);
    expect(phone.path).toBe("menu");
    alert.context!.exit();
    expect(phone.screen).toEqual(carousel);
    phone.tick(21_000); // 990 ms of the window's 1990 left
    expect(phone.screen).toEqual(carousel);
    phone.pressKey("2");
    expect(phone.path).toBe("menu/messages");
  });

  it("holds a carousel icon's timeline at its frame", () => {
    const icon = new Timeline([
      { frame: 0, durationMs: 1000 },
      { frame: 1, durationMs: 1000 },
    ]);
    const menu = new PhoneMenu([
      new TopLevelEntry(
        new ReaderEntry(new MenuSlug("chat"), new MenuOrder(1), "Chat", "hi"),
        new MenuGraphic("chat", icon),
      ),
    ]);
    const { phone, source } = phoneWith({ menu });
    phone.navigate("menu");
    phone.tick(1500);
    const carousel = phone.screen;
    expect(carousel).toMatchObject({ iconFrame: 0 });
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    phone.tick(9000);
    alert.context!.exit();
    expect(phone.screen).toEqual(carousel);
    phone.tick(9480);
    expect(phone.screen).toMatchObject({ iconFrame: 0 });
    phone.tick(9500);
    expect(phone.screen).toMatchObject({ iconFrame: 1 });
  });

  it("holds an application: same session, no keys, no ticks, path unchanged", () => {
    const fake = makeFakeApp();
    const { phone, source } = phoneWith({}, fake.application);
    phone.navigate("menu/messages/write");
    phone.tick(1100);
    const screen = phone.screen;
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    const ticks = fake.ticks.length;
    const keys = fake.keys.length;
    phone.tick(5000);
    phone.pressKey("5");
    expect(fake.ticks).toHaveLength(ticks);
    expect(fake.keys).toHaveLength(keys);
    expect(alert.ticks.reduce((a, b) => a + b, 0)).toBe(5000 - 1110);
    expect(phone.path).toBe("menu/messages/write");
    alert.context!.exit();
    expect(phone.screen).toEqual(screen);
    expect(fake.deactivations).toEqual([]);
    phone.tick(5100);
    expect(fake.ticks.at(-1)).toBe(100);
    phone.pressKey("c"); // the same session exits itself on C
    expect(fake.keys.at(-1)).toEqual({ type: "up", key: "c" });
    expect(phone.path).toBe("menu/messages");
    expect(fake.deactivations).toEqual(["exit"]);
  });

  it("holds a standby notice's application", () => {
    const fake = makeFakeApp("inbox");
    const { phone, source } = phoneWith();
    phone.setNotice({ text: "1 message received", softkey: "Read", open: fake.application });
    phone.pressKey("navi");
    const screen = phone.screen;
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    expect(phone.path).toBe("standby");
    alert.context!.exit();
    expect(phone.screen).toEqual(screen);
    expect(fake.deactivations).toEqual([]);
  });

  it("does not forward the release of a key held when it starts", () => {
    const { phone, source } = phoneWith();
    const alert = new AlertApp("alert");
    phone.send({ type: "down", key: "navi" });
    interrupt(phone, source, alert);
    phone.send({ type: "up", key: "navi" });
    expect(alert.keys).toEqual([]);
    expect(phone.screen).toEqual(ALERT());
  });
});

describe("interruption: exits", () => {
  it("exit({ to: 'standby' }) deactivates the held session once (navigate) and shows standby", () => {
    const fake = makeFakeApp();
    const { phone, source } = phoneWith({}, fake.application);
    phone.navigate("menu/messages/write");
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    alert.context!.exit({ to: "standby" });
    expect(phone.path).toBe("standby");
    expect(phone.screen.kind).toBe("standby");
    expect(fake.deactivations).toEqual(["navigate"]);
    expect(alert.deactivations).toEqual(["exit"]);
    phone.pressKey("power", 1000);
    expect(fake.deactivations).toEqual(["navigate"]);
  });

  it("exit({ to: 'standby' }) leaves a held menu level", () => {
    const { phone, source } = phoneWith();
    phone.navigate("menu/phone-book/search");
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    alert.context!.exit({ to: "standby" });
    expect(phone.path).toBe("standby");
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", label: "Phone book" });
  });

  it("throws for levels, select and row", () => {
    const { phone, source } = phoneWith();
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    const context = alert.context!;
    expect(() => context.exit({ levels: 1 })).toThrow(/interruption/);
    expect(() => context.exit({ select: "messages" })).toThrow(/interruption/);
    expect(() => context.exit({ select: "messages", row: "top" })).toThrow(/interruption/);
    expect(phone.screen).toEqual(ALERT());
  });

  it("returns no segments from menuIndicator()", () => {
    const { phone, source } = phoneWith();
    phone.navigate("menu/phone-book");
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    expect(alert.context!.menuIndicator!()).toEqual({ segments: [], awaitingNext: false });
  });

  it("open() replaces the interruption in place; the hold continues", () => {
    const { phone, source } = phoneWith();
    phone.navigate("menu/phone-book");
    const level = phone.screen;
    const alert = new AlertApp("alert");
    const next = new AlertApp("snoozed");
    interrupt(phone, source, alert);
    alert.context!.open(next);
    expect(alert.deactivations).toEqual(["replace"]);
    expect(phone.screen).toEqual(ALERT("snoozed"));
    expect(phone.path).toBe("menu/phone-book");
    next.context!.exit();
    expect(phone.screen).toEqual(level);
  });

  it("exit() inside createSession returns to the held mode without rendering", () => {
    const { phone, source } = phoneWith();
    const standby = phone.screen;
    class Quick extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        context.exit();
        return {
          onKey() {},
          tick() {},
          render: () => ({ kind: "confirm", text: "x", softkey: "" }),
        };
      }
    }
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    interrupt(phone, source, new Quick("quick"));
    expect(phone.screen).toEqual(standby);
    expect(snaps.every((snap) => snap.screen.kind === "standby")).toBe(true);
  });
});

describe("interruption: navigate and power", () => {
  it("records navigate() during it and applies the last target after exit()", () => {
    const { phone, source } = phoneWith();
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    phone.navigate("menu/phone-book");
    phone.navigate("menu/messages");
    expect(phone.path).toBe("standby");
    expect(phone.screen).toEqual(ALERT());
    alert.context!.exit();
    expect(phone.path).toBe("menu/messages");
  });

  it("applies a recorded target after exit({ to: 'standby' })", () => {
    const fake = makeFakeApp();
    const { phone, source } = phoneWith({}, fake.application);
    phone.navigate("menu/messages/write");
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    phone.navigate("menu/phone-book");
    alert.context!.exit({ to: "standby" });
    expect(phone.path).toBe("menu/phone-book");
    expect(fake.deactivations).toEqual(["navigate"]);
  });

  it("applies navigate('standby') recorded during it to a held menu", () => {
    const { phone, source } = phoneWith();
    phone.navigate("menu/phone-book");
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    phone.navigate("standby");
    alert.context!.exit();
    expect(phone.path).toBe("standby");
  });

  it("the power long press deactivates both sessions once with power-off", () => {
    const fake = makeFakeApp();
    const { phone, source } = phoneWith({}, fake.application);
    phone.navigate("menu/messages/write");
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    phone.send({ type: "down", key: "power" });
    phone.tick(nowOf(phone) + LONG_PRESS_MS);
    phone.send({ type: "up", key: "power" });
    expect(phone.screen).toEqual({ kind: "off" });
    expect(alert.deactivations).toEqual(["power-off"]);
    expect(fake.deactivations).toEqual(["power-off"]);
    phone.pressKey("power", 1000);
    expect(phone.screen.kind).toBe("standby");
    expect(alert.deactivations).toEqual(["power-off"]);
    expect(fake.deactivations).toEqual(["power-off"]);
  });
});

describe("interruption: snapshots", () => {
  it("emits none for polls that return nothing", () => {
    const { phone } = phoneWith();
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    for (let t = 1100; t < 3000; t += 100) phone.tick(t);
    expect(snaps).toHaveLength(0);
  });

  it("emits the interruption's screen with the held path, then the held screen on exit", () => {
    const { phone, source } = phoneWith();
    phone.navigate("menu/phone-book");
    const level = phone.screen;
    const alert = new AlertApp("alert");
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    interrupt(phone, source, alert);
    expect(snaps).toEqual([{ path: "menu/phone-book", screen: ALERT(), poweredOn: true }]);
    alert.context!.exit();
    expect(snaps.at(-1)).toEqual({ path: "menu/phone-book", screen: level, poweredOn: true });
  });

  it("emits no pathchange for an interruption that keeps the path", () => {
    const { phone, source } = phoneWith();
    const paths: string[] = [];
    phone.on("pathchange", (path) => paths.push(path));
    const alert = new AlertApp("alert");
    interrupt(phone, source, alert);
    alert.context!.exit();
    expect(paths).toEqual([]);
  });

  it("produces identical snapshots with a seam that never interrupts", () => {
    const record = (overrides: Partial<PhoneConfig>): unknown[] => {
      let indicators: StandbyIndicators | undefined;
      const phone = createPhone(
        testConfig({ standbyIndicators: () => indicators, menuOpenDelayMs: 200, ...overrides }),
      );
      const events: unknown[] = [];
      phone.subscribe((snap) => events.push(snap));
      phone.on("pathchange", (path) => events.push(path));
      phone.tick(0);
      phone.pressKey("power", 1000);
      for (let t = 1000; t <= 2000; t += 50) phone.tick(t);
      indicators = { message: true };
      phone.tick(2100);
      phone.pressKey("navi");
      for (let t = 2100; t <= 3000; t += 50) phone.tick(t);
      phone.pressKey("down");
      phone.pressKey("navi");
      phone.navigate("menu/messages/write");
      phone.tick(3100);
      phone.pressKey("c");
      phone.pressKey("c", 1000);
      return events;
    };
    expect(record({ interruption: () => undefined })).toEqual(record({}));
  });
});
