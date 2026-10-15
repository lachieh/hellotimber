// Plan 18 Task 8: the Welcome note editor (6-2-3) writes the note plan 15's boot gate shows, and
// the message centre and voice mailbox numbers save (Task 0 W and M), through the stock phone's
// keys with the EEPROM read back from its storage.
import { describe, expect, it } from "vite-plus/test";
import { SELF_TEST_MS, WELCOME_BLANK_MS } from "../src/firmware/boot";
import { WELCOME_NOTE_KEY } from "../src/firmware/features/settings";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import { createMemoryStorage, type StockStorage } from "../src/index";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";
import { keys } from "./support/probes.ts";
import { standbyRig, stockRig } from "./support/rig.ts";

/** Menu, ▼ to Settings, Phone settings, ▼ to Welcome note, Select. */
const WELCOME_NOTE = "navi wait:300 down*5 wait:1000 navi down navi down*2 navi wait:500";
/** Hi in multi-tap: 4 4, the commit, 4 4 4, the commit. */
const HI = "4 4 wait:1500 4 4 4 wait:1500";
const CENTRE_1 = "navi wait:300 down navi down*6 navi navi navi wait:500";
const VOICE_MAILBOX = "navi wait:300 down navi down*8 navi wait:500";

function stored(storage: StockStorage, key: string): string | undefined {
  return createStockSettings(new StockEeprom(storage)).text(key);
}

/** Powers a new phone over `storage` on (Phone security Off: no code gate). */
function bootOver(storage: StockStorage) {
  const rig = stockRig({ storage });
  rig.press("power", 1000);
  return rig;
}

describe("Welcome note (6-2-3)", () => {
  it("saves the typed note, which the next power-on shows (plan 15's gate)", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage });
    keys(rig, `${WELCOME_NOTE} ${HI}`);
    expectLcd(rig.paint(), goldenImage("welcome/editor", "hi"), "Hi typed");
    keys(rig, "navi wait:1000");
    expectLcd(rig.paint(), goldenImage("welcome/save-hi", "a"), "Options on Save");
    keys(rig, "navi wait:3000");
    expectLcd(rig.paint(), goldenImage("welcome/save-hi", "e"), "the page after the note");
    expect(stored(storage, WELCOME_NOTE_KEY)).toBe("Hi");

    const next = bootOver(storage);
    next.advance(SELF_TEST_MS + WELCOME_BLANK_MS + 10);
    expectLcd(next.paint(), goldenImage("boot/welcome-note-ungated", "d"), "Hi at power-on");
  });

  it("reopens on the stored note; Erase removes it and the hands play at power-on", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage });
    keys(rig, `${WELCOME_NOTE} ${HI} navi wait:1000 navi wait:3000 navi wait:500`);
    // The editor on the stored Hi (`welcome/editor` reopened), Options, ▼ Erase, OK.
    expectLcd(rig.paint(), goldenImage("welcome/editor", "reopened"), "reopened on Hi");
    keys(rig, "navi wait:1000 down navi wait:3000");
    expectLcd(rig.paint(), goldenImage("welcome/save-hi", "e"), "the page after Erase");
    expect(stored(storage, WELCOME_NOTE_KEY)).toBeUndefined();

    const next = bootOver(storage);
    next.advance(SELF_TEST_MS + 200);
    expect(next.phone.screen.kind).toBe("boot");
  });

  it("erases the note when the text saved is empty (Task 0 W)", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage });
    keys(rig, `${WELCOME_NOTE} ${HI} navi wait:1000 navi wait:3000`);
    expect(stored(storage, WELCOME_NOTE_KEY)).toBe("Hi");
    // C held clears the text; Options › Save on the empty note: Welcome note erased.
    keys(rig, "navi wait:500 c~1500 navi wait:1000");
    keys(rig, "navi");
    expectLcd(rig.paint(), goldenImage("welcome/save-empty", "b"), "Welcome note erased");
    keys(rig, "wait:3000");
    expect(stored(storage, WELCOME_NOTE_KEY)).toBeUndefined();
  });
});

describe("message centre and voice mailbox numbers (2-7-1-1, 2-7-2-1, 2-9)", () => {
  it("edits Set 1's centre from the SIM's number and stores what OK confirms", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage });
    keys(rig, CENTRE_1);
    expectLcd(rig.paint(), goldenImage("sms/centre-1", "00"), "the SIM's centre");
    keys(rig, "c~2500 0 4 1 9 0 0 0 0 0 0 navi wait:3000");
    expectLcd(rig.paint(), goldenImage("sms/centre-1-ok", "f"), "the page after the note");
    expect(stored(storage, "messages/message-settings/set-1/message-centre-number")).toBe(
      "0419000000",
    );
  });

  it("starts Set 2's centre empty and stores the typed number", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage });
    keys(rig, "navi wait:300 down navi down*6 navi down navi navi wait:500");
    expectLcd(rig.paint(), goldenImage("sms/centre-2", "00"), "no centre in Set 2");
    keys(rig, "0 4 1 9 0 0 0 0 0 0 navi wait:3000");
    expect(stored(storage, "messages/message-settings/set-2/message-centre-number")).toBe(
      "0419000000",
    );
  });

  it("appends to the virgin voice mailbox number and stores it", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage });
    keys(rig, VOICE_MAILBOX);
    expectLcd(rig.paint(), goldenImage("sms/voice-mailbox", "00"), "the virgin number");
    keys(rig, "0 4 1 9 9 9 9 9 9 9 navi wait:3000");
    expectLcd(rig.paint(), goldenImage("sms/voice-mailbox-ok", "e"), "the page after Saved");
    expect(stored(storage, "messages/voice-mailbox-number")).toBe("7930003330419999999");
  });
});
