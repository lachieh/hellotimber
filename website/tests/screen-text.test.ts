import { describe, expect, it } from "vite-plus/test";
import { screenToText } from "../src/phone/screen-text";

describe("screenToText", () => {
  it("describes the standby screen", () => {
    expect(screenToText({ kind: "standby", carrier: "LACHLAN", signal: 4, battery: 4 })).toBe(
      "Standby. LACHLAN. Press Menu.",
    );
  });
  it("describes a noticed standby (message received) with its softkey", () => {
    expect(
      screenToText({
        kind: "standby",
        carrier: "LACHLAN",
        signal: 4,
        battery: 4,
        notice: { text: "1 message received", softkey: "Read" },
      }),
    ).toBe("Standby. LACHLAN. 1 message received. Read.");
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
        menuIndicator: { segments: [8], awaitingNext: false },
      }),
    ).toBe("Menu 8. Games, 8 of 13.");
  });
  it("announces active and resolved menu hierarchies without visual punctuation", () => {
    const active = screenToText({
      kind: "list",
      title: "Tones",
      items: ["Ringing tone"],
      selected: 0,
      softkey: "Select",
      menuIndicator: { segments: [5], awaitingNext: true },
    });
    const resolved = screenToText({
      kind: "reader",
      title: "Incoming call alert",
      lines: ["Not available"],
      scrollTop: 0,
      menuIndicator: { segments: [5, 3], awaitingNext: false },
    });

    expect(active).toBe("Menu 5. Enter another digit. Tones. Ringing tone, 1 of 1. Select.");
    expect(resolved).toBe("Menu 5 then 3. Incoming call alert. Not available");
    expect(`${active}${resolved}`).not.toMatch(/[•_]/);
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
