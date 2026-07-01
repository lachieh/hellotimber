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

describe("editor options menu + char limit", () => {
  interface MenuCtx {
    exit(): void;
    open(appId: string): void;
  }

  function optionsPhone(charLimit?: number): {
    phone: Phone;
    calls: { id: string; text: string }[];
    ctx: () => MenuCtx | null;
  } {
    const calls: { id: string; text: string }[] = [];
    let lastCtx: MenuCtx | null = null;
    const phone = createPhone(
      testConfig({
        apps: {
          "write-message": editorApp({
            title: "Message:",
            ...(charLimit !== undefined ? { charLimit } : {}),
            menu: [
              { id: "send", label: "Send" },
              { id: "clear", label: "Clear text" },
              { id: "exit", label: "Exit" },
            ],
            onMenu: (id, text, ctx) => {
              calls.push({ id, text });
              lastCtx = ctx;
            },
          }),
        },
      }),
    );
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.navigate("menu/messages/write");
    return { phone, calls, ctx: () => lastCtx };
  }

  it("navi opens the Options list over the draft (path stays at the editor)", () => {
    const { phone } = optionsPhone();
    phone.pressKey("4");
    phone.pressKey("4"); // H
    phone.pressKey("navi");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Options",
      items: ["Send", "Clear text", "Exit"],
      selected: 0,
      softkey: "Select",
    });
    expect(phone.path).toBe("menu/messages/write");
  });

  it("up/down move the Options selection and wrap", () => {
    const { phone } = optionsPhone();
    phone.pressKey("navi");
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 1 });
    phone.pressKey("down");
    phone.pressKey("down"); // wraps
    expect(phone.screen).toMatchObject({ selected: 0 });
    phone.pressKey("up"); // wraps backward
    expect(phone.screen).toMatchObject({ selected: 2 });
  });

  it("navi on Send calls onMenu with the committed draft and a chaining ctx", () => {
    const { phone, calls, ctx } = optionsPhone();
    phone.pressKey("4");
    phone.pressKey("4"); // 'H' — still pending when Options opens
    phone.pressKey("navi"); // Options
    phone.pressKey("navi"); // Send
    expect(calls).toEqual([{ id: "send", text: "H" }]);
    expect(typeof ctx()?.exit).toBe("function");
    expect(typeof ctx()?.open).toBe("function");
    // Options closed; the draft survives underneath.
    expect(editorScreen(phone)).toMatchObject({ text: "H" });
    expect(phone.path).toBe("menu/messages/write");
  });

  it("C closes Options back to the editor with the draft intact", () => {
    const { phone, calls } = optionsPhone();
    phone.pressKey("4");
    phone.pressKey("4");
    phone.pressKey("navi");
    phone.pressKey("c");
    expect(editorScreen(phone)).toMatchObject({ text: "H", cursor: 1 });
    expect(calls).toEqual([]);
  });

  it("'clear' empties the draft without calling onMenu", () => {
    const { phone, calls } = optionsPhone();
    phone.pressKey("4");
    phone.pressKey("4");
    phone.pressKey("navi");
    phone.pressKey("down"); // Clear text
    phone.pressKey("navi");
    expect(editorScreen(phone)).toMatchObject({ text: "", cursor: 0 });
    expect(calls).toEqual([]);
    expect(phone.path).toBe("menu/messages/write");
  });

  it("'exit' leaves the editor via ctx.exit()", () => {
    const { phone, calls } = optionsPhone();
    phone.pressKey("navi");
    phone.pressKey("up"); // wraps to Exit
    phone.pressKey("navi");
    expect(calls).toEqual([]);
    expect(phone.path).toBe("menu/messages");
  });

  it("charLimit: 160 is carried on the ScreenModel as limit", () => {
    const { phone } = optionsPhone(160);
    expect(editorScreen(phone)).toEqual({
      kind: "editor",
      title: "Message:",
      text: "",
      cursor: 0,
      mode: "Abc",
      limit: 160,
    });
  });

  it("input beyond the limit is ignored; cycling the last letter still works", () => {
    const { phone } = optionsPhone(3);
    phone.pressKey("8"); // T
    phone.pressKey("0"); // space (commits)
    phone.pressKey("8"); // t — at the 3-char limit
    expect(editorScreen(phone).text).toBe("T t");
    phone.pressKey("0"); // would exceed the limit — ignored
    expect(editorScreen(phone).text).toBe("T t");
    phone.pressKey("8"); // same-key cycle replaces (no growth) — allowed
    expect(editorScreen(phone).text).toBe("T u");
    phone.pressKey("5", 1000); // hold-digit insertion also blocked at the limit
    expect(editorScreen(phone).text).toBe("T u");
  });

  it("without menu, legacy onAccept still works with a charLimit", () => {
    const accepted: string[] = [];
    const phone = createPhone(
      testConfig({
        apps: {
          "write-message": editorApp({
            title: "Message:",
            charLimit: 160,
            onAccept: (t) => accepted.push(t),
          }),
        },
      }),
    );
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.navigate("menu/messages/write");
    phone.pressKey("3"); // D
    phone.pressKey("navi"); // accepts + exits (no Options menu configured)
    expect(accepted).toEqual(["D"]);
    expect(phone.path).toBe("menu/messages");
  });
});
