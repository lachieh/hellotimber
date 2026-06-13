import { createPhone } from "@hellotimber/phone-core";
import type { MenuNode, Phone } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { pickerApp } from "../src/phone/apps/picker-app";

function pickerPhone(opts: { selected?: () => number; onPick: (i: number) => void }): Phone {
  const menu: MenuNode[] = [
    { type: "app", id: "keypad-tones", label: "Keypad tones", appId: "picker" },
  ];
  const phone = createPhone({
    menu,
    bootMs: 0,
    apps: {
      picker: pickerApp({ title: "Keypad tones", options: ["On", "Off"], ...opts }),
    },
  });
  phone.tick(0);
  phone.pressKey("power", 1000);
  phone.navigate("menu/keypad-tones");
  return phone;
}

describe("pickerApp", () => {
  it("renders a list screen with the current selection preselected", () => {
    const phone = pickerPhone({ selected: () => 1, onPick: () => {} });
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Keypad tones",
      items: ["On", "Off"],
      selected: 1,
      softkey: "OK",
    });
  });

  it("up/down move with wraparound", () => {
    const phone = pickerPhone({ onPick: () => {} });
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ selected: 1 });
    phone.pressKey("down"); // wraps
    expect(phone.screen).toMatchObject({ selected: 0 });
    phone.pressKey("up"); // wraps back
    expect(phone.screen).toMatchObject({ selected: 1 });
  });

  it("navi picks the highlighted option and exits to the carousel", () => {
    const picks: number[] = [];
    const phone = pickerPhone({ onPick: (i) => picks.push(i) });
    phone.pressKey("down");
    phone.pressKey("navi");
    expect(picks).toEqual([1]);
    expect(phone.path).toBe("menu");
  });

  it("C cancels without picking", () => {
    const picks: number[] = [];
    const phone = pickerPhone({ onPick: (i) => picks.push(i) });
    phone.pressKey("c");
    expect(picks).toEqual([]);
    expect(phone.path).toBe("menu");
  });
});
