import { describe, expect, it } from "vite-plus/test";
import {
  DynamicMenuListSource,
  ListEntry,
  MenuGraphic,
  MenuOrder,
  MenuSlug,
  PhoneMenu,
  StaticMenuListSource,
  TopLevelEntry,
  wrapLines,
} from "../src/index";
import type { MenuListSource, ScreenModel } from "../src/index";
import { bootedPhone, TEST_STANDBY_KEYS } from "./fixtures";

function listMenu(source: MenuListSource, label = "Lazy"): PhoneMenu {
  return new PhoneMenu([
    new TopLevelEntry(
      new ListEntry(new MenuSlug(label.toLowerCase()), new MenuOrder(1), label, source),
      new MenuGraphic(label.toLowerCase()),
    ),
  ]);
}

describe("lists, items & readers", () => {
  it("wrapLines wraps at 14 chars, hard-breaks long words, honors newlines", () => {
    expect(wrapLines("hello world")).toEqual(["hello world"]);
    expect(wrapLines("a veryverylongword14 b")).toEqual(["a", "veryverylongwo", "rd14 b"]);
    expect(wrapLines("one\ntwo")).toEqual(["one", "two"]);
  });

  it("list selection moves with up/down and wraps", () => {
    const phone = bootedPhone({ standbyKeys: TEST_STANDBY_KEYS });
    phone.pressKey("up"); // standby shortcut → Search list (Alice, Bob)
    expect(phone.screen).toMatchObject({ kind: "list", items: ["Alice", "Bob"], selected: 0 });
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ selected: 1 });
    phone.pressKey("down"); // wraps
    expect(phone.screen).toMatchObject({ selected: 0 });
    phone.pressKey("up"); // wraps backward
    expect(phone.screen).toMatchObject({ selected: 1 });
  });

  it("navi opens the selected item as a reader; the path stays at the list", () => {
    const phone = bootedPhone({ standbyKeys: TEST_STANDBY_KEYS });
    phone.pressKey("up");
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "reader", title: "Alice", scrollTop: 0 });
    expect(phone.path).toBe("menu/phone-book/search");
    phone.pressKey("c"); // back to the list, selection kept
    expect(phone.screen).toMatchObject({ kind: "list", selected: 0 });
  });

  it("submenu selection is restored when stepping back from a child", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    phone.pressKey("navi"); // Phone book submenu
    phone.pressKey("down"); // select Memory status
    phone.pressKey("navi"); // open it (reader node)
    expect(phone.path).toBe("menu/phone-book/memory-status");
    phone.pressKey("c");
    expect(phone.path).toBe("menu/phone-book");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 1 });
  });

  it("reader scrolls down and up, clamped to the content", () => {
    const phone = bootedPhone({ standbyKeys: TEST_STANDBY_KEYS });
    phone.pressKey("up");
    phone.pressKey("navi"); // open Alice (long body → several wrapped lines)
    phone.pressKey("up"); // already at top — no change
    expect(phone.screen).toMatchObject({ kind: "reader", scrollTop: 0 });
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ scrollTop: 1 });
    for (let i = 0; i < 50; i++) phone.pressKey("down");
    const reader = phone.screen as Extract<ScreenModel, { kind: "reader" }>;
    expect(reader.scrollTop).toBe(reader.lines.length - 3); // clamped at maxTop
    phone.pressKey("up");
    expect(phone.screen).toMatchObject({ scrollTop: reader.scrollTop - 1 });
  });

  it("an empty list ignores navi and arrows", () => {
    const phone = bootedPhone({
      menu: listMenu(new StaticMenuListSource([]), "Empty"),
    });
    phone.pressKey("navi"); // carousel
    phone.pressKey("navi"); // enter the empty list
    expect(phone.path).toBe("menu/empty");
    phone.pressKey("down");
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "list", items: [], selected: 0 });
  });

  it("a lazy list re-reads its items thunk on every render", () => {
    const backing = [
      { id: "one", label: "One", body: "First." },
      { id: "two", label: "Two", body: "Second." },
    ];
    const phone = bootedPhone({
      menu: listMenu(new DynamicMenuListSource(() => backing)),
    });
    phone.pressKey("navi"); // carousel
    phone.pressKey("navi"); // enter the list
    expect(phone.screen).toMatchObject({ kind: "list", items: ["One", "Two"], selected: 0 });
    backing.push({ id: "three", label: "Three", body: "Third." });
    expect(phone.screen).toMatchObject({ items: ["One", "Two", "Three"] });
    phone.pressKey("down");
    phone.pressKey("down"); // select Three
    expect(phone.screen).toMatchObject({ selected: 2 });
  });

  it("lazy list selection clamps when the list shrinks", () => {
    const backing = [
      { id: "one", label: "One", body: "First." },
      { id: "two", label: "Two", body: "Second." },
      { id: "three", label: "Three", body: "Third." },
    ];
    const phone = bootedPhone({
      menu: listMenu(new DynamicMenuListSource(() => backing)),
    });
    phone.pressKey("navi");
    phone.pressKey("navi"); // enter the list
    phone.pressKey("down");
    phone.pressKey("down"); // select Three
    expect(phone.screen).toMatchObject({ selected: 2 });
    backing.splice(1); // shrink to just One
    expect(phone.screen).toMatchObject({ items: ["One"], selected: 0 });
    phone.pressKey("navi"); // opens the clamped item, not a stale index
    expect(phone.screen).toMatchObject({ kind: "reader", title: "One" });
  });

  it("tracks a dynamic selection by stable ID across prepends and reorders", () => {
    const backing = [
      { id: "one", label: "One", body: "First." },
      { id: "two", label: "Two", body: "Second." },
      { id: "three", label: "Three", body: "Third." },
    ];
    const phone = bootedPhone({ menu: listMenu(new DynamicMenuListSource(() => backing)) });
    phone.navigate("menu/lazy");
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ selected: 1 });

    backing.unshift({ id: "zero", label: "Zero", body: "Zeroth." });
    expect(phone.screen).toMatchObject({ items: ["Zero", "One", "Two", "Three"], selected: 2 });
    backing.splice(0, backing.length, backing[2]!, backing[0]!, backing[1]!, backing[3]!);
    expect(phone.screen).toMatchObject({ items: ["Two", "Zero", "One", "Three"], selected: 0 });
  });

  it("clamps the previous index when the selected stable ID disappears", () => {
    const backing = [
      { id: "one", label: "One", body: "First." },
      { id: "two", label: "Two", body: "Second." },
      { id: "three", label: "Three", body: "Third." },
    ];
    const phone = bootedPhone({ menu: listMenu(new DynamicMenuListSource(() => backing)) });
    phone.navigate("menu/lazy");
    phone.pressKey("down");
    phone.pressKey("down");
    backing.splice(2, 1);
    expect(phone.screen).toMatchObject({ items: ["One", "Two"], selected: 1 });
  });

  it("keeps an open reader on its immutable row snapshot until back", () => {
    const backing = [{ id: "one", label: "Original", body: "Original body." }];
    const phone = bootedPhone({ menu: listMenu(new DynamicMenuListSource(() => backing)) });
    phone.navigate("menu/lazy");
    phone.pressKey("navi");
    backing[0] = { id: "one", label: "Updated", body: "Updated body." };
    expect(phone.screen).toEqual({
      kind: "reader",
      title: "Original",
      lines: ["Original body."],
      scrollTop: 0,
      menuIndicator: { segments: [1], awaitingNext: false },
    });
    phone.pressKey("c");
    expect(phone.screen).toMatchObject({ kind: "list", items: ["Updated"], selected: 0 });
  });
});
