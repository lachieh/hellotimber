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
  KeyEvent,
  MenuEntry,
  MenuIndicator,
  Phone,
  PhoneApplicationSession,
} from "../src/index";
import { bootedPhone } from "./fixtures";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

function shortcutMenu(third?: MenuEntry): PhoneMenu {
  const roots: TopLevelEntry<unknown>[] = Array.from({ length: 4 }, (_, index) => {
    const number = index + 1;
    return new TopLevelEntry<unknown>(
      new ReaderEntry<unknown>(slug(`root-${number}`), order(number), `Root ${number}`, "Body"),
      new MenuGraphic(`root-${number}`),
    );
  });
  roots.push(
    new TopLevelEntry<unknown>(
      new SubmenuEntry<unknown>(
        slug("tones"),
        order(5),
        "Tones",
        new MenuLevel<unknown>([
          new ReaderEntry<unknown>(slug("first"), order(1), "First", "First body"),
          new ReaderEntry<unknown>(slug("second"), order(2), "Second", "Second body"),
          third ?? new ReaderEntry<unknown>(slug("third"), order(3), "Third", "Third body"),
        ]),
      ),
      new MenuGraphic("tones"),
    ),
  );
  return new PhoneMenu(roots);
}

function shortcutPhone(menu = shortcutMenu()): Phone {
  return bootedPhone({ menu });
}

function indicator(phone: Phone): MenuIndicator {
  const screen = phone.screen;
  if (screen.kind !== "menu-carousel" && screen.kind !== "list" && screen.kind !== "reader") {
    throw new Error(`Expected a menu screen, received ${screen.kind}.`);
  }
  if (screen.menuIndicator === undefined) throw new Error("Expected a firmware menu indicator.");
  return screen.menuIndicator;
}

