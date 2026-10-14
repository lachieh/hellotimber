import { describe, expect, it } from "vite-plus/test";
import {
  ApplicationEntry,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneApplication,
  PhoneMenu,
  ReaderEntry,
  SubmenuEntry,
  TopLevelEntry,
} from "../src/index";
import type {
  ApplicationContext,
  DeactivationReason,
  Phone,
  PhoneApplicationSession,
} from "../src/index";
import { bootedPhone, makeFakeApp } from "./fixtures";
import type { FakeApp } from "./fixtures";

function appPhone(): { fake: FakeApp; phone: Phone } {
  const fake = makeFakeApp();
  const phone = bootedPhone({}, fake.application);
  phone.pressKey("navi");
  phone.pressKey("down");
  phone.pressKey("navi");
  phone.pressKey("navi");
  return { fake, phone };
}

describe("application hosting", () => {
  it("launches the definition attached to the selected ApplicationEntry", () => {
    const { phone } = appPhone();
    expect(phone.path).toBe("menu/messages/write");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "write-message" });
  });

  it("delegates raw key events and tick deltas to the active session", () => {
    const { fake, phone } = appPhone();
    phone.send({ type: "down", key: "5" });
    phone.send({ type: "up", key: "5" });
    expect(fake.keys).toEqual([
      { type: "down", key: "5" },
      { type: "up", key: "5" },
    ]);
    const before = fake.ticks.length;
    phone.tick(50_000);
    phone.tick(50_016);
    expect(fake.ticks.slice(before + 1)).toEqual([16]);
  });

  it("context.exit() returns to the containing menu and deactivates once", () => {
    const { fake, phone } = appPhone();
    phone.pressKey("c");
    expect(phone.path).toBe("menu/messages");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Messages", selected: 0 });
    expect(fake.deactivations).toEqual(["exit"]);
  });

  it("object handoff retains the origin path and stack", () => {
    const second = makeFakeApp("other-app");
    const firstReasons: DeactivationReason[] = [];
    class FirstApplication extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        return {
          onKey(event) {
            if (event.type === "up" && event.key === "5") context.open(second.application);
          },
          tick() {},
          render: () => ({ kind: "confirm", text: "first", softkey: "" }),
          onDeactivate: (reason) => firstReasons.push(reason),
        };
      }
    }
    const phone = bootedPhone({}, new FirstApplication("first"));
    phone.navigate("menu/messages/write");
    phone.pressKey("5");
    expect(firstReasons).toEqual(["replace"]);
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "other-app" });
    expect(phone.path).toBe("menu/messages/write");
    phone.pressKey("c");
    expect(second.deactivations).toEqual(["exit"]);
    expect(phone.path).toBe("menu/messages");
  });

  it("contains createSession failures and leaves the error screen navigable", () => {
    class BrokenApplication extends PhoneApplication {
      createSession(): PhoneApplicationSession {
        throw new Error("create failed");
      }
    }
    const phone = bootedPhone({}, new BrokenApplication("broken"));
    phone.navigate("menu/messages/write");
    expect(phone.path).toBe("menu/messages/write");
    expect(phone.screen).toEqual({
      kind: "reader",
      title: "Write messages",
      lines: ["App error"],
      scrollTop: 0,
      menuIndicator: { segments: [2, 1], awaitingNext: false },
    });
    phone.pressKey("c");
    expect(phone.path).toBe("menu/messages");
  });

  it("contains key, tick, render, and deactivation exceptions", () => {
    class BrokenApplication extends PhoneApplication {
      createSession(): PhoneApplicationSession {
        return {
          onKey() {
            throw new Error("key failed");
          },
          tick() {
            throw new Error("tick failed");
          },
          render() {
            throw new Error("render failed");
          },
          onDeactivate() {
            throw new Error("deactivation failed");
          },
        };
      }
    }
    const phone = bootedPhone({}, new BrokenApplication("broken"));
    phone.navigate("menu/messages/write");
    phone.pressKey("5");
    phone.tick(99_000);
    expect(phone.screen).toMatchObject({ kind: "reader", lines: ["App error"] });
    phone.navigate("menu/chat");
    expect(phone.path).toBe("menu/chat");
    phone.navigate("menu/messages/write");
    phone.pressKey("power", 1000);
    expect(phone.screen).toEqual({ kind: "off" });
  });
});

type ExitOptions = Parameters<ApplicationContext["exit"]>[0];

