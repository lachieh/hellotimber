import {
  ApplicationEntry,
  createPhone,
  ListEntry,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneMenu,
  StaticMenuListSource,
  SubmenuEntry,
  TopLevelEntry,
} from "@hellotimber/phone-core";
import type { Phone, PhoneApplication } from "@hellotimber/phone-core";
import type { SnakeGame, SnakeState } from "@hellotimber/snake";
import { describe, expect, it } from "vite-plus/test";
import { ChatApplication } from "../src/phone/applications/chat";
import { ConfiguredEditorApplication } from "../src/phone/applications/editor";
import { PickerApplication } from "../src/phone/applications/picker";
import { SmsApplication } from "../src/phone/applications/sms";
import { SnakeApplication } from "../src/phone/applications/snake";

function app(slug: string, label: string, application: PhoneApplication, order = 1) {
  return new ApplicationEntry(new MenuSlug(slug), new MenuOrder(order), label, application);
}

function submenu(slug: string, label: string, entries: ConstructorParameters<typeof MenuLevel>[0]) {
  return new SubmenuEntry(new MenuSlug(slug), new MenuOrder(1), label, new MenuLevel(entries));
}

function menu(entry: ConstructorParameters<typeof TopLevelEntry>[0]): PhoneMenu {
  return new PhoneMenu([new TopLevelEntry(entry, new MenuGraphic(entry.slug.value))]);
}

function bootedPhone(phoneMenu: PhoneMenu): Phone {
  const phone = createPhone({ menu: phoneMenu, bootMs: 0 });
  phone.tick(0);
  phone.pressKey("power", 1000);
  return phone;
}

function expectForcedNavigationAndPowerOff(makePhone: () => Phone, appPath: string): void {
  const forced = makePhone();
  forced.navigate(appPath);
  forced.navigate("standby");
  expect(forced.path).toBe("standby");
  expect(forced.screen).toMatchObject({ kind: "standby" });

  const powered = makePhone();
  powered.navigate(appPath);
  powered.pressKey("power", 1000);
  expect(powered.path).toBe("standby");
  expect(powered.screen).toEqual({ kind: "off" });
}

