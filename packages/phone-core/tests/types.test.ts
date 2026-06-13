import { describe, expect, it } from "vite-plus/test";
import type {
  Bitmap,
  KeyEvent,
  MenuNode,
  PhoneApp,
  PhoneConfig,
  PhoneEventMap,
  PhoneKey,
  PhoneSnapshot,
  ScreenModel,
} from "../src/index";

describe("contract types", () => {
  it("accepts values shaped like the VISION.md contracts", () => {
    const key: PhoneKey = "navi";
    const event: KeyEvent = { type: "down", key };
    const bitmap: Bitmap = { width: 84, height: 48, pixels: new Uint8Array(84 * 48) };
    const screens: ScreenModel[] = [
      { kind: "off" },
      { kind: "boot", phase: "hands", frame: 3 },
      { kind: "standby", carrier: "LACHLAN", clock: "12:34", signal: 4, battery: 4 },
      { kind: "menu-carousel", label: "Messages", menuNumber: 2, total: 13, iconId: "messages" },
      { kind: "list", title: "Inbox", items: ["Hello"], selected: 0, softkey: "Select" },
      { kind: "reader", title: "Chat", lines: ["> hi"], scrollTop: 0 },
      { kind: "editor", title: "Message:", text: "Hi", cursor: 2, mode: "Abc" },
      { kind: "confirm", text: "Sent", softkey: "OK" },
      { kind: "custom", appId: "snake", frame: bitmap },
    ];
    const node: MenuNode = {
      type: "submenu",
      id: "messages",
      label: "Messages",
      iconId: "messages",
      children: [
        {
          type: "list",
          id: "inbox",
          label: "Inbox",
          items: [{ id: "a", label: "A", body: "b" }],
        },
        { type: "reader", id: "chat", label: "Chat", body: "> hi" },
        { type: "app", id: "write", label: "Write messages", appId: "write-message" },
        {
          type: "action",
          id: "gh",
          label: "GitHub",
          action: { kind: "href", value: "https://x" },
        },
      ],
    };
    const app: PhoneApp = {
      onKey: () => undefined,
      tick: () => undefined,
      render: () => ({ kind: "off" }),
    };
    const config: PhoneConfig = {
      menu: [node],
      apps: { "write-message": () => app },
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
    expect(config.menu[0]).toBe(node);
    expect(snap.poweredOn).toBe(false);
    expect(Object.keys(handlers)).toHaveLength(3);
  });
});
