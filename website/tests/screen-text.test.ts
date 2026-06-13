import { describe, expect, it } from "vite-plus/test";
import { screenToText } from "../src/phone/screen-text";

describe("screenToText", () => {
  it("describes the standby screen", () => {
    expect(screenToText({ kind: "standby", carrier: "LACHLAN", signal: 4, battery: 4 })).toBe(
      "Standby. LACHLAN. Press Menu.",
    );
  });
  it("reads a list with the current selection", () => {
    expect(
      screenToText({
        kind: "list",
        title: "Tones",
        items: ["Ringing tone", "Keypad tones"],
        selected: 1,
        softkey: "Select",
      }),
    ).toBe("Tones. Keypad tones, 2 of 2. Select.");
  });
  it("reads the menu carousel item", () => {
    expect(
      screenToText({
        kind: "menu-carousel",
        label: "Games",
        menuNumber: 8,
        total: 13,
        iconId: "games",
      }),
    ).toBe("Menu. Games, 8 of 13.");
  });
  it("falls back gracefully for custom app screens", () => {
    expect(
      screenToText({
        kind: "custom",
        appId: "snake",
        frame: { width: 84, height: 48, pixels: new Uint8Array(84 * 48) },
      }),
    ).toBe("snake.");
  });
});
