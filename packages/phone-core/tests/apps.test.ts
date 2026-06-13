import { describe, expect, it } from "vite-plus/test";
import { bootedPhone, makeFakeApp } from "./fixtures";
import type { FakeApp } from "./fixtures";
import type { Phone } from "../src/index";

/** Boots a phone with the fake app registered and navigates by key to Write messages. */
function appPhone(): { fake: FakeApp; phone: Phone } {
  const fake = makeFakeApp();
  const phone = bootedPhone({ apps: { "write-message": fake.factory } });
  phone.pressKey("navi"); // carousel (Phone book)
  phone.pressKey("down"); // Messages
  phone.pressKey("navi"); // enter Messages submenu
  phone.pressKey("navi"); // launch Write messages (first child, app node)
  return { fake, phone };
}

describe("app hosting", () => {
  it("launching an app node updates the path and shows the app's screen", () => {
    const { phone } = appPhone();
    expect(phone.path).toBe("menu/messages/write");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "write-message" });
  });

  it("delegates raw key events and tick deltas to the app", () => {
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
    expect(fake.ticks.slice(before + 1)).toEqual([16]); // dt, not absolute time
  });

  it("ctx.exit() returns to the containing menu", () => {
    const { fake, phone } = appPhone();
    phone.pressKey("c"); // fake app exits on c key-up
    expect(phone.path).toBe("menu/messages");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Messages", selected: 0 });
    expect(fake.exitCount()).toBe(0); // voluntary exit does NOT call onExit
  });

  it("powering off tears the app down via onExit", () => {
    const { fake, phone } = appPhone();
    phone.pressKey("power", 1000);
    expect(fake.exitCount()).toBe(1);
    expect(phone.screen).toEqual({ kind: "off" });
  });

  it("an app node with no registered factory is a no-op", () => {
    const phone = bootedPhone(); // no apps registered
    phone.pressKey("navi");
    phone.pressKey("down");
    phone.pressKey("navi"); // Messages submenu
    phone.pressKey("navi"); // try to launch Write messages — unregistered
    expect(phone.path).toBe("menu/messages");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Messages" });
  });

  it("a throwing app cannot break the machine", () => {
    const fake = makeFakeApp();
    const phone = bootedPhone({
      apps: {
        "write-message": (ctx) => {
          const inner = fake.factory(ctx);
          return {
            onKey() {
              throw new Error("boom");
            },
            tick() {
              throw new Error("boom");
            },
            render: () => inner.render(),
          };
        },
      },
    });
    phone.pressKey("navi");
    phone.pressKey("down");
    phone.pressKey("navi");
    phone.pressKey("navi"); // launch
    phone.pressKey("5"); // onKey throws — swallowed
    phone.tick(99_000); // tick throws — swallowed
    expect(phone.path).toBe("menu/messages/write");
    phone.pressKey("power", 100_000); // machine-level keys still work
    expect(phone.screen).toEqual({ kind: "off" });
  });
});