/** An application that calls exit(options) on a 5 key-up, or inside createSession when `atCreate`. */
function exitingApplication(
  options: ExitOptions,
  record: { reasons: DeactivationReason[]; renders: number },
  atCreate = false,
): PhoneApplication {
  class ExitingApplication extends PhoneApplication {
    createSession(context: ApplicationContext): PhoneApplicationSession {
      if (atCreate) context.exit(options);
      return {
        onKey(event) {
          if (event.type === "up" && event.key === "5") context.exit(options);
        },
        tick() {},
        render: () => {
          record.renders += 1;
          return { kind: "confirm", text: "app", softkey: "" };
        },
        onDeactivate: (reason) => record.reasons.push(reason),
      };
    }
  }
  return new ExitingApplication("exiting");
}

/** Divert (rows: five readers numbered 1, 2, 4, 5, 6, then 7 Busy) > Busy (rows) > Set delay (the application) / Number. */
function divertMenu(application: PhoneApplication): PhoneMenu {
  const busy = new SubmenuEntry(
    new MenuSlug("busy"),
    new MenuOrder(7),
    "Busy",
    new MenuLevel([
      new ApplicationEntry(new MenuSlug("set-delay"), new MenuOrder(1), "Set delay", application),
      new ReaderEntry(new MenuSlug("number"), new MenuOrder(2), "Number", "Body"),
    ]),
  );
  const divert = new SubmenuEntry(
    new MenuSlug("divert"),
    new MenuOrder(1),
    "Divert",
    new MenuLevel([
      ...[1, 2, 4, 5, 6].map(
        (number) =>
          new ReaderEntry(
            new MenuSlug(`item-${number}`),
            new MenuOrder(number),
            `Item ${number}`,
            "Body",
          ),
      ),
      busy,
    ]),
  );
  return new PhoneMenu([
    new TopLevelEntry(divert, new MenuGraphic("divert")),
    new TopLevelEntry(
      new ReaderEntry(new MenuSlug("other"), new MenuOrder(2), "Other", "Body"),
      new MenuGraphic("other"),
    ),
  ]);
}

