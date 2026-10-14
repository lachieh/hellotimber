// Plan 15 Task 5: settings survive the phone (D1-D4). A phone over a storage that another phone
// wrote boots with its choices, as `probe/persist-reboot` shows after `saveflash` and `reboot`.
import { describe, expect, it } from "vite-plus/test";
import { createMemoryStorage, createStockPhone, STOCK_STORAGE_PREFIX } from "../src/index";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";
import { keys } from "./support/probes.ts";
import { standbyRig } from "./support/rig.ts";

const KEYPAD_TONES = "navi wait:300 down*4 navi down*5";

describe("persistence through keys (probe/persist-reboot)", () => {
  it("shows Keypad tones Level 2 on its page and opens its list on it after a new phone", () => {
    const storage = createMemoryStorage();
    const first = standbyRig({ storage });
    keys(first, `${KEYPAD_TONES} navi down*3 navi wait:3000`);
    expect(storage.getItem(`${STOCK_STORAGE_PREFIX}settings`)).toContain("keypad-tones");

    const second = standbyRig({ storage });
    keys(second, KEYPAD_TONES);
    expectLcd(second.paint(), goldenImage("probe/persist-reboot", "5-6-page"), "page");
    keys(second, "navi");
    expectLcd(second.paint(), goldenImage("probe/persist-reboot", "5-6-list"), "list");
  });

  it("boots the virgin EEPROM from an empty storage", () => {
    const rig = standbyRig({ storage: createMemoryStorage() });
    keys(rig, KEYPAD_TONES);
    expectLcd(rig.paint(), goldenImage("probe/persist-reboot", "before-5-6-page"), "page");
  });

  it("throws from createStockPhone when a stored record is malformed, naming its key", () => {
    const storage = createMemoryStorage();
    storage.setItem(`${STOCK_STORAGE_PREFIX}settings`, "{not json");
    expect(() => createStockPhone({ carrier: "Orange F", storage })).toThrow(
      `EEPROM record ${STOCK_STORAGE_PREFIX}settings: not JSON.`,
    );
    storage.setItem(`${STOCK_STORAGE_PREFIX}settings`, '{"version":2}');
    expect(() => createStockPhone({ carrier: "Orange F", storage })).toThrow(
      /version 2 is newer than this firmware's \(1\)/,
    );
  });
});
