import { describe, expect, it } from "vite-plus/test";
import { createPhone } from "../src/index";
import { bootedPhone, makeFakeApp, testConfig } from "./fixtures";

describe("navigate(path)", () => {
  it("jumps to a deep path with carousel and selections positioned", () => {
    const phone = bootedPhone();
    phone.navigate("menu/messages/inbox");
    expect(phone.path).toBe("menu/messages/inbox");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Inbox" });
    phone.pressKey("c"); // back: Messages submenu with Inbox selected
    expect(phone.path).toBe("menu/messages");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Messages", selected: 1 });
    phone.pressKey("c"); // back: carousel positioned on Messages
    expect(phone.screen).toMatchObject({
      kind: "menu-carousel",
      label: "Messages",
      menuNumber: 2,
    });
  });

  it("accepts 'menu' and 'standby' and leading/trailing slashes", () => {
    const phone = bootedPhone();
    phone.navigate("/menu/");
    expect(phone.path).toBe("menu");
    phone.navigate("standby");
    expect(phone.path).toBe("standby");
  });

  it("unknown paths fall back to standby", () => {
    const phone = bootedPhone();
    phone.navigate("menu/messages/inbox");
    phone.navigate("menu/does-not-exist");
    expect(phone.path).toBe("standby");
    phone.navigate("complete/garbage");
    expect(phone.path).toBe("standby");
  });

  it("navigating to the current path is a no-op and emits no pathchange", () => {
    const phone = bootedPhone();
    phone.navigate("menu/messages");
    const paths: string[] = [];
    phone.on("pathchange", (p) => paths.push(p));
    phone.navigate("menu/messages");
    phone.navigate("/menu/messages/"); // same after normalization
    expect(paths).toEqual([]);
    expect(phone.path).toBe("menu/messages");
  });

  it("emits exactly one pathchange when the path actually changes", () => {
    const phone = bootedPhone();
    const paths: string[] = [];
    phone.on("pathchange", (p) => paths.push(p));
    phone.navigate("menu/phone-book");
    expect(paths).toEqual(["menu/phone-book"]);
  });

  it("navigate while off powers on through boot, then lands on the target", () => {
    const phone = createPhone(testConfig({ bootMs: 1000 }));
    phone.tick(0);
    phone.navigate("menu/chat");
    expect(phone.screen.kind).toBe("boot");
    expect(phone.path).toBe("standby"); // not there yet
    const paths: string[] = [];
    phone.on("pathchange", (p) => paths.push(p));
    phone.tick(500);
    phone.tick(1000); // boot completes → land on target
    expect(phone.path).toBe("menu/chat");
    expect(paths).toEqual(["menu/chat"]);
    expect(phone.screen).toMatchObject({ kind: "reader", title: "Chat" });
  });

  it("navigate('standby') while off leaves the phone off", () => {
    const phone = createPhone(testConfig());
    phone.navigate("standby");
    expect(phone.screen).toEqual({ kind: "off" });
  });

  it("navigate while booting retargets the pending path", () => {
    const phone = createPhone(testConfig({ bootMs: 1000 }));
    phone.tick(0);
    phone.navigate("menu/chat");
    phone.navigate("menu/phone-book"); // changed our mind mid-boot
    phone.tick(1000);
    expect(phone.path).toBe("menu/phone-book");
  });

  it("navigate to an app path launches the app", () => {
    const fake = makeFakeApp();
    const phone = bootedPhone({ apps: { "write-message": fake.factory } });
    phone.navigate("menu/messages/write");
    expect(phone.path).toBe("menu/messages/write");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "write-message" });
  });

  it("navigating away from an app tears it down via onExit", () => {
    const fake = makeFakeApp();
    const phone = bootedPhone({ apps: { "write-message": fake.factory } });
    phone.navigate("menu/messages/write");
    phone.navigate("menu/chat");
    expect(fake.exitCount()).toBe(1);
    expect(phone.path).toBe("menu/chat");
  });
});
