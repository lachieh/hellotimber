// Plan 17 Task 7: the power key's profile list (D7) through keys; the goldens are the acceptance
// file's.
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import { activeProfile, POWER_LIST_ZERO_MS } from "../src/firmware/features/profiles";
import { createStockSettings } from "../src/firmware/settings";
import type { StockStorage } from "../src/index";
import { profilesRig, profilesStorage, shortcut, toLevel } from "./support/profiles.ts";
import type { Rig } from "./support/rig.ts";

const settingsOf = (storage: StockStorage) => createStockSettings(new StockEeprom(storage));

/** Opens the list from standby and lets its leading frame pass. */
function openList(rig: Rig): void {
  rig.press("power");
  rig.advance(500);
}

describe("the power key's list (D7)", () => {
  it("opens on the key-down at standby, over standby with its ladders erased", () => {
    const rig = profilesRig();
    rig.hold("power");
    expect(rig.phone.path).toBe("standby");
    expect(rig.phone.screen.kind).toBe("custom");
    const erased = rig.paint().pixels;
    rig.advance(40);
    rig.release("power");
    expect(rig.paint().pixels).not.toEqual(erased);
    rig.advance(500);
    // The opening press's release does not move it: Switch off! stays highlighted.
    rig.press("navi");
    expect(rig.phone.screen).toEqual({ kind: "off" });
  });

  it("moves with ▲/▼ and the power key, and chooses a profile with OK or its digit", () => {
    const storage = profilesStorage();
    const rig = profilesRig(storage);
    openList(rig);
    rig.press("power");
    rig.press("down"); // Silent
    rig.press("navi");
    expect(activeProfile(settingsOf(storage))).toBe("silent");
    rig.advance(9000);
    expect(rig.phone.screen).toMatchObject({ kind: "standby", line: "Silent" });
    openList(rig);
    rig.press("5"); // Loud (position 5)
    expect(activeProfile(settingsOf(storage))).toBe("loud");
  });

  it("switches off with 1, shows Invalid shortcut for 8 and 9, and for 0 after the window", () => {
    const off = profilesRig();
    openList(off);
    off.press("1");
    expect(off.phone.screen).toEqual({ kind: "off" });
    const nine = profilesRig();
    openList(nine);
    nine.press("9");
    nine.advance(4000);
    expect(nine.phone.screen.kind).toBe("standby");
    const zero = profilesRig();
    openList(zero);
    zero.press("0");
    zero.advance(POWER_LIST_ZERO_MS - 10);
    const list = zero.paint().pixels;
    zero.advance(20);
    expect(zero.paint().pixels).not.toEqual(list);
    const star = profilesRig();
    openList(star);
    const before = star.paint().pixels;
    star.press("*");
    star.press("#");
    star.advance(5000);
    expect(star.paint().pixels).toEqual(before);
  });

  it("returns to standby on C, and powers off on the power key's long press", () => {
    const rig = profilesRig();
    openList(rig);
    rig.press("c");
    rig.advance(200);
    expect(rig.phone.screen.kind).toBe("standby");
    openList(rig);
    rig.press("power", 1000);
    expect(rig.phone.screen).toEqual({ kind: "off" });
  });

  it("opens during Activate's note (the profile already chosen), not elsewhere (B6)", () => {
    const storage = profilesStorage();
    const rig = profilesRig(storage);
    toLevel(rig, "silent");
    rig.press("navi");
    rig.advance(700);
    rig.press("power");
    expect(rig.phone.path).toBe("standby");
    expect(rig.phone.screen.kind).toBe("custom");
    expect(activeProfile(settingsOf(storage))).toBe("silent");
    for (const where of [[] as (number | string)[], [1, 2], [5], [6, 2, 2], [1, 2, 2, 2]]) {
      const other = profilesRig();
      if (where.length === 0) {
        other.press("navi");
        other.advance(1500);
      } else shortcut(other, ...where);
      const { path, screen } = other.phone;
      other.press("power");
      expect(other.phone.path, where.join(" ")).toBe(path);
      expect(other.phone.screen.kind, where.join(" ")).toBe(screen.kind);
    }
  });
});
