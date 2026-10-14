// Plan 15 Task 7: what an accepted security code opens (D8, Task 0c `probe/accept-*`), through
// the stock phone's keys, with the EEPROM read back from its storage.
import { describe, expect, it } from "vite-plus/test";
import { PHONE_SECURITY_KEY, WELCOME_NOTE_KEY } from "../src/firmware/bindings";
import { StockEeprom } from "../src/firmware/eeprom";
import { SECURITY_RECORD } from "../src/firmware/security";
import { SETTINGS_RECORD, createStockSettings } from "../src/firmware/settings";
import { createMemoryStorage, type StockStorage } from "../src/index";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";
import { keys } from "./support/probes.ts";
import { standbyRig, type Rig } from "./support/rig.ts";

const PHONE_SECURITY = "navi wait:300 down*5 wait:1000 navi down*2 navi down*3";
const CHANGE_CODE = "navi wait:300 down*5 wait:1000 navi down*2 navi down*4 navi";
const RESTORE = "navi wait:300 down*5 wait:1000 navi down*3";
const KEYPAD_TONES = "navi wait:300 down*4 wait:1000 navi down*5";
const STANDBY = "c*5 wait:2000";

/** The records a phone over `storage` would load. */
function stored(storage: StockStorage) {
  const eeprom = new StockEeprom(storage);
  return { settings: eeprom.read(SETTINGS_RECORD), security: eeprom.read(SECURITY_RECORD) };
}

function phone(storage: StockStorage = createMemoryStorage()): { rig: Rig; storage: StockStorage } {
  return { rig: standbyRig({ storage }), storage };
}

describe("Phone security (6-3-5)", () => {
  it("opens the Off/On list on the stored value; OK stores it, Done, then the page", () => {
    const { rig, storage } = phone();
    keys(rig, `${PHONE_SECURITY} navi 1 2 3 4 5 navi`);
    expectLcd(rig.paint(), goldenImage("probe/accept-6-3-5-on", "i"), "the list on Off");
    keys(rig, "down navi wait:3000");
    expectLcd(rig.paint(), goldenImage("probe/accept-6-3-5-on", "n"), "the page On");
    expect(stored(storage).settings.choices[PHONE_SECURITY_KEY]).toBe(1);
    keys(rig, "navi 1 2 3 4 5 navi");
    expectLcd(rig.paint(), goldenImage("probe/accept-6-3-5-off", "h"), "the list on On");
  });

  it("keeps the inserted SIM first among the recent SIMs when it turns On", () => {
    const storage = createMemoryStorage();
    standbyRig({ storage, sim: "sim-2" });
    // Every power-on that passes records its SIM (Task 8), so the phone's own SIM is first.
    const rig = standbyRig({ storage });
    expect(stored(storage).security.recentSims).toEqual(["sim-1", "sim-2"]);
    keys(rig, `${PHONE_SECURITY} navi 1 2 3 4 5 navi down navi wait:3000`);
    expect(stored(storage).security.recentSims).toEqual(["sim-1", "sim-2"]);
    expect(stored(storage).settings.choices[PHONE_SECURITY_KEY]).toBe(1);
  });
});

describe("Change security code (6-3-6-1)", () => {
  it("stores a matching new code: the old one fails, the new one passes", () => {
    const { rig, storage } = phone();
    keys(rig, `${CHANGE_CODE} navi 1 2 3 4 5 navi 1*5 navi 1*5 navi wait:3000`);
    expect(stored(storage).security.code).toBe("11111");
    keys(rig, `${STANDBY} ${RESTORE} navi 1 2 3 4 5 navi`);
    expectLcd(rig.paint(), goldenImage("probe/accept-6-4-old-code", "h"), "12345: Code error");
    keys(rig, "wait:3000 1*5 navi");
    expectLcd(rig.paint(), goldenImage("probe/accept-6-4-new-code", "g"), "11111: restored");
  });

  it("shows Code error for a mismatch or a wrong length, then Enter new again", () => {
    const { rig, storage } = phone();
    keys(rig, `${CHANGE_CODE} navi 1 2 3 4 5 navi 1*5 navi 2*5 navi`);
    expectLcd(rig.paint(), goldenImage("probe/accept-6-3-6-1-mismatch", "t"), "Code error");
    keys(rig, "wait:3000");
    expectLcd(rig.paint(), goldenImage("probe/accept-6-3-6-1-mismatch", "h"), "Enter new");
    keys(rig, "1*4 navi wait:3000");
    expectLcd(rig.paint(), goldenImage("probe/accept-6-3-6-1-mismatch", "h"), "Enter new");
    expect(stored(storage).security.code).toBe("12345");
  });
});

describe("Restore factory settings (6-4)", () => {
  it("writes factory(previous) and every page shows its factory value; code and note kept", () => {
    const storage = createMemoryStorage();
    // The welcome note is plan 18's editor; seed it as the editor would store it.
    createStockSettings(new StockEeprom(storage)).setText(WELCOME_NOTE_KEY, "Hi");
    const { rig } = phone(storage);
    keys(rig, `${KEYPAD_TONES} navi down navi wait:3000 ${STANDBY}`);
    keys(rig, `${PHONE_SECURITY} navi 1 2 3 4 5 navi down navi wait:3000 ${STANDBY}`);
    keys(rig, `${CHANGE_CODE} navi 1 2 3 4 5 navi 1*5 navi 1*5 navi wait:3000 ${STANDBY}`);
    const previous = stored(storage);
    expect(previous.settings.choices[PHONE_SECURITY_KEY]).toBe(1);

    keys(rig, `${RESTORE} navi 1*5 navi wait:3000`);
    const after = stored(storage);
    expect(after.settings).toEqual(SETTINGS_RECORD.factory!(previous.settings));
    expect(after.settings.texts[WELCOME_NOTE_KEY]).toBe("Hi");
    expect(after.security).toEqual(previous.security);
    const settings = createStockSettings(new StockEeprom(storage));
    expect(settings.label("tones/keypad-tones")).toBe("Level 2");
    expect(settings.label(PHONE_SECURITY_KEY)).toBe("Off");
  });

  it("shows the factory value on a page at once, without a new phone", () => {
    const { rig } = phone();
    keys(rig, `${RESTORE} navi 1 2 3 4 5 navi wait:3000 ${STANDBY} ${KEYPAD_TONES}`);
    const page = rig.paint();
    const virgin = phone().rig;
    keys(virgin, KEYPAD_TONES);
    expect(page.pixels).not.toEqual(virgin.paint().pixels);
    expectLcd(page, goldenImage("probe/persist-reboot", "set-5-6-page"), "Keypad tones Level 2");
  });
});
