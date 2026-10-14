// Plan 15 Task 6: the security record and its rules (D6, Task 0 A2-A5, A3 lockout, B3, B4).
import { describe, expect, it } from "vite-plus/test";
import { PHONE_SECURITY_KEY } from "../src/firmware/bindings";
import { StockEeprom } from "../src/firmware/eeprom";
import { STOCK_RECORDS } from "../src/firmware/records";
import {
  LOCKOUT_MS,
  SECURITY_RECORD,
  StockSecurity,
  WRONG_CODE_LIMIT,
} from "../src/firmware/security";
import { createStockSettings } from "../src/firmware/settings";
import { createMemoryStorage, STOCK_STORAGE_PREFIX, type StockStorage } from "../src/index";

/** A security over a fresh EEPROM on `storage`, on a settable clock. */
function rig(storage: StockStorage = createMemoryStorage()) {
  const eeprom = new StockEeprom(storage);
  const settings = createStockSettings(eeprom);
  let now = 0;
  const security = new StockSecurity(eeprom, settings, () => now);
  return {
    storage,
    eeprom,
    settings,
    security,
    at(ms: number) {
      now = ms;
      return security;
    },
  };
}

describe("SECURITY_RECORD (D6)", () => {
  it("is one of the phone's records; the virgin code is 12345 with no SIMs and no attempts", () => {
    expect(STOCK_RECORDS).toContain(SECURITY_RECORD);
    expect(SECURITY_RECORD.initial()).toEqual({ code: "12345", recentSims: [], wrongAttempts: 0 });
  });

  it("stores the code, the recent SIMs and the wrong-attempt counter", () => {
    const { storage, security } = rig();
    security.changeCode("11111");
    security.insertSim("sim-1");
    expect(storage.getItem(`${STOCK_STORAGE_PREFIX}security`)).toBe(
      '{"code":"11111","recentSims":["sim-1"],"version":1,"wrongAttempts":0}',
    );
  });

  it("throws on a bad shape and drops stale SIM entries", () => {
    expect(() => SECURITY_RECORD.decode({ code: "1234", recentSims: [] }, 1)).toThrow(/code/);
    expect(() =>
      SECURITY_RECORD.decode({ code: "12345", recentSims: [], wrongAttempts: -1 }, 1),
    ).toThrow(/wrongAttempts/);
    expect(
      SECURITY_RECORD.decode(
        { code: "12345", recentSims: ["a", 3, "b", "c", "d", "e", "f"], wrongAttempts: 2 },
        1,
      ),
    ).toEqual({ code: "12345", recentSims: ["a", "b", "c", "d", "e"], wrongAttempts: 2 });
  });

  it("survives Restore factory settings (it has no factory)", () => {
    const { eeprom, security } = rig();
    security.changeCode("11111");
    eeprom.restoreFactory();
    expect(security.verify("11111")).toBe(true);
    expect("factory" in SECURITY_RECORD).toBe(false);
  });
});

describe("StockSecurity", () => {
  it("verifies the code exactly: 12345 by default, never a prefix or a longer entry", () => {
    const { security } = rig();
    expect(security.verify("12345")).toBe(true);
    for (const wrong of ["00000", "1234", "123456", "", "12345 "]) {
      expect(security.verify(wrong), wrong).toBe(false);
      expect(security.verify("12345")).toBe(true);
    }
  });

  it("changes the code to exactly 5 digits (B4): the old one fails, the new one passes", () => {
    const { security } = rig();
    for (const bad of ["", "1234", "123456", "0123456789", "1234a"]) {
      expect(() => security.changeCode(bad), bad).toThrow(/5 digits/);
    }
    security.changeCode("11111");
    expect(security.verify("12345")).toBe(false);
    expect(security.verify("11111")).toBe(true);
  });

  it("reads Phone security from the settings, and asks at power-on for an unknown SIM only", () => {
    const { settings, security } = rig();
    expect(security.phoneSecurity()).toBe(false);
    expect(security.asksAtPowerOn("sim-1")).toBe(false);
    settings.choose(PHONE_SECURITY_KEY, 1);
    expect(security.phoneSecurity()).toBe(true);
    expect(security.asksAtPowerOn("sim-1")).toBe(true);
    security.insertSim("sim-1");
    expect(security.asksAtPowerOn("sim-1")).toBe(false);
    expect(security.asksAtPowerOn("sim-2")).toBe(true);
  });

  it("keeps the last five SIMs, most recent first", () => {
    const { eeprom, security } = rig();
    for (const sim of ["a", "b", "c", "d", "e", "b", "f"]) security.insertSim(sim);
    expect(eeprom.read(SECURITY_RECORD).recentSims).toEqual(["f", "b", "e", "d", "c"]);
    expect(security.asksAtPowerOn("a")).toBe(security.phoneSecurity());
  });
});

describe("the wrong-code lockout (Task 0 A3)", () => {
  const wrong = (security: StockSecurity, times: number) => {
    for (let i = 0; i < times; i++) expect(security.verify("00000")).toBe(false);
  };

  it("lets four wrong codes pass and resets the counter on an accepted code", () => {
    const r = rig();
    wrong(r.security, WRONG_CODE_LIMIT - 1);
    expect(r.security.verify("12345")).toBe(true);
    wrong(r.security, WRONG_CODE_LIMIT - 1);
    expect(r.security.verify("12345")).toBe(true);
    expect(r.eeprom.read(SECURITY_RECORD).wrongAttempts).toBe(0);
  });

  it("locks every entry for ≈290 s after the fifth wrong code (286.7 s no, 291.7 s yes)", () => {
    expect(LOCKOUT_MS).toBeGreaterThan(286_700);
    expect(LOCKOUT_MS).toBeLessThan(291_700);
    const early = rig();
    wrong(early.at(1000), WRONG_CODE_LIMIT);
    expect(early.at(1000 + 286_700).verify("12345")).toBe(false);
    const late = rig();
    wrong(late.at(1000), WRONG_CODE_LIMIT);
    expect(late.at(1000 + 291_700).verify("12345")).toBe(true);
    expect(late.security.verify("00000")).toBe(false);
    expect(late.security.verify("12345")).toBe(true);
  });

  it("restarts the lockout on any entry during it", () => {
    const r = rig();
    wrong(r.at(0), WRONG_CODE_LIMIT);
    expect(r.at(158_000).verify("12345")).toBe(false);
    expect(r.at(158_000 + LOCKOUT_MS - 1).verify("12345")).toBe(false);
    expect(r.at(158_000 + 2 * LOCKOUT_MS).verify("12345")).toBe(true);
  });

  it("survives a power cycle: a phone over the same storage starts it again", () => {
    const first = rig();
    wrong(first.at(0), WRONG_CODE_LIMIT);
    const second = rig(first.storage);
    expect(second.at(500_000).verify("12345")).toBe(false);
    expect(second.at(500_000 + LOCKOUT_MS).verify("12345")).toBe(true);
  });
});
