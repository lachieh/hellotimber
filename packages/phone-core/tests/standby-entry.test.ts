// Plan 22: PhoneConfig.standbyEntry (keys that start a standby application with themselves) and
// ApplicationContext.exit({ to: "standby", key }) (an application hands a held key over to it).
import { describe, expect, it } from "vite-plus/test";
import { createPhone, PhoneApplication } from "../src/index";
import type {
  ApplicationContext,
  ExitOptions,
  KeyEvent,
  Phone,
  PhoneApplicationSession,
  PhoneConfig,
  PhoneKey,
} from "../src/index";
import { bootedPhone, testConfig, testMenu } from "./fixtures";

const DIGITS: readonly PhoneKey[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"];

/** The entry: records its keys and the key it opened with; C up exits. */
class Entry extends PhoneApplication {
  readonly opened: PhoneKey[] = [];
  readonly keys: KeyEvent[] = [];
  context: ApplicationContext | undefined;

  createSession(context: ApplicationContext): PhoneApplicationSession {
    this.context = context;
    return {
      onKey: (event) => {
        this.keys.push(event);
        if (event.type === "up" && event.key === "c") context.exit();
      },
      tick() {},
      render: () => ({ kind: "confirm", text: `entry:${this.opened.join("")}`, softkey: "Call" }),
    };
  }
}

function entryConfig(
  entry: Entry,
  keys: readonly PhoneKey[] = DIGITS,
): PhoneConfig["standbyEntry"] {
  return {
    keys,
    open(key) {
      entry.opened.push(key);
      return entry;
    },
  };
}

/** An application in the menus that hands its key-downs over with `exit(options)`. */
class HandsOver extends PhoneApplication {
  options: ExitOptions = {};
  createSession(context: ApplicationContext): PhoneApplicationSession {
    return {
      onKey: (event) => {
        if (event.type === "down" && event.key !== "c") {
          context.exit({ ...this.options, key: event.key });
        }
      },
      tick() {},
      render: () => ({ kind: "confirm", text: "Note", softkey: "" }),
    };
  }
}

function rig(overrides: Partial<PhoneConfig> = {}, application?: PhoneApplication) {
  const entry = new Entry("entry");
  const phone = bootedPhone({ standbyEntry: entryConfig(entry), ...overrides }, application);
  let now = 1000;
  const advance = (ms: number): void => {
    for (const end = now + ms; now < end; ) phone.tick(++now);
  };
  return { phone, entry, advance };
}

function screenText(phone: Phone): string {
  const screen = phone.screen;
  return screen.kind === "confirm" ? screen.text : screen.kind;
}

describe("standbyEntry at standby", () => {
  it("opens the entry on a listed key's down and forwards that down and its up", () => {
    const { phone, entry } = rig();
    phone.send({ type: "down", key: "5" });
    expect(entry.opened).toEqual(["5"]);
    expect(entry.keys).toEqual([{ type: "down", key: "5" }]);
    expect(phone.path).toBe("standby");
    expect(screenText(phone)).toBe("entry:5");
    phone.send({ type: "up", key: "5" });
    expect(entry.keys).toEqual([
      { type: "down", key: "5" },
      { type: "up", key: "5" },
    ]);
  });

  it("has no menu segments and returns to standby on exit", () => {
    const { phone, entry } = rig();
    phone.pressKey("#");
    expect(entry.context?.menuIndicator?.().segments).toEqual([]);
    phone.pressKey("c");
    expect(phone.screen.kind).toBe("standby");
  });

  it("leaves unlisted keys as they were", () => {
    const { phone, entry } = rig({ standbyEntry: undefined });
    phone.pressKey("5");
    expect(phone.screen.kind).toBe("standby");
    expect(entry.opened).toEqual([]);
    const listed = rig({}, undefined);
    listed.phone.pressKey("down");
    expect(listed.phone.screen.kind).toBe("standby");
    expect(listed.entry.opened).toEqual([]);
  });

  it("clears a notice and opens the entry", () => {
    const { phone, entry } = rig();
    phone.setNotice({ text: "1 missed call", softkey: "List" });
    phone.pressKey("7");
    expect(entry.opened).toEqual(["7"]);
    phone.pressKey("c");
    expect(phone.screen.kind === "standby" && phone.screen.notice).toBeUndefined();
  });

  it("rejects navi, C and the power key among its keys", () => {
    for (const key of ["navi", "c", "power"] as const) {
      expect(() =>
        createPhone(testConfig({ standbyEntry: { keys: ["1", key], open: () => new Entry("e") } })),
      ).toThrow(/standbyEntry/);
    }
  });

  it("shows App error when open() throws", () => {
    const phone = bootedPhone({
      standbyEntry: {
        keys: ["1"],
        open: () => {
          throw new Error("boom");
        },
      },
    });
    phone.pressKey("1");
    expect(phone.screen.kind).toBe("reader");
    phone.pressKey("c");
    expect(phone.screen.kind).toBe("standby");
  });

  it("is not consulted during the boot", () => {
    const entry = new Entry("entry");
    const phone = createPhone(testConfig({ standbyEntry: entryConfig(entry), bootMs: 3000 }));
    phone.tick(0);
    phone.send({ type: "down", key: "power" });
    for (let t = 1; t <= 1000; t++) phone.tick(t);
    phone.send({ type: "up", key: "power" });
    phone.pressKey("5");
    expect(entry.opened).toEqual([]);
  });
});

describe("standbyEntry in the menus", () => {
  it("leaves a menu level for the entry with a key no shortcut window takes", () => {
    const { phone, entry, advance } = rig();
    phone.pressKey("navi");
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/phone-book");
    advance(4000);
    phone.pressKey("5");
    expect(entry.opened).toEqual(["5"]);
    expect(phone.path).toBe("standby");
  });

  it("leaves a key a shortcut window takes to the shortcut", () => {
    const { phone, entry } = rig();
    phone.pressKey("navi");
    phone.pressKey("2");
    expect(entry.opened).toEqual([]);
    expect(phone.path).toBe("menu/messages");
  });

  it("at the stock carousel, opens the entry with a window's first key that begins no number", () => {
    const entry = new Entry("entry");
    const invalid = new HandsOver("invalid");
    const phone = bootedPhone({
      standbyEntry: entryConfig(entry),
      shortcutEntry: { openDelayMs: 1460, invalid },
    });
    phone.pressKey("navi");
    phone.pressKey("0");
    expect(entry.opened).toEqual(["0"]);
    expect(phone.path).toBe("standby");
  });
});

describe("exit({ to: 'standby', key })", () => {
  it("hands a held key over to the entry, whose release it then receives", () => {
    const app = new HandsOver("write-message");
    app.options = { to: "standby" };
    const entry = new Entry("entry");
    const phone = bootedPhone({ menu: testMenu(app), standbyEntry: entryConfig(entry) });
    phone.navigate("menu/messages/write");
    phone.send({ type: "down", key: "4" });
    expect(entry.opened).toEqual(["4"]);
    expect(entry.keys).toEqual([{ type: "down", key: "4" }]);
    expect(phone.path).toBe("standby");
    phone.send({ type: "up", key: "4" });
    expect(entry.keys.at(-1)).toEqual({ type: "up", key: "4" });
  });

  it("goes to standby only when the key is not listed", () => {
    const app = new HandsOver("write-message");
    app.options = { to: "standby" };
    const entry = new Entry("entry");
    const phone = bootedPhone({
      menu: testMenu(app),
      standbyEntry: entryConfig(entry, ["1"]),
    });
    phone.navigate("menu/messages/write");
    phone.pressKey("2");
    expect(entry.opened).toEqual([]);
    expect(phone.screen.kind).toBe("standby");
  });

  it("throws without to: standby", () => {
    const app = new HandsOver("write-message");
    const entry = new Entry("entry");
    const phone = bootedPhone({ menu: testMenu(app), standbyEntry: entryConfig(entry) });
    phone.navigate("menu/messages/write");
    let error: unknown;
    app.options = {};
    const wrapped = new (class extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        return {
          onKey: (event) => {
            if (event.type !== "down") return;
            try {
              context.exit({ key: event.key });
            } catch (e) {
              error = e;
            }
          },
          tick() {},
          render: () => ({ kind: "confirm", text: "x", softkey: "" }),
        };
      }
    })("write-message");
    const other = bootedPhone({ menu: testMenu(wrapped), standbyEntry: entryConfig(entry) });
    other.navigate("menu/messages/write");
    other.pressKey("5");
    expect(String(error)).toMatch(/key/);
    expect(phone.path).toBe("menu/messages/write");
  });

  it("throws from a boot gate", () => {
    let error: unknown;
    const gate = new (class extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        return {
          onKey: (event) => {
            if (event.type !== "down") return;
            try {
              context.exit({ to: "standby", key: event.key });
            } catch (e) {
              error = e;
            }
          },
          tick() {},
          render: () => ({ kind: "confirm", text: "gate", softkey: "" }),
        };
      }
    })("gate");
    const entry = new Entry("entry");
    const phone = createPhone(
      testConfig({
        bootMs: 0,
        bootGates: [{ atMs: 0, open: () => gate }],
        standbyEntry: entryConfig(entry),
      }),
    );
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.pressKey("5");
    expect(String(error)).toMatch(/key/);
    expect(entry.opened).toEqual([]);
  });
});

describe("onInterrupted (plan 22: Snake II suspends its game for a call)", () => {
  it("tells the held application once when an interruption starts", () => {
    let interrupted = 0;
    const game = new (class extends PhoneApplication {
      createSession(): PhoneApplicationSession {
        return {
          onKey() {},
          tick() {},
          render: () => ({ kind: "confirm", text: "game", softkey: "" }),
          onInterrupted: () => {
            interrupted += 1;
          },
        };
      }
    })("write-message");
    let due: PhoneApplication | undefined;
    const ring = new (class extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        return {
          onKey: (event) => {
            if (event.type === "up") context.exit();
          },
          tick() {},
          render: () => ({ kind: "confirm", text: "ring", softkey: "" }),
        };
      }
    })("ring");
    const phone = bootedPhone({
      menu: testMenu(game),
      interruption: () => {
        const next = due;
        due = undefined;
        return next;
      },
    });
    phone.navigate("menu/messages/write");
    due = ring;
    phone.tick(2000);
    expect(interrupted).toBe(1);
    phone.tick(2001);
    expect(interrupted).toBe(1);
    phone.pressKey("c");
    expect(screenText(phone)).toBe("game");
    expect(interrupted).toBe(1);
  });
});
