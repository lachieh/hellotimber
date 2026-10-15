// Plan 17 Task 8: Rename (D9) through keys: plan 18's text input on the profile's name, the
// limit, the empty name, the C keys, and the new name everywhere (the goldens are the acceptance
// file's).
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import { profileName } from "../src/firmware/features/profiles";
import { createStockSettings } from "../src/firmware/settings";
import type { StockStorage } from "../src/index";
import { profilesRig, profilesStorage, shortcut } from "./support/profiles.ts";
import type { Rig } from "./support/rig.ts";

const nameOf = (storage: StockStorage, slug: "silent" | "loud" | "empty-2") =>
  profileName(createStockSettings(new StockEeprom(storage)), slug);

/** Standby → the profile's Rename prompt. */
function prompt(rig: Rig, n: number): void {
  shortcut(rig, 1, 2, n, 2);
  rig.press("up");
  rig.advance(1000);
  rig.press("navi");
  rig.advance(1500);
}

/** Taps `key` `times` times, then waits for the multi-tap commit. */
function type(rig: Rig, key: "2" | "3" | "4" | "9", times: number): void {
  for (let i = 0; i < times; i++) {
    rig.press(key);
    rig.advance(300);
  }
  rig.advance(1700);
}

describe("Rename (D9)", () => {
  it("appends to the name in lower case and stores it on OK, then Done and the page", () => {
    const storage = profilesStorage();
    const rig = profilesRig(storage);
    prompt(rig, 2);
    type(rig, "4", 2); // h
    rig.press("navi");
    expect(nameOf(storage, "silent")).toBe("Silenth");
    rig.advance(3000);
    expect(rig.phone.path).toBe("menu/profiles/silent/personalise");
    expect(rig.phone.screen).toMatchObject({ kind: "list", detail: "Silenth" });
  });

  it("holds 10 characters and ignores keys beyond", () => {
    const storage = profilesStorage();
    const rig = profilesRig(storage);
    prompt(rig, 2); // Silent: 4 left
    for (const k of ["2", "3", "4", "9", "2"] as const) type(rig, k, 1);
    rig.press("navi");
    expect(nameOf(storage, "silent")).toBe("Silentadgw");
  });

  it("restores the factory name for an empty name; C on an empty entry keeps the old one", () => {
    const storage = profilesStorage({ names: { "empty-2": "Ab" } });
    const rig = profilesRig(storage);
    prompt(rig, 6);
    rig.press("c", 1500);
    rig.advance(500);
    rig.press("navi");
    expect(nameOf(storage, "empty-2")).toBe("(empty)");
    rig.advance(3000);
    const loud = profilesRig(storage);
    prompt(loud, 4);
    loud.press("c"); // Lou
    loud.press("c", 1500); // cleared
    loud.advance(500);
    loud.press("c"); // the page, unchanged
    loud.advance(500);
    expect(loud.phone.path).toBe("menu/profiles/loud/personalise");
    expect(nameOf(storage, "loud")).toBe("Loud");
  });

  it("shows the new name in the Profiles level, the power list, the note and standby", () => {
    const storage = profilesStorage({ names: { silent: "Silenth" } });
    const rig = profilesRig(storage);
    rig.phone.navigate("menu/profiles");
    expect(rig.phone.screen).toMatchObject({ items: expect.arrayContaining(["Silenth"]) });
    rig.phone.navigate("standby");
    rig.advance(100);
    rig.press("power");
    rig.advance(500);
    rig.press("3"); // Silenth, by its position
    rig.advance(9000);
    expect(rig.phone.screen).toMatchObject({ kind: "standby", line: "Silenth" });
  });
});
