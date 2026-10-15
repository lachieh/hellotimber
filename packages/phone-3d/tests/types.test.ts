import { describe, expect, it } from "vite-plus/test";
import { ALL_KEYS, resolveLights } from "../src/types";

describe("Nokia3310Key union", () => {
  it("has exactly 17 keys", () => {
    expect(ALL_KEYS).toHaveLength(17);
  });

  it("has no duplicates", () => {
    expect(new Set(ALL_KEYS).size).toBe(ALL_KEYS.length);
  });

  it("contains the navigation cluster and the full digit grid", () => {
    for (const k of ["power", "navi", "c", "up", "down", "*", "0", "#"]) {
      expect(ALL_KEYS).toContain(k);
    }
    for (let d = 0; d <= 9; d++) expect(ALL_KEYS).toContain(String(d));
  });
});

describe("resolveLights", () => {
  it("defaults both lights on", () => {
    expect(resolveLights({})).toEqual({ display: true, keypad: true });
  });

  it("keypad follows backlightOn when keypadLightOn is omitted", () => {
    expect(resolveLights({ backlightOn: false })).toEqual({ display: false, keypad: false });
    expect(resolveLights({ backlightOn: true })).toEqual({ display: true, keypad: true });
  });

  it("keypadLightOn overrides independently of the display", () => {
    expect(resolveLights({ backlightOn: true, keypadLightOn: false })).toEqual({
      display: true,
      keypad: false,
    });
    expect(resolveLights({ backlightOn: false, keypadLightOn: true })).toEqual({
      display: false,
      keypad: true,
    });
    expect(resolveLights({ keypadLightOn: false })).toEqual({ display: true, keypad: false });
  });
});
