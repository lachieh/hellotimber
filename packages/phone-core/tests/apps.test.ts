import { describe, expect, it } from "vite-plus/test";
import { PhoneApplication } from "../src/index";
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
