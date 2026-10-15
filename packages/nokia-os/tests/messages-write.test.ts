// Plan 18 Task 10: Write messages (2-1) and its Options through the stock phone's keys: Send over
// the network port, Save to Outbox, Erase, Exit, Dictionary, Send by set (D3, D8, D9, D14).
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import { DICTIONARY_KEY, EDITOR_OPTIONS } from "../src/messages/bindings";
import { MESSAGE_SLOTS, StockMessages } from "../src/messages/store";
import { SEND_LINK_MS } from "../src/resources";
import {
  createMemoryStorage,
  createSyntheticNetwork,
  type StockNetworkPort,
  type StockStorage,
} from "../src/index";
import { expectLcd } from "./support/golden.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";
import { expectLcdAnyBlink } from "./support/replay.ts";
import { keys } from "./support/probes.ts";
import { standbyRig } from "./support/rig.ts";

/** Menu, ▼ to Messages, Select (Write messages), Select. */
const WRITE = "navi wait:300 down navi wait:500 navi wait:500";
/** Hi in multi-tap. */
const HI = "4 4 wait:1500 4 4 4 wait:1500";
/** Options, ▼ to entry `label`, OK. */
const option = (label: string): string => {
  const downs = EDITOR_OPTIONS.findIndex((o) => o.label === label);
  return `navi wait:500 ${downs > 0 ? `down*${downs}` : ""} navi`;
};

function outbox(storage: StockStorage) {
  return new StockMessages(new StockEeprom(storage), "sim-1").outbox();
}

describe("Write messages (2-1)", () => {
  it("opens the multi-tap editor (Dictionary off, D3) with the nine multi-tap Options", () => {
    const rig = standbyRig();
    keys(rig, WRITE);
    expectLcdAnyBlink(rig.paint(), goldenImage("text/editor", "editor-multitap"), "the editor");
    expect(EDITOR_OPTIONS.map((o) => o.label)).toEqual([
      "Send",
      "Send to many",
      "Template",
      "Insert smiley",
      "Dictionary",
      "Send by set",
      "Save",
      "Erase",
      "Exit",
    ]);
    keys(rig, "navi wait:500");
    expectLcd(rig.paint(), goldenImage("text/options", "01"), "Options");
  });

  it("sends through the network port, keeps the text and stores nothing (D8, D9)", () => {
    const network = createSyntheticNetwork();
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage, network });
    keys(rig, `${WRITE} ${HI} ${option("Send")} 0 4 1 2 3 4 5 6 7 8 navi`);
    expect(network.sent).toEqual([{ number: "0412345678", text: "Hi" }]);
    keys(rig, `wait:${SEND_LINK_MS + 2000}`);
    expectLcdAnyBlink(rig.paint(), goldenImage("sms/send", "s"), "Hi after Message sent");
    expect(outbox(storage)).toEqual([]);
  });

  it("shows Sending message until a slow host settles, then the composed failure note (D14)", async () => {
    let settle!: (outcome: "sent" | "failed") => void;
    const network: StockNetworkPort = {
      send: () => new Promise((resolve) => (settle = resolve)),
      subscribe: () => () => {},
    };
    const rig = standbyRig({ network });
    keys(rig, `${WRITE} ${HI} ${option("Send")} 1 navi wait:${SEND_LINK_MS + 1000}`);
    // Still `Sending message` (one of the bar's steps, `sms/send` frames 1-10).
    const sending = loadGolden("sms/send").images.slice(1, 11);
    const now = rig.paint().pixels;
    expect(sending.some((image) => image.pixels.every((p, i) => p === now[i]))).toBe(true);
    settle("failed");
    await Promise.resolve();
    keys(rig, "wait:500");
    const screen = rig.phone.screen;
    expect(screen.kind).toBe("custom");
    keys(rig, "wait:3500");
    expectLcdAnyBlink(rig.paint(), goldenImage("sms/send", "s"), "back in the editor with Hi");
  });

  it("saves to Outbox (Message saved), and says Message memory full with every slot used", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage });
    keys(rig, `${WRITE} ${HI} ${option("Save")} wait:2500`);
    expect(outbox(storage)).toEqual([{ text: "Hi" }]);
    const store = new StockMessages(new StockEeprom(storage), "sim-1");
    for (let i = 1; i < MESSAGE_SLOTS; i++) store.save(`saved ${i}`);
    const full = standbyRig({ storage });
    keys(full, `${WRITE} ${HI} ${option("Save")} wait:500`);
    expectLcd(full.paint(), goldenImage("sms/full-save", "c"), "Message memory full");
    expect(outbox(storage)).toHaveLength(MESSAGE_SLOTS);
  });

  it("erases the text at once; Exit goes to standby", () => {
    const rig = standbyRig();
    keys(rig, `${WRITE} ${HI} ${option("Erase")} wait:500`);
    expectLcdAnyBlink(rig.paint(), goldenImage("text/editor", "editor-multitap"), "erased");
    keys(rig, `${option("Exit")} wait:500`);
    expect(rig.phone.path).toBe("standby");
  });

  it("stores the Dictionary choice: Dictionary off by default (D3)", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage });
    const settings = () => createStockSettings(new StockEeprom(storage));
    expect(settings().choice(DICTIONARY_KEY)).toBe(0);
    keys(rig, `${WRITE} ${option("Dictionary")} wait:500`);
    expectLcd(rig.paint(), goldenImage("text/editor", "dictionary-list-off"), "on Dictionary off");
    // The T9 dictionaries are plan 18b's.
    keys(rig, "down navi wait:300");
    expect(rig.phone.screen).toMatchObject({ kind: "custom" });
  });

  it("sends by set: Alphanumeric to the routing address; Set 2 asks for a centre first", () => {
    const network = createSyntheticNetwork();
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage, network });
    keys(rig, `${WRITE} ${HI} ${option("Send by set")} wait:500 navi wait:500 down navi`);
    keys(rig, "2 wait:1500 3 3 navi");
    expect(network.sent).toEqual([{ number: "AE", text: "Hi" }]);
    keys(rig, `wait:${SEND_LINK_MS + 2000}`);
    keys(rig, `${option("Send by set")} wait:500 down navi wait:500 navi 5 5 5 navi`);
    // Set 2 has no message centre in the virgin SIM: its prompt, then the send.
    expect(network.sent).toHaveLength(1);
    keys(rig, "0 4 1 9 navi");
    expect(network.sent.at(-1)).toEqual({ number: "555", text: "Hi" });
    const centre = createStockSettings(new StockEeprom(storage)).text(
      "messages/message-settings/set-2/message-centre-number",
    );
    expect(centre).toBe("0419");
  });
});