describe("concrete object application path traces", () => {
  it("pins SMS launch, path-invisible handoffs, exit destination, navigation, and power-off", () => {
    const application = new SmsApplication({
      contacts: [{ id: "ada", name: "Ada" }],
      send: () => Promise.resolve("Reply"),
      recordSend() {},
      recordReceive() {},
      notify() {},
      playAlert() {},
      replyDelayMs: () => 5000,
      schedule() {},
    });
    const messages = menu(
      submenu("messages", "Messages", [
        app("write", "Write messages", application),
        new ListEntry(
          new MenuSlug("inbox"),
          new MenuOrder(2),
          "Inbox",
          new StaticMenuListSource([]),
        ),
      ]),
    );
    const makePhone = () => bootedPhone(messages);
    const phone = makePhone();

    phone.navigate("menu/messages/write");
    expect(phone.path).toBe("menu/messages/write");
    expect(phone.screen).toEqual({
      kind: "editor",
      title: "Message:",
      text: "",
      cursor: 0,
      mode: "Abc",
      limit: 160,
    });
    phone.pressKey("4");
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/messages/write");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Options",
      items: ["Send", "Clear text", "Exit"],
      selected: 0,
      softkey: "Select",
    });
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/messages/write");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "To:",
      items: ["Ada"],
      selected: 0,
      softkey: "OK",
    });
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/messages/write");
    expect(phone.screen).toEqual({ kind: "confirm", text: "Sending message", softkey: "" });
    phone.tick(2200);
    expect(phone.screen).toEqual({ kind: "confirm", text: "Message sent", softkey: "" });
    phone.tick(3000);
    expect(phone.path).toBe("menu/messages");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Messages",
      items: ["Write messages", "Inbox"],
      selected: 0,
      softkey: "Select",
      menuIndicator: { segments: [1], awaitingNext: false },
    });

    expectForcedNavigationAndPowerOff(makePhone, "menu/messages/write");
  });

  it("pins Chat launch, compose handoff, exit destination, navigation, and power-off", () => {
    const application = new ChatApplication({
      nickname: "Lachlan",
      thread: () => [],
      seed() {},
      send: () => Promise.resolve("Reply"),
      recordSend() {},
      recordReceive() {},
      playAlert() {},
      schedule() {},
    });
    const chat = menu(app("chat", "Chat", application));
    const makePhone = () => bootedPhone(chat);
    const phone = makePhone();

    phone.navigate("menu/chat");
    expect(phone.path).toBe("menu/chat");
    expect(phone.screen).toEqual({
      kind: "reader",
      title: "Lachlan",
      lines: ["No messages"],
      scrollTop: 0,
    });
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/chat");
    expect(phone.screen).toEqual({
      kind: "editor",
      title: "Chat:",
      text: "",
      cursor: 0,
      mode: "Abc",
      limit: 160,
    });
    phone.pressKey("c");
    expect(phone.path).toBe("menu/chat");
    expect(phone.screen).toEqual({
      kind: "reader",
      title: "Lachlan",
      lines: ["No messages"],
      scrollTop: 0,
    });
    phone.pressKey("c");
    expect(phone.path).toBe("menu");
    expect(phone.screen).toEqual({
      kind: "menu-carousel",
      label: "Chat",
      menuNumber: 1,
      total: 1,
      iconId: "chat",
      menuIndicator: { segments: [1], awaitingNext: false },
    });

    expectForcedNavigationAndPowerOff(makePhone, "menu/chat");
  });

  it("pins Snake launch, exit destination, forced-navigation teardown, and power-off teardown", () => {
    const makeHarness = () => {
      const state: SnakeState = {
        cols: 21,
        rows: 10,
        snake: [
          { x: 6, y: 5 },
          { x: 5, y: 5 },
          { x: 4, y: 5 },
        ],
        dir: "right",
        pendingDir: null,
        food: { x: 10, y: 5 },
        bonus: null,
        foodsEaten: 0,
        score: 0,
        level: 1,
        maze: 0,
        walls: [],
        status: "running",
        flashOn: true,
      };
      let pauses = 0;
      const game: SnakeGame = {
        get state() {
          return state;
        },
        dispatch() {},
        tick: () => true,
        pause() {
          pauses += 1;
          state.status = "paused";
        },
        resume() {
          state.status = "running";
        },
        reset() {},
      };
      const application = new SnakeApplication({
        createGame: () => game,
        topScore: { read: () => 0, write() {} },
      });
      const games = menu(submenu("games", "Games", [app("snake", "Snake II", application)]));
      return { phone: bootedPhone(games), pauses: () => pauses };
    };

    const exited = makeHarness();
    exited.phone.navigate("menu/games/snake");
    expect(exited.phone.path).toBe("menu/games/snake");
    expect(exited.phone.screen).toMatchObject({ kind: "custom", appId: "snake" });
    exited.phone.pressKey("c");
    expect(exited.pauses()).toBe(1);
    expect(exited.phone.path).toBe("menu/games");
    expect(exited.phone.screen).toEqual({
      kind: "list",
      title: "Games",
      items: ["Snake II"],
      selected: 0,
      softkey: "Select",
      menuIndicator: { segments: [1], awaitingNext: false },
    });

    const forced = makeHarness();
    forced.phone.navigate("menu/games/snake");
    forced.phone.navigate("standby");
    expect(forced.pauses()).toBe(1);

    const powered = makeHarness();
    powered.phone.navigate("menu/games/snake");
    powered.phone.pressKey("power", 1000);
    expect(powered.pauses()).toBe(1);
    expect(powered.phone.screen).toEqual({ kind: "off" });
  });

  it("pins picker launch, exit destination, forced navigation, and power-off", () => {
    const picks: number[] = [];
    const picker = new PickerApplication("keypad-tones", {
      title: "Keypad tones",
      options: ["On", "Off"],
      selected: () => 1,
      onPick: (index) => picks.push(index),
    });
    const tones = menu(submenu("tones", "Tones", [app("keypad-tones", "Keypad tones", picker)]));
    const makePhone = () => bootedPhone(tones);
    const phone = makePhone();

    phone.navigate("menu/tones/keypad-tones");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Keypad tones",
      items: ["On", "Off"],
      selected: 1,
      softkey: "OK",
    });
    phone.pressKey("navi");
    expect(picks).toEqual([1]);
    expect(phone.path).toBe("menu/tones");

    expectForcedNavigationAndPowerOff(makePhone, "menu/tones/keypad-tones");
  });

  it("pins editor launch, exit destination, fresh state, forced navigation, and power-off", () => {
    const accepted: string[] = [];
    const editor = new ConfiguredEditorApplication("welcome-note", {
      title: "Welcome note",
      onAccept: (text) => accepted.push(text),
    });
    const settings = menu(
      submenu("settings", "Settings", [
        submenu("phone-settings", "Phone settings", [app("welcome-note", "Welcome note", editor)]),
      ]),
    );
    const makePhone = () => bootedPhone(settings);
    const phone = makePhone();

    phone.navigate("menu/settings/phone-settings/welcome-note");
    expect(phone.screen).toEqual({
      kind: "editor",
      title: "Welcome note",
      text: "",
      cursor: 0,
      mode: "Abc",
    });
    phone.pressKey("4");
    phone.pressKey("navi");
    expect(accepted).toEqual(["G"]);
    expect(phone.path).toBe("menu/settings/phone-settings");
    phone.navigate("menu/settings/phone-settings/welcome-note");
    expect(phone.screen).toMatchObject({ kind: "editor", text: "", cursor: 0 });

    expectForcedNavigationAndPowerOff(makePhone, "menu/settings/phone-settings/welcome-note");
  });
});
