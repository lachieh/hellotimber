import { describe, expect, it } from "vite-plus/test";
import type {
  Bitmap,
  KeyEvent,
  MenuIndicator,
  PhoneConfig,
  PhoneEventMap,
  PhoneKey,
  PhoneSnapshot,
  ScreenModel,
  StandbyIndicators,
} from "../src/index";
import { testMenu } from "./fixtures";

describe("contract types", () => {
  it("accepts values shaped like the VISION.md contracts", () => {
    const key: PhoneKey = "navi";
    const event: KeyEvent = { type: "down", key };
    const bitmap: Bitmap = { width: 84, height: 48, pixels: new Uint8Array(84 * 48) };
    const menuIndicator: MenuIndicator = { segments: [2, 1], awaitingNext: true };
    const standbyIndicators: StandbyIndicators = { voicemail: true, message: true };
    const screens: ScreenModel[] = [
      { kind: "off" },
      { kind: "boot", phase: "hands", frame: 3 },
      {
        kind: "standby",
        carrier: "LACHLAN",
        clock: "12:34",
        signal: 4,
        battery: 4,
        indicators: standbyIndicators,
      },
      {
        kind: "menu-carousel",
        label: "Messages",
        menuNumber: 2,
        total: 13,
        iconId: "messages",
        menuIndicator,
      },
      {
        kind: "list",
        title: "Inbox",
        items: ["Hello"],
        selected: 0,
        softkey: "Select",
        menuIndicator,
      },
      { kind: "reader", title: "Chat", lines: ["> hi"], scrollTop: 0, menuIndicator },
      { kind: "editor", title: "Message:", text: "Hi", cursor: 2, mode: "Abc" },
      { kind: "confirm", text: "Sent", softkey: "OK" },
      { kind: "custom", appId: "snake", frame: bitmap },
    ];
    const menu = testMenu();
    const config: PhoneConfig = {
      menu,
      carrier: "LACHLAN",
      clock: () => "12:34",
      bootMs: 0,
    };
    const snap: PhoneSnapshot = { path: "standby", screen: { kind: "off" }, poweredOn: false };
    const handlers: { [K in keyof PhoneEventMap]: PhoneEventMap[K] } = {
      pathchange: (path) => void path,
      action: (action) => void action.value,
      sound: (sound) => void sound.id,
    };
    expect(event.key).toBe("navi");
    expect(screens).toHaveLength(9);
    expect(config.menu).toBe(menu);
    expect(snap.poweredOn).toBe(false);
    expect(Object.keys(handlers)).toHaveLength(3);
  });
});
