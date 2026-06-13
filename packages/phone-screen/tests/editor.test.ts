import { describe, expect, it } from "vite-plus/test";
import type { ScreenModel } from "@hellotimber/phone-core";
import { FONT, textWidth } from "../src/font/font";
import { Framebuffer } from "../src/framebuffer";
import { renderConfirm, renderEditor } from "../src/render/editor";
import { renderScreen } from "../src/render";
import { regionToArt } from "./helpers";

type EditorScreen = Extract<ScreenModel, { kind: "editor" }>;

function editor(overrides: Partial<EditorScreen> = {}): EditorScreen {
  return { kind: "editor", title: "Message:", text: "Hi", cursor: 2, mode: "Abc", ...overrides };
}

describe("renderEditor", () => {
  it("draws title top-left, mode top-right, text and Options softkey", () => {
    const fb = new Framebuffer();
    renderEditor(fb, editor());
    const expected = new Framebuffer();
    expected.drawText(FONT, "Message:", 1, 0);
    expected.drawText(FONT, "Abc", 83 - textWidth(FONT, "Abc") + 1, 0);
    expected.drawText(FONT, "Hi", 0, 8);
    expected.fillRect(12, 15, 5, 1, 1); // cursor underscore at col 2 of row 0
    expected.drawTextCentered(FONT, "Options", 41);
    expect(regionToArt(fb, 0, 0, 84, 48)).toBe(regionToArt(expected, 0, 0, 84, 48));
  });

  it("shows the 123 mode indicator", () => {
    const fb = new Framebuffer();
    renderEditor(fb, editor({ mode: "123" }));
    const expected = new Framebuffer();
    expected.drawText(FONT, "123", 83 - textWidth(FONT, "123") + 1, 0);
    expect(regionToArt(fb, 60, 0, 24, 7)).toBe(regionToArt(expected, 60, 0, 24, 7));
  });

  it("wraps text at 14 chars and places the cursor mid-text", () => {
    const fb = new Framebuffer();
    // 16 chars: rows 'fourteen chars' + '!!'; cursor 15 → row 1, col 1
    renderEditor(fb, editor({ text: "fourteen chars!!", cursor: 15 }));
    const expected = new Framebuffer();
    expected.drawText(FONT, "fourteen chars", 0, 8);
    expected.drawText(FONT, "!!", 0, 16);
    expected.fillRect(6, 23, 5, 1, 1); // col 1 of row 1
    expect(regionToArt(fb, 0, 8, 84, 24)).toBe(regionToArt(expected, 0, 8, 84, 24));
  });

  it("scrolls so the cursor row is visible past 4 rows", () => {
    const text = "a".repeat(14 * 5); // 5 full rows (0–4) + cursor lands on row 5
    const fb = new Framebuffer();
    renderEditor(fb, editor({ text, cursor: 70 }));
    const expected = new Framebuffer();
    // rows 2–4 of 'a's visible, cursor row 5 (empty) at the bottom
    expected.drawText(FONT, "a".repeat(14), 0, 8);
    expected.drawText(FONT, "a".repeat(14), 0, 16);
    expected.drawText(FONT, "a".repeat(14), 0, 24);
    expected.fillRect(0, 39, 5, 1, 1); // cursor at col 0 of the 4th visible row
    expect(regionToArt(fb, 0, 8, 84, 32)).toBe(regionToArt(expected, 0, 8, 84, 32));
  });
});

describe("renderConfirm", () => {
  it("centers wrapped text and draws the model softkey", () => {
    const fb = new Framebuffer();
    renderConfirm(fb, { kind: "confirm", text: "Message sent", softkey: "OK" });
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "Message sent", 16); // 1 line → top = (41-8)/2 = 16
    expected.drawTextCentered(FONT, "OK", 41);
    expect(regionToArt(fb, 0, 0, 84, 48)).toBe(regionToArt(expected, 0, 0, 84, 48));
  });
});

describe("renderScreen dispatcher", () => {
  it("off clears the framebuffer", () => {
    const fb = new Framebuffer();
    fb.fillRect(0, 0, 84, 48, 1);
    renderScreen(fb, { kind: "off" }, { welcomeText: "Welcome!" });
    expect(fb.pixels.every((p) => p === 0)).toBe(true);
  });

  it("custom blits the provided bitmap verbatim", () => {
    const pixels = new Uint8Array(84 * 48);
    pixels[0] = 1;
    pixels[84 * 48 - 1] = 1;
    const fb = new Framebuffer();
    renderScreen(
      fb,
      { kind: "custom", appId: "snake", frame: { width: 84, height: 48, pixels } },
      { welcomeText: "Welcome!" },
    );
    expect(fb.getPixel(0, 0)).toBe(1);
    expect(fb.getPixel(83, 47)).toBe(1);
    expect(fb.pixels.filter((p) => p === 1)).toHaveLength(2);
  });

  it("routes every other kind to its renderer", () => {
    const opts = { welcomeText: "Welcome!" };
    const screens: ScreenModel[] = [
      { kind: "boot", phase: "hands", frame: 0 },
      { kind: "standby", carrier: "LACHLAN", signal: 4, battery: 4 },
      { kind: "menu-carousel", label: "Messages", menuNumber: 2, total: 13, iconId: "messages" },
      { kind: "list", title: "Inbox", items: ["Hello"], selected: 0, softkey: "Select" },
      { kind: "reader", title: "Chat", lines: ["> hi"], scrollTop: 0 },
      { kind: "editor", title: "Message:", text: "Hi", cursor: 2, mode: "Abc" },
      { kind: "confirm", text: "Sent", softkey: "OK" },
    ];
    for (const screen of screens) {
      const fb = new Framebuffer();
      renderScreen(fb, screen, opts);
      expect(
        fb.pixels.some((p) => p === 1),
        screen.kind,
      ).toBe(true);
    }
  });
});
