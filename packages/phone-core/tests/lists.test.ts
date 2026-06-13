import { describe, expect, it } from "vite-plus/test";
import { wrapLines } from "../src/index";
import type { ScreenModel } from "../src/index";
import { bootedPhone } from "./fixtures";

describe("lists, items & readers", () => {
  it("wrapLines wraps at 14 chars, hard-breaks long words, honors newlines", () => {
    expect(wrapLines("hello world")).toEqual(["hello world"]);
    expect(wrapLines("a veryverylongword14 b")).toEqual(["a", "veryverylongwo", "rd14 b"]);
    expect(wrapLines("one\ntwo")).toEqual(["one", "two"]);
  });

  it("list selection moves with up/down and wraps", () => {
    const phone = bootedPhone();
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
    const phone = bootedPhone();
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
    const phone = bootedPhone();
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
      menu: [{ type: "list", id: "empty", label: "Empty", items: [] }],
    });
    phone.pressKey("navi"); // carousel
    phone.pressKey("navi"); // enter the empty list
    expect(phone.path).toBe("menu/empty");
    phone.pressKey("down");
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "list", items: [], selected: 0 });
  });
});