describe("menu shortcuts", () => {
  it("marks the window as awaiting its first digit before a digit", () => {
    const phone = shortcutPhone();

    phone.pressKey("navi");

    expect(phone.path).toBe("menu");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", menuNumber: 1 });
    expect(indicator(phone)).toEqual({ segments: [1], awaitingNext: false, awaitingFirst: true });
  });

  it("drops awaitingFirst at the first accepted digit", () => {
    const phone = shortcutPhone();
    phone.pressKey("navi");
    phone.pressKey("5");
    expect(indicator(phone)).toEqual({ segments: [5], awaitingNext: true });
  });

  it("drops awaitingFirst exactly when the window times out, with one snapshot", () => {
    const phone = shortcutPhone(); // booted at now = 1000
    phone.pressKey("navi");
    const seen: MenuIndicator[] = [];
    phone.subscribe((snap) => {
      if (snap.screen.kind === "menu-carousel") seen.push(snap.screen.menuIndicator);
    });
    phone.tick(3_999);
    expect(indicator(phone).awaitingFirst).toBe(true);
    phone.tick(4_000);
    phone.tick(4_500);
    expect(seen).toEqual([{ segments: [1], awaitingNext: false }]);
  });

  it("drops awaitingFirst on a non-digit key-down", () => {
    const phone = shortcutPhone();
    phone.pressKey("navi");
    phone.send({ type: "down", key: "down" });
    expect(indicator(phone)).toEqual({ segments: [1], awaitingNext: false });
    phone.send({ type: "up", key: "down" });
    expect(indicator(phone)).toEqual({ segments: [2], awaitingNext: false });
  });

  it("never sets awaitingFirst outside the Menu window", () => {
    const phone = shortcutPhone();
    phone.navigate("menu");
    expect(indicator(phone)).toEqual({ segments: [1], awaitingNext: false });
    phone.navigate("menu/tones");
    expect(indicator(phone)).toEqual({ segments: [5], awaitingNext: false });
  });

  it("uses the configured shortcutWindowMs", () => {
    const phone = bootedPhone({ menu: shortcutMenu(), shortcutWindowMs: 2948 });
    phone.tick(1000);
    phone.pressKey("navi");
    phone.tick(3947);
    expect(indicator(phone).awaitingFirst).toBe(true);
    phone.tick(3948);
    expect(indicator(phone)).toEqual({ segments: [1], awaitingNext: false });
    expect(() => bootedPhone({ shortcutWindowMs: 0 })).toThrow(/shortcutWindowMs/);
  });

  it("silently closes the initial window when no digit was accepted", () => {
    const phone = shortcutPhone();
    phone.pressKey("navi");

    phone.tick(4_000);
    phone.pressKey("5");

    expect(phone.path).toBe("menu");
    expect(indicator(phone)).toEqual({ segments: [1], awaitingNext: false });
  });

  it("immediately enters each valid hierarchy level and exposes its canonical orders", () => {
    const phone = shortcutPhone();

    phone.pressKey("navi");
    phone.pressKey("5");
    expect(phone.path).toBe("menu/tones");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Tones" });
    expect(indicator(phone)).toEqual({ segments: [5], awaitingNext: true });

    phone.pressKey("3");
    expect(phone.path).toBe("menu/tones/third");
    expect(phone.screen).toMatchObject({ kind: "reader", title: "Third" });
    expect(indicator(phone)).toEqual({ segments: [5, 3], awaitingNext: true });
  });

  it("restarts the exact 3000ms deadline after every accepted digit", () => {
    const phone = shortcutPhone();
    phone.tick(100);
    phone.pressKey("navi");
    phone.pressKey("5");

    phone.tick(3_000);
    expect(indicator(phone).awaitingNext).toBe(true);
    phone.pressKey("3");

    phone.tick(5_999);
    expect(indicator(phone)).toEqual({ segments: [5, 3], awaitingNext: true });
    phone.tick(6_000);
    expect(phone.path).toBe("menu/tones/third");
    expect(indicator(phone)).toEqual({ segments: [5, 3], awaitingNext: false });
  });

  it.each(["c", "navi", "up", "down", "0", "*", "#", "power"] as const)(
    "%s removes the cursor on key-down before its normal short-press behavior",
    (key) => {
      const phone = shortcutPhone();
      phone.pressKey("navi");
      phone.pressKey("5");

      phone.send({ type: "down", key });
      expect(phone.path).toBe("menu/tones");
      expect(indicator(phone)).toEqual({ segments: [5], awaitingNext: false });

      phone.send({ type: "up", key });
      if (key === "c") expect(phone.path).toBe("menu");
      else if (key === "navi") expect(phone.path).toBe("menu/tones/first");
      else expect(phone.path).toBe("menu/tones");
    },
  );

  it("preserves long-press behavior after power removes the cursor", () => {
    const phone = shortcutPhone();
    phone.pressKey("navi");
    phone.pressKey("5");

    phone.send({ type: "down", key: "power" });
    expect(indicator(phone).awaitingNext).toBe(false);
    phone.tick(1_800);
    phone.send({ type: "up", key: "power" });

    expect(phone.screen).toEqual({ kind: "off" });
  });

  it("leaves path, model, segments, and deadline unchanged for an invalid 1-9 digit", () => {
    const phone = shortcutPhone();
    phone.tick(1_000);
    phone.pressKey("navi");
    phone.pressKey("5");
    const before = phone.screen;

    phone.tick(2_000);
    phone.pressKey("9");
    expect(phone.path).toBe("menu/tones");
    expect(phone.screen).toEqual(before);

    phone.tick(3_999);
    expect(indicator(phone).awaitingNext).toBe(true);
    phone.tick(4_000);
    expect(indicator(phone)).toEqual({ segments: [5], awaitingNext: false });
  });

  it("derives inactive segments for direct and ordinary navigation and shortens them on C", () => {
    const phone = shortcutPhone();

    phone.navigate("menu/tones/third");
    expect(indicator(phone)).toEqual({ segments: [5, 3], awaitingNext: false });
    phone.pressKey("c");
    expect(phone.path).toBe("menu/tones");
    expect(indicator(phone)).toEqual({ segments: [5], awaitingNext: false });
    phone.pressKey("c");
    expect(phone.path).toBe("menu");
    expect(indicator(phone)).toEqual({ segments: [5], awaitingNext: false });

    phone.pressKey("up");
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/root-4");
    expect(indicator(phone)).toEqual({ segments: [4], awaitingNext: false });
  });

  it("emits each valid path once and every visible cursor transition to subscribers", () => {
    const phone = shortcutPhone();
    const paths: string[] = [];
    const snapshots: { path: string; indicator: unknown }[] = [];
    phone.on("pathchange", (path) => paths.push(path));
    phone.subscribe((snapshot) => {
      const screen = snapshot.screen;
      snapshots.push({
        path: snapshot.path,
        indicator:
          screen.kind === "menu-carousel" || screen.kind === "list" || screen.kind === "reader"
            ? screen.menuIndicator
            : undefined,
      });
    });

    phone.pressKey("navi");
    paths.length = 0;
    snapshots.length = 0;
    phone.pressKey("5");
    phone.pressKey("3");
    phone.tick(4_000);

    expect(paths).toEqual(["menu/tones", "menu/tones/third"]);
    expect(snapshots).toEqual([
      { path: "menu/tones", indicator: { segments: [5], awaitingNext: true } },
      { path: "menu/tones/third", indicator: { segments: [5, 3], awaitingNext: true } },
      { path: "menu/tones/third", indicator: { segments: [5, 3], awaitingNext: false } },
    ]);
  });

  it("keeps app stacks canonical and withholds shortcut digits until entry closes", () => {
    const keys: KeyEvent[] = [];
    class RecordingApplication extends PhoneApplication {
      createSession(_context: ApplicationContext): PhoneApplicationSession {
        return {
          onKey: (event) => keys.push(event),
          tick() {},
          render: () => ({ kind: "confirm", text: "Running", softkey: "" }),
        };
      }
    }
    const app = new ApplicationEntry(
      slug("third"),
      order(3),
      "Third",
      new RecordingApplication("recording"),
    );
    const phone = shortcutPhone(shortcutMenu(app));

    phone.pressKey("navi");
    phone.pressKey("5");
    phone.pressKey("3");
    expect(phone.path).toBe("menu/tones/third");
    expect(keys).toEqual([]);

    phone.pressKey("9");
    expect(keys).toEqual([]);
    phone.tick(4_000);
    phone.pressKey("9");
    expect(keys).toEqual([
      { type: "down", key: "9" },
      { type: "up", key: "9" },
    ]);
  });

  it("does not treat canonical orders 10-13 as direct digit shortcuts", () => {
    const menu = new PhoneMenu(
      Array.from({ length: 13 }, (_, index) => {
        const menuNumber = index + 1;
        return new TopLevelEntry(
          new ReaderEntry(
            new MenuSlug(`item-${menuNumber}`),
            new MenuOrder(menuNumber),
            `Item ${menuNumber}`,
            "Body",
          ),
          new MenuGraphic(`item-${menuNumber}`),
        );
      }),
    );
    const phone = bootedPhone({ menu });
    phone.pressKey("navi");
    phone.pressKey("1");
    expect(phone.path).toBe("menu/item-1");
    phone.pressKey("0");
    expect(indicator(phone)).toEqual({ segments: [1], awaitingNext: false });

    phone.navigate("menu");
    for (let index = 1; index < 10; index += 1) phone.pressKey("down");
    expect(phone.screen).toMatchObject({ label: "Item 10", menuNumber: 10 });
  });
});
