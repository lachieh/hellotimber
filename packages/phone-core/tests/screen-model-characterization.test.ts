import { describe, expect, it } from "vite-plus/test";
import {
  ActionEntry,
  ApplicationEntry,
  createPhone,
  ListEntry,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneApplication,
  PhoneMenu,
  ReaderEntry,
  StaticMenuListSource,
  SubmenuEntry,
  TopLevelEntry,
} from "../src/index";
import type { ApplicationContext, Phone, PhoneApplicationSession } from "../src/index";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

class WorkingApplication extends PhoneApplication {
  createSession(context: ApplicationContext): PhoneApplicationSession {
    return {
      onKey(event) {
        if (event.type === "up" && event.key === "c") context.exit();
      },
      tick() {},
      render: () => ({ kind: "confirm", text: "App running", softkey: "" }),
    };
  }
}

class BrokenApplication extends PhoneApplication {
  createSession(): PhoneApplicationSession {
    return {
      onKey() {},
      tick() {},
      render() {
        throw new Error("render failed");
      },
    };
  }
}

const menu = new PhoneMenu([
  new TopLevelEntry(
    new SubmenuEntry(
      slug("tools"),
      order(1),
      "Tools",
      new MenuLevel([
        new ListEntry(
          slug("contacts"),
          order(1),
          "Contacts",
          new StaticMenuListSource([{ id: "ada", label: "Ada", body: "First contact." }]),
        ),
        new ReaderEntry(slug("info"), order(2), "Info", "One two three four"),
        new ApplicationEntry(
          slug("working"),
          order(3),
          "Working",
          new WorkingApplication("working"),
        ),
        new ActionEntry(slug("external"), order(4), "External", {
          kind: "href",
          value: "https://example.com",
        }),
      ]),
    ),
    new MenuGraphic("toolbox"),
  ),
  new TopLevelEntry(
    new ApplicationEntry(slug("broken"), order(2), "Broken", new BrokenApplication("broken")),
    new MenuGraphic("broken"),
  ),
]);

function bootedPhone(): Phone {
  const phone = createPhone({ menu, bootMs: 0 });
  phone.tick(0);
  phone.pressKey("power", 1000);
  return phone;
}

describe("ScreenModel characterization", () => {
  it("pins carousel, submenu, list-item reader, and reader output", () => {
    const phone = bootedPhone();
    phone.navigate("menu");
    expect(phone.screen).toEqual({
      kind: "menu-carousel",
      label: "Tools",
      menuNumber: 1,
      total: 2,
      iconId: "toolbox",
      menuIndicator: { segments: [1], awaitingNext: false },
    });
    phone.navigate("menu/tools");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Tools",
      items: ["Contacts", "Info", "Working", "External"],
      selected: 0,
      softkey: "Select",
      menuIndicator: { segments: [1], awaitingNext: false },
    });
    phone.navigate("menu/tools/contacts");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Contacts",
      items: ["Ada"],
      selected: 0,
      softkey: "Select",
      menuIndicator: { segments: [1, 1], awaitingNext: false },
    });
    phone.pressKey("navi");
    expect(phone.screen).toEqual({
      kind: "reader",
      title: "Ada",
      lines: ["First contact."],
      scrollTop: 0,
      menuIndicator: { segments: [1, 1], awaitingNext: false },
    });
    expect(phone.path).toBe("menu/tools/contacts");
    phone.navigate("menu/tools/info");
    expect(phone.screen).toEqual({
      kind: "reader",
      title: "Info",
      lines: ["One two three", "four"],
      scrollTop: 0,
      menuIndicator: { segments: [1, 2], awaitingNext: false },
    });
  });

  it("pins action output as the selected parent screen and emitted host action", () => {
    const phone = bootedPhone();
    const actions: { kind: "href"; value: string }[] = [];
    phone.on("action", (action) => actions.push(action));
    phone.navigate("menu/tools");
    phone.pressKey("up");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 3 });
    phone.pressKey("navi");
    expect(actions).toEqual([{ kind: "href", value: "https://example.com" }]);
    expect(phone.path).toBe("menu/tools");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 3 });

    actions.length = 0;
    phone.navigate("menu/tools/external");
    expect(actions).toEqual([]);
    expect(phone.path).toBe("menu/tools/external");
    expect(phone.screen).toMatchObject({
      kind: "list",
      selected: 3,
      menuIndicator: { segments: [1, 4], awaitingNext: false },
    });
  });

  it("pins hosted app and app render-error output", () => {
    const phone = bootedPhone();
    phone.navigate("menu/tools/working");
    expect(phone.path).toBe("menu/tools/working");
    expect(phone.screen).toEqual({ kind: "confirm", text: "App running", softkey: "" });
    phone.pressKey("c");
    expect(phone.path).toBe("menu/tools");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Tools",
      items: ["Contacts", "Info", "Working", "External"],
      selected: 2,
      softkey: "Select",
      menuIndicator: { segments: [1], awaitingNext: false },
    });
    phone.navigate("menu/broken");
    expect(phone.path).toBe("menu/broken");
    expect(phone.screen).toEqual({
      kind: "reader",
      title: "Broken",
      lines: ["App error"],
      scrollTop: 0,
      menuIndicator: { segments: [2], awaitingNext: false },
    });
  });
});
