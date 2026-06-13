import { describe, expect, it } from "vite-plus/test";
import { createPhone } from "../src/index";
import { bootedPhone, testConfig } from "./fixtures";

describe("actions & events", () => {
  it("selecting an action node emits 'action' and stays on the carousel", () => {
    const phone = bootedPhone();
    const actions: { kind: string; value: string }[] = [];
    phone.on("action", (a) => actions.push(a));
    phone.pressKey("navi");
    phone.pressKey("up"); // wraps backward to GitHub (last top-level item)
    phone.pressKey("navi");
    expect(actions).toEqual([{ kind: "href", value: "https://github.com/example" }]);
    expect(phone.path).toBe("menu");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", label: "GitHub" });
  });

  it("every key-down emits one key beep while powered on", () => {
    const phone = bootedPhone();
    const sounds: { kind: string; id: string }[] = [];
    phone.on("sound", (s) => sounds.push(s));
    phone.pressKey("navi");
    phone.pressKey("down");
    phone.pressKey("5");
    expect(sounds).toEqual([
      { kind: "key", id: "beep" },
      { kind: "key", id: "beep" },
      { kind: "key", id: "beep" },
    ]);
  });

  it("no beep while powered off", () => {
    const phone = createPhone(testConfig());
    const sounds: unknown[] = [];
    phone.on("sound", (s) => sounds.push(s));
    phone.pressKey("5");
    expect(sounds).toEqual([]);
  });

  it("pathchange fires only on actual path changes", () => {
    const phone = bootedPhone();
    const paths: string[] = [];
    phone.on("pathchange", (p) => paths.push(p));
    phone.pressKey("navi"); // standby → menu
    phone.pressKey("down"); // carousel scroll: path unchanged
    phone.pressKey("up");
    phone.pressKey("navi"); // menu → menu/phone-book
    phone.pressKey("navi"); // → menu/phone-book/search
    phone.pressKey("navi"); // open item: path unchanged (deviation note 4)
    phone.pressKey("down"); // reader scroll: path unchanged
    expect(paths).toEqual(["menu", "menu/phone-book", "menu/phone-book/search"]);
  });

  it("unsubscribing an event listener stops delivery", () => {
    const phone = bootedPhone();
    const paths: string[] = [];
    const off = phone.on("pathchange", (p) => paths.push(p));
    phone.pressKey("navi");
    off();
    phone.pressKey("navi");
    expect(paths).toEqual(["menu"]);
  });

  it("throwing listeners and subscribers never break the machine or each other", () => {
    const phone = bootedPhone();
    const seen: string[] = [];
    phone.on("pathchange", () => {
      throw new Error("boom");
    });
    phone.on("pathchange", (p) => seen.push(p));
    phone.subscribe(() => {
      throw new Error("boom");
    });
    phone.pressKey("navi");
    expect(phone.path).toBe("menu");
    expect(seen).toEqual(["menu"]);
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/phone-book"); // machine still consistent
  });
});
