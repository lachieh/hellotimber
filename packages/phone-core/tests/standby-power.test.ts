// Plan 17 Task 4: PhoneConfig.standbyPower (the power key's short press at standby opens a
// standby application) and ApplicationContext.powerOff().
import { describe, expect, it } from "vite-plus/test";
import { createPhone, PhoneApplication } from "../src/index";
import type {
  ApplicationContext,
  DeactivationReason,
  KeyEvent,
  PhoneApplicationSession,
} from "../src/index";
import { bootedPhone, makeFakeApp, testConfig } from "./fixtures";

/** The power list: records keys; C exits, OK powers off through the context. */
class PowerList extends PhoneApplication {
  readonly keys: string[] = [];
  readonly deactivations: DeactivationReason[] = [];
  readonly contexts: ApplicationContext[] = [];

  createSession(context: ApplicationContext): PhoneApplicationSession {
    this.contexts.push(context);
    return {
      onKey: (event: KeyEvent) => {
        this.keys.push(`${event.type} ${event.key}`);
        if (event.type === "up" && event.key === "c") context.exit();
        if (event.type === "up" && event.key === "navi") context.powerOff!();
      },
      tick: () => {},
      render: () => ({ kind: "confirm", text: "Switch off!", softkey: "OK" }),
      onDeactivate: (reason) => {
        this.deactivations.push(reason);
      },
    };
  }
}

function powerPhone(): { phone: ReturnType<typeof bootedPhone>; list: PowerList } {
  const list = new PowerList("power-list");
  return { phone: bootedPhone({ standbyPower: list }), list };
}

describe("standbyPower", () => {
  it("does nothing on a short press without it", () => {
    const phone = bootedPhone();
    phone.pressKey("power");
    expect(phone.screen.kind).toBe("standby");
  });

  it("opens on the power key's key-down at standby as a standby application", () => {
    const { phone, list } = powerPhone();
    phone.send({ type: "down", key: "power" });
    expect(phone.screen).toEqual({ kind: "confirm", text: "Switch off!", softkey: "OK" });
    expect(phone.path).toBe("standby");
    expect(list.keys).toEqual([]);
    expect(list.contexts[0]!.menuIndicator!()).toEqual({ segments: [], awaitingNext: false });
    phone.send({ type: "up", key: "power" });
    // The opening press's release, then every key, the power key's too, reach it.
    phone.pressKey("down");
    phone.pressKey("power");
    expect(list.keys).toEqual(["up power", "down down", "up down", "down power", "up power"]);
  });

  it("returns to standby on exit(); levels, select and row throw", () => {
    const { phone, list } = powerPhone();
    phone.pressKey("power");
    const context = list.contexts[0]!;
    expect(() => context.exit({ levels: 2 })).toThrow(/levels/);
    expect(() => context.exit({ select: "x" })).toThrow();
    phone.pressKey("c");
    expect(phone.screen.kind).toBe("standby");
    expect(list.deactivations).toEqual(["exit"]);
  });

  it("powers off on the power key's long press, deactivated once", () => {
    const { phone, list } = powerPhone();
    phone.tick(2000);
    phone.send({ type: "down", key: "power" });
    expect(phone.screen.kind).toBe("confirm");
    phone.tick(2800);
    phone.send({ type: "up", key: "power" });
    expect(phone.screen).toEqual({ kind: "off" });
    expect(list.deactivations).toEqual(["power-off"]);
  });

  it("is not opened in the menus, an application or the boot", () => {
    const list = new PowerList("power-list");
    const app = makeFakeApp();
    const phone = bootedPhone({ standbyPower: list }, app.application);
    phone.navigate("menu/phone-book");
    phone.pressKey("power");
    expect(phone.path).toBe("menu/phone-book");
    phone.navigate("menu/messages/write");
    phone.pressKey("power");
    expect(phone.path).toBe("menu/messages/write");
    expect(list.contexts).toHaveLength(0);

    const booting = createPhone(testConfig({ bootMs: 3000, standbyPower: list }));
    booting.tick(0);
    booting.pressKey("power", 1000);
    booting.tick(1500);
    booting.pressKey("power");
    expect(booting.screen.kind).toBe("boot");
    expect(list.contexts).toHaveLength(0);
  });

  it("opens over a standby notice, which stays", () => {
    const { phone, list } = powerPhone();
    phone.setNotice({ text: "1 message received", softkey: "Read" });
    phone.pressKey("power");
    expect(phone.screen.kind).toBe("confirm");
    expect(list.contexts).toHaveLength(1);
    phone.pressKey("c");
    expect(phone.screen).toMatchObject({ kind: "standby", notice: { softkey: "Read" } });
  });

  it("opens when an application leaves for standby on the power key's down", () => {
    const list = new PowerList("power-list");
    class StandbyNote extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        return {
          onKey: (event) => {
            if (event.type === "down" && event.key === "power") context.exit({ to: "standby" });
          },
          tick: () => {},
          render: () => ({ kind: "confirm", text: "Selected profile:", softkey: "" }),
        };
      }
    }
    const phone = bootedPhone({ standbyPower: list }, new StandbyNote("write-message"));
    phone.navigate("menu/messages/write");
    phone.send({ type: "down", key: "power" });
    expect(phone.screen).toEqual({ kind: "confirm", text: "Switch off!", softkey: "OK" });
    expect(phone.path).toBe("standby");
    phone.send({ type: "up", key: "power" });
    expect(list.keys).toEqual(["up power"]);
  });

  it("leaves for navigate(), deactivated with navigate", () => {
    const { phone, list } = powerPhone();
    phone.pressKey("power");
    phone.navigate("standby");
    expect(phone.screen.kind).toBe("standby");
    expect(list.deactivations).toEqual(["navigate"]);
    phone.pressKey("power");
    phone.navigate("menu/phone-book");
    expect(phone.path).toBe("menu/phone-book");
    expect(list.deactivations).toEqual(["navigate", "navigate"]);
  });
});

describe("ApplicationContext.powerOff", () => {
  it("powers the phone off, deactivating with power-off", () => {
    const { phone, list } = powerPhone();
    phone.pressKey("power");
    phone.pressKey("navi");
    expect(phone.screen).toEqual({ kind: "off" });
    expect(list.deactivations).toEqual(["power-off"]);
    phone.pressKey("power", 1000);
    expect(phone.screen.kind).toBe("standby");
  });

  it("is provided to menu applications too, and is a no-op for a stale activation", () => {
    const app = makeFakeApp();
    let context: ApplicationContext | undefined;
    class Grab extends PhoneApplication {
      createSession(ctx: ApplicationContext): PhoneApplicationSession {
        context = ctx;
        return app.application.createSession(ctx);
      }
    }
    const phone = bootedPhone({}, new Grab("write-message"));
    phone.navigate("menu/messages/write");
    expect(typeof context!.powerOff).toBe("function");
    phone.pressKey("c");
    expect(phone.path).toBe("menu/messages");
    context!.powerOff!();
    expect(phone.screen.kind).toBe("list");
    phone.navigate("menu/messages/write");
    context!.powerOff!();
    expect(phone.screen).toEqual({ kind: "off" });
    expect(app.deactivations).toEqual(["exit", "power-off"]);
  });
});
