import { describe, expect, it } from "vite-plus/test";
import { deskHint, lcdCopy } from "../src/desk/lcd-copy";
import { siteBreadcrumb } from "../src/phone/site-tree";

describe("lcdCopy: the words the LCD draws", () => {
  it("copies standby as clock, operator and the Menu soft key", () => {
    expect(
      lcdCopy({ kind: "standby", carrier: "LACHLAN", clock: "09:41", signal: 4, battery: 4 }),
    ).toEqual({ head: "09:41", rows: [{ text: "LACHLAN" }], softkey: "Menu" });
  });

  it("copies a standby notice wrapped as drawn, with its soft key", () => {
    expect(
      lcdCopy({
        kind: "standby",
        carrier: "LACHLAN",
        signal: 4,
        battery: 4,
        notice: { text: "1 message received", softkey: "Read" },
      }),
    ).toEqual({ rows: [{ text: "1 message" }, { text: "received" }], softkey: "Read" });
  });

  it("copies the carousel's menu number, label and Select", () => {
    expect(
      lcdCopy({
        kind: "menu-carousel",
        label: "Phone book",
        menuNumber: 1,
        total: 13,
        iconId: "phonebook",
        menuIndicator: { segments: [1], awaitingNext: false },
      }),
    ).toEqual({ head: "1", rows: [{ text: "Phone book" }], softkey: "Select" });
  });

  it("copies only the three rows on screen and marks the highlighted one", () => {
    const copy = lcdCopy({
      kind: "list",
      title: "Settings",
      items: ["One", "Two", "Three", "Four", "Five"],
      selected: 3,
      softkey: "Select",
      menuIndicator: { segments: [4, 4], awaitingNext: false },
    });
    expect(copy).toEqual({
      head: "4 • 4",
      rows: [{ text: "Three" }, { text: "Four", selected: true }, { text: "Five" }],
      softkey: "Select",
    });
  });

  it("uses the list title when no menu number is drawn", () => {
    expect(
      lcdCopy({ kind: "list", title: "Tones", items: ["A", "B"], selected: 0, softkey: "OK" }).head,
    ).toBe("Tones");
  });

  it("copies the reader's visible lines and its Back key", () => {
    expect(
      lcdCopy({ kind: "reader", title: "Note", lines: ["a", "b", "c", "d"], scrollTop: 1 }),
    ).toEqual({
      head: "Note",
      rows: [{ text: "b" }, { text: "c" }, { text: "d" }],
      softkey: "Back",
    });
  });

  it("copies the editor's title, countdown, mode and hard-wrapped text", () => {
    expect(
      lcdCopy({
        kind: "editor",
        title: "Message",
        text: "hello there you lot",
        cursor: 19,
        mode: "abc",
        limit: 160,
      }),
    ).toEqual({
      head: "Message 141 abc",
      rows: [{ text: "hello there yo" }, { text: "u lot" }],
      softkey: "Options",
    });
  });

  it("says a game screen is pixels, not words", () => {
    expect(
      lcdCopy({
        kind: "custom",
        appId: "snake",
        frame: { width: 0, height: 0, pixels: new Uint8Array() },
      }),
    ).toEqual({ rows: [], pixels: "snake" });
  });
});

describe("deskHint", () => {
  it("tells you which soft key a list offers", () => {
    expect(
      deskHint("menu/messages/inbox", {
        kind: "list",
        title: "Inbox",
        items: ["Hi"],
        selected: 0,
        softkey: "Options",
      }),
    ).toBe("Enter for Options, up/down to pick one");
  });

  it("explains typing in an editor", () => {
    expect(
      deskHint("menu/messages/write", {
        kind: "editor",
        title: "Message",
        text: "",
        cursor: 0,
        mode: "abc",
      }),
    ).toBe("type on 0-9, # for case, Enter for Options");
  });

  it("gives Snake its controls", () => {
    expect(
      deskHint("menu/games/snake", {
        kind: "custom",
        appId: "snake",
        frame: { width: 0, height: 0, pixels: new Uint8Array() },
      }),
    ).toBe("Enter to play, steer with 2 4 6 8");
  });
});

describe("siteBreadcrumb", () => {
  it("names the path in the phone's own titles", () => {
    expect(siteBreadcrumb("menu")).toEqual(["Menu"]);
    expect(siteBreadcrumb("menu/games/snake")).toEqual(["Menu", "Games", "Snake II"]);
  });

  it("keeps an application's entry titles for its deeper paths", () => {
    expect(siteBreadcrumb("menu/games/snake/not-a-node")).toEqual(["Menu", "Games", "Snake II"]);
  });

  it("has no trail at standby", () => {
    expect(siteBreadcrumb("standby")).toEqual([]);
  });
});