describe("ApplicationContext.exit options", () => {
  it("exit({ to: 'standby' }) leaves the menus like C-hold, deactivating with exit", () => {
    const record = { reasons: [] as DeactivationReason[], renders: 0 };
    const phone = bootedPhone({}, exitingApplication({ to: "standby" }, record));
    phone.navigate("menu/messages/write");
    phone.pressKey("5");
    expect(phone.path).toBe("standby");
    expect(phone.screen).toMatchObject({ kind: "standby" });
    expect(record.reasons).toEqual(["exit"]);
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", menuNumber: 1 });
  });

  it("ignores levels and select with to: 'standby'", () => {
    const record = { reasons: [] as DeactivationReason[], renders: 0 };
    const phone = bootedPhone(
      {},
      exitingApplication({ to: "standby", levels: 99, select: "nope" }, record),
    );
    phone.navigate("menu/messages/write");
    phone.pressKey("5");
    expect(phone.path).toBe("standby");
  });

  it("exit() inside createSession returns to the stack, renders nothing and deactivates once", () => {
    const record = { reasons: [] as DeactivationReason[], renders: 0 };
    const phone = bootedPhone({}, exitingApplication(undefined, record, true));
    const screens: string[] = [];
    phone.subscribe((snap) => screens.push(snap.screen.kind));
    phone.navigate("menu/messages/write");
    expect(phone.path).toBe("menu/messages");
    expect(screens).toEqual(["list"]);
    expect(record.renders).toBe(0);
    expect(record.reasons).toEqual(["exit"]);
  });

  it("exit({ levels: 2 }) inside createSession returns to the carousel (View all)", () => {
    const record = { reasons: [] as DeactivationReason[], renders: 0 };
    const phone = bootedPhone({}, exitingApplication({ levels: 2 }, record, true));
    phone.navigate("menu/messages");
    phone.pressKey("navi");
    expect(phone.path).toBe("menu");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", menuNumber: 2 });
    expect(record).toEqual({ reasons: ["exit"], renders: 0 });
  });

  it("exit({ levels: 2 }) closes the enclosing level, keeping its parent's selection (Set delay)", () => {
    const record = { reasons: [] as DeactivationReason[], renders: 0 };
    const phone = bootedPhone({ menu: divertMenu(exitingApplication({ levels: 2 }, record)) });
    phone.navigate("menu/divert/busy/set-delay");
    phone.pressKey("5");
    expect(phone.path).toBe("menu/divert");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Divert", selected: 5 });
    expect(record.reasons).toEqual(["exit"]);
  });

  it("exit({ select }) selects a child of the level returned to, on the bottom row (Top score)", () => {
    const record = { reasons: [] as DeactivationReason[], renders: 0 };
    const menu = divertMenu(exitingApplication({ levels: 2, select: "item-1" }, record));
    const phone = bootedPhone({ menu, rowsWindow: 3 });
    phone.navigate("menu/divert");
    for (let index = 0; index < 5; index += 1) phone.pressKey("down");
    expect(phone.screen).toMatchObject({ selected: 5, windowTop: 3 });
    phone.pressKey("navi");
    phone.pressKey("navi");
    phone.pressKey("5");
    // Score IDs / Instructions / New game: the selection on the bottom row.
    expect(phone.screen).toMatchObject({ kind: "list", selected: 0, windowTop: 4 });

    const top = bootedPhone({}, exitingApplication({ levels: 2, select: "chat" }, record));
    top.navigate("menu/messages/write");
    top.pressKey("5");
    expect(top.screen).toMatchObject({ kind: "menu-carousel", menuNumber: 3 });
  });

  it("exit({ select, row: 'top' }) rebuilds the window with the child on the top row (Space impact's Top score)", () => {
    const record = { reasons: [] as DeactivationReason[], renders: 0 };
    const menu = divertMenu(exitingApplication({ levels: 2, select: "item-2" }, record));
    const phone = bootedPhone({ menu, rowsWindow: 3 });
    phone.navigate("menu/divert");
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ selected: 1, windowTop: 0 });
    for (let index = 0; index < 4; index += 1) phone.pressKey("down");
    phone.pressKey("navi");
    phone.pressKey("navi");
    phone.pressKey("5");
    // Bottom row by default: Busy / Item 1 / Item 2.
    expect(phone.screen).toMatchObject({ kind: "list", selected: 1, windowTop: 5 });

    const topRow = divertMenu(exitingApplication({ select: "set-delay", row: "top" }, record));
    const busy = bootedPhone({ menu: topRow, rowsWindow: 3 });
    busy.navigate("menu/divert/busy");
    busy.pressKey("navi");
    busy.pressKey("5");
    expect(busy.screen).toMatchObject({ kind: "list", title: "Busy", selected: 0, windowTop: 0 });

    const sameLevel = divertMenu(
      exitingApplication({ levels: 2, select: "item-5", row: "top" }, record),
    );
    const divert = bootedPhone({ menu: sameLevel, rowsWindow: 3 });
    divert.navigate("menu/divert/busy/set-delay");
    divert.pressKey("5");
    // Item 5 / Item 6 / Busy: the window rebuilt at the child, as on entry.
    expect(divert.screen).toMatchObject({ kind: "list", selected: 3, windowTop: 3 });
  });

  it("keeps row for rows windows only: pages levels and the carousel just select", () => {
    const record = { reasons: [] as DeactivationReason[], renders: 0 };
    const phone = bootedPhone(
      { rowsWindow: 3 },
      exitingApplication({ levels: 2, select: "chat", row: "top" }, record),
    );
    phone.navigate("menu/messages/write");
    phone.pressKey("5");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", menuNumber: 3 });
  });

  it("throws for levels or select outside the stack", () => {
    const errors: unknown[] = [];
    class CheckingApplication extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        for (const options of [
          { levels: 0 },
          { levels: 1.5 },
          { levels: 4 },
          { select: "nope" },
          { row: "top" as const },
          { select: "write", row: "middle" as "top" },
        ]) {
          try {
            context.exit(options);
          } catch (error) {
            errors.push(error);
          }
        }
        return {
          onKey() {},
          tick() {},
          render: () => ({ kind: "confirm", text: "app", softkey: "" }),
        };
      }
    }
    const phone = bootedPhone({}, new CheckingApplication("checking"));
    phone.navigate("menu/messages/write");
    expect(errors).toHaveLength(6);
    expect(String(errors[0])).toMatch(/levels/);
    expect(String(errors[3])).toMatch(/select/);
    expect(String(errors[4])).toMatch(/row needs select/);
    expect(String(errors[5])).toMatch(/row must be "top" or "bottom"/);
    expect(phone.path).toBe("menu/messages/write");
  });
});
