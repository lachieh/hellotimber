import { describe, expect, it } from "vite-plus/test";
import { createPhone, editorApp } from "../src/index";
import type { Phone, ScreenModel } from "../src/index";
import { testConfig } from "./fixtures";

function editorPhone(onAccept?: (text: string) => void): Phone {
  const phone = createPhone(
    testConfig({ apps: { "write-message": editorApp({ title: "Message:", onAccept }) } }),
  );
  phone.tick(0);
  phone.pressKey("power", 1000);
  phone.navigate("menu/messages/write");
  return phone;
}

function editorScreen(phone: Phone): Extract<ScreenModel, { kind: "editor" }> {
  const s = phone.screen;
  if (s.kind !== "editor") throw new Error(`expected editor screen, got ${s.kind}`);
  return s;
}

describe("editor app", () => {
  it("renders an empty editor in Abc mode", () => {
    const phone = editorPhone();
    expect(editorScreen(phone)).toEqual({
      kind: "editor",
      title: "Message:",
      text: "",
      cursor: 0,
      mode: "Abc",
    });
  });

  it("types via multi-tap through phone key events", () => {
    const phone = editorPhone();
    phone.pressKey("4"); // G
    phone.pressKey("4"); // cycles to H
    expect(editorScreen(phone).text).toBe("H");
    phone.tick(99_999); // 1s pause → commit (and sentence-case downshift)
    phone.pressKey("4");
    phone.pressKey("4");
    phone.pressKey("4"); // g → h → i
    expect(editorScreen(phone).text).toBe("Hi");
    expect(editorScreen(phone).mode).toBe("abc");
  });

  it("0 = space, # toggles case", () => {
    const phone = editorPhone();
    phone.pressKey("8"); // T
    phone.pressKey("0"); // space (commits)
    phone.pressKey("8"); // t (downshifted)
    expect(editorScreen(phone).text).toBe("T t");
    phone.pressKey("#");
    expect(editorScreen(phone).mode).toBe("Abc");
  });

  it("holding a digit inserts the number; hold-0 toggles 123 mode", () => {
    const phone = editorPhone();
    phone.pressKey("5", 1000);
    expect(editorScreen(phone).text).toBe("5");
    phone.pressKey("0", 1000);
    expect(editorScreen(phone).mode).toBe("123");
    phone.pressKey("7");
    expect(editorScreen(phone).text).toBe("57");
  });

  it("up/down move the cursor", () => {
    const phone = editorPhone();
    phone.pressKey("2");
    phone.tick(99_999);
    phone.pressKey("3");
    phone.tick(199_999);
    expect(editorScreen(phone)).toMatchObject({ text: "Ad", cursor: 2 });
    phone.pressKey("up");
    expect(editorScreen(phone).cursor).toBe(1);
    phone.pressKey("down");
    expect(editorScreen(phone).cursor).toBe(2);
  });

  it("C deletes; hold-C clears; C on empty exits to the containing menu", () => {
    const phone = editorPhone();
    phone.pressKey("8");
    phone.pressKey("0");
    phone.pressKey("8");
    expect(editorScreen(phone).text).toBe("T t");
    phone.pressKey("c");
    expect(editorScreen(phone).text).toBe("T ");
    phone.pressKey("c", 1000); // hold-C → clear all
    expect(editorScreen(phone).text).toBe("");
    phone.pressKey("c"); // empty → exit
    expect(phone.path).toBe("menu/messages");
  });

  it("navi accepts: onAccept gets the committed text, then the editor exits", () => {
    const accepted: string[] = [];
    const phone = editorPhone((t) => accepted.push(t));
    phone.pressKey("3"); // D (still pending)
    phone.pressKey("navi");
    expect(accepted).toEqual(["D"]);
    expect(phone.path).toBe("menu/messages");
  });
});
