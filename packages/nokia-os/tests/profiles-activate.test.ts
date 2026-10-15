// Plan 17 Task 6: Activate, the standby profile line and icon, the Profiles level's names and
// opening, and the activation beep, through keys (the goldens are the acceptance file's).
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import {
  activeProfile,
  PROFILE_LINE_DELAY_MS,
  standbyProfileText,
} from "../src/firmware/features/profiles";
import { createStockSettings } from "../src/firmware/settings";
import type { StockStorage } from "../src/index";
import {
  activateByKeys,
  profilesRig,
  profilesStorage,
  toLevel,
  toStandby,
} from "./support/profiles.ts";

const settingsOf = (storage: StockStorage) => createStockSettings(new StockEeprom(storage));

/** The standby model's profile fields. */
function standby(rig: ReturnType<typeof profilesRig>) {
  const screen = rig.phone.screen;
  if (screen.kind !== "standby") throw new Error(`Expected standby, received ${screen.kind}.`);
  return { line: screen.line, silent: screen.indicators?.silent ?? false };
}

describe("Activate (D3)", () => {
  it("stores the choice when the note opens and shows the name, then standby", () => {
    const storage = profilesStorage();
    const rig = profilesRig(storage);
    toLevel(rig, "silent");
    expect(rig.phone.path).toBe("menu/profiles/silent");
    rig.press("navi");
    expect(activeProfile(settingsOf(storage))).toBe("silent");
    expect(rig.phone.path).toBe("menu/profiles/silent/activate");
    rig.advance(3000);
    expect(rig.phone.path).toBe("standby");
    expect(standby(rig)).toEqual({ line: undefined, silent: true });
  });

  it("draws the name under the operator PROFILE_LINE_DELAY_MS after standby (D5)", () => {
    const rig = profilesRig();
    toLevel(rig, "loud");
    rig.press("navi");
    // The note runs ≈2.9 s; standby follows its last step.
    let standbyAt = -1;
    for (let t = 0; t < 4000 && standbyAt < 0; t++) {
      rig.advance(1);
      if (rig.phone.screen.kind === "standby") standbyAt = rig.now;
    }
    rig.advance(PROFILE_LINE_DELAY_MS - 2);
    expect(standby(rig).line).toBeUndefined();
    rig.advance(2);
    expect(standby(rig)).toEqual({ line: "Loud", silent: false });
    // Menu keeps it while the ladders are erased; C returns without it, then it comes back.
    rig.press("navi");
    expect(rig.phone.screen).toMatchObject({ kind: "standby", leaving: true, line: "Loud" });
    rig.advance(1500);
    rig.press("c");
    expect(standby(rig).line).toBeUndefined();
    rig.advance(PROFILE_LINE_DELAY_MS);
    expect(standby(rig).line).toBe("Loud");
  });

  it("shows no name for General and the icon only while the alert is Off (D6)", () => {
    const rig = profilesRig(profilesStorage({ active: "loud" }));
    expect(standby(rig)).toEqual({ line: "Loud", silent: false });
    activateByKeys(rig, "general");
    expect(standby(rig)).toEqual({ line: undefined, silent: false });
    const alertOff = profilesRig(
      profilesStorage({ active: "loud", choices: { "tones/incoming-call-alert": 4 } }),
    );
    expect(standby(alertOff)).toEqual({ line: "Loud", silent: true });
  });

  it("writes Silent for General with its alert, message, keypad and warning tones off", () => {
    const quiet = {
      "tones/incoming-call-alert": 4,
      "tones/message-alert-tone": 0,
      "tones/keypad-tones": 0,
      "tones/warning-tones": 1,
    };
    const storage = profilesStorage({ names: { silent: "Quiet" }, choices: quiet });
    expect(standbyProfileText(settingsOf(storage))).toBe("Silent");
    expect(standby(profilesRig(storage))).toEqual({ line: "Silent", silent: true });
    for (const key of Object.keys(quiet)) {
      const one = { ...quiet, [key]: key === "tones/warning-tones" ? 0 : 1 };
      expect(standbyProfileText(settingsOf(profilesStorage({ choices: one }))), key).toBe(
        undefined,
      );
    }
    const loud = profilesStorage({ active: "loud", choices: quiet });
    expect(standbyProfileText(settingsOf(loud))).toBe("Loud");
  });

  it("names the Profiles level's entries and opens it on the active profile (D8)", () => {
    const rig = profilesRig(profilesStorage({ active: "discreet", names: { silent: "Silenth" } }));
    rig.phone.navigate("menu/profiles");
    expect(rig.phone.screen).toMatchObject({
      kind: "list",
      items: ["General", "Silenth", "Discreet", "Loud", "(empty)", "(empty)"],
      selected: 2,
    });
    rig.phone.navigate("menu/profiles/silent");
    expect(rig.phone.screen).toMatchObject({ kind: "list", title: "Silenth" });
  });

  it("survives a power cycle (P7)", () => {
    const storage = profilesStorage();
    activateByKeys(profilesRig(storage), "discreet");
    const again = profilesRig(storage);
    expect(standby(again).line).toBe("Discreet");
  });
});

describe("the activation beep (D4)", () => {
  /** The tone level of the beep the key `key` starts. */
  function beepVolume(rig: ReturnType<typeof profilesRig>, press: () => void): number | null {
    const seen = rig.sounds.length;
    press();
    rig.advance(200);
    const tone = rig.sounds.slice(seen).find((e) => e.output === "tone" && e.hz !== null);
    return tone !== undefined && tone.output !== "vibrator" && tone.hz !== null
      ? tone.volume
      : null;
  }

  it("beeps the activating Navi at the new profile's Keypad tones level", () => {
    const loud = profilesRig();
    toLevel(loud, "loud");
    const general = profilesRig();
    toLevel(general, "general");
    const silent = profilesRig();
    toLevel(silent, "silent");
    const level3 = beepVolume(loud, () => loud.press("navi"));
    const level2 = beepVolume(general, () => general.press("navi"));
    expect(level3).not.toBeNull();
    expect(level2).not.toBeNull();
    expect(level3).not.toBe(level2);
    expect(beepVolume(silent, () => silent.press("navi"))).toBeNull();
  });

  it("beeps the shortcut's last digit onto Activate at the new level (Menu 1 2 n 1)", () => {
    const rig = profilesRig();
    rig.press("navi");
    for (const digit of ["1", "2", "2"] as const) {
      rig.advance(300);
      rig.press(digit);
    }
    rig.advance(300);
    expect(beepVolume(rig, () => rig.press("1"))).toBeNull();
    rig.advance(5000);
    toStandby(rig);
    expect(rig.phone.screen.kind).toBe("standby");
  });
});
