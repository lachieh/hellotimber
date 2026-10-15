// Plan 27 Task 9: Options › Save and Send on the stock phone: `Tone name:` (K11), `Tone saved`,
// the slots named at once, the saved tones over a cold boot (two phones over one storage) and
// Restore factory settings. The stills replay Task 0's cases (COMPOSER_CASES).
import { describe, expect, it } from "vite-plus/test";
import { COMPOSER_CASES } from "../scripts/capture-sets/27-composer.ts";
import { parseTokens } from "../src/composer/notation";
import { StockComposer } from "../src/composer/store";
import { StockEeprom, type StockStorage } from "../src/firmware/eeprom";
import { NAME_C_HELD_STANDBY_MS } from "../src/widgets/composer";
import { composerCase, composerRig, playComposer, setupKeys } from "./support/composer";
import { caseStill, COMPOSER_IMAGE_GAPS } from "./support/composer-scenarios.ts";
import { seededStorage, type Rig } from "./support/rig.ts";

/** Stills nokia-os does not reproduce: Task 12's per-image known gaps, with their causes. */
const GAPS = new Set(Object.keys(COMPOSER_IMAGE_GAPS));

const STILLS = COMPOSER_CASES.filter(
  (c) =>
    /^(save|send|slots\/named|open\/saved|returns\/save|leave\/saved|newtempo\/after-save|persist|restore)/.test(
      c.name,
    ) && !GAPS.has(c.name),
);

describe("Task 0's Save, Send, cold boot and Restore stills on the phone", () => {
  it("covers the groups; every gap is a case", () => {
    expect(STILLS.length).toBeGreaterThan(50);
    for (const name of GAPS) expect(composerCase(name).name).toBe(name);
  });
  // persist: two phones over one storage (a cold boot); restore: Menu 6 4 through the phone
  for (const c of STILLS) it(c.name, () => caseStill(c), 60_000);
});

describe("Save and Send on the phone", () => {
  /** Slot `slot`'s editor holding `keys`' tones, Options › Save's `Tone name:` open. */
  function namePrompt(keys = "1 2 3", slot = 1, storage?: StockStorage): Rig {
    const rig = composerRig("factory", storage);
    playComposer(rig, setupKeys({ from: "editor", slot }));
    playComposer(rig, `${keys} menu down menu +600`);
    return rig;
  }

  it("writes the slot at once on OK and names the slot in the list", () => {
    const storage = seededStorage({ factory: true });
    const rig = namePrompt("1 2 3", 2, storage);
    playComposer(rig, "2 +1600 menu");
    expect(new StockComposer(new StockEeprom(storage)).slot(2)).toEqual({
      name: "A",
      tempo: 112,
      tokens: parseTokens("4c1 4d1 4e1"),
    });
    // `Tone saved`, then Options on Save; C back to the editor, Exit to Tones, Composer's slots
    playComposer(rig, "+3500 c menu up menu +1500 menu +2000");
    const screen = rig.phone.screen;
    expect(screen.kind === "list" ? screen.items[1] : undefined).toBe("A");
  });

  it("keeps the slot empty when the prompt goes back (Back, C on the empty name)", () => {
    for (const key of ["menu", "c"]) {
      const storage = seededStorage({ factory: true });
      const rig = namePrompt("1 2 3", 1, storage);
      playComposer(rig, key);
      expect(new StockComposer(new StockEeprom(storage)).slot(1)).toBeNull();
      expect(rig.phone.path).toContain("tones");
    }
  });

  it("goes to standby when C on the empty name stays down (K11)", () => {
    const rig = namePrompt();
    rig.phone.send({ type: "down", key: "c" });
    rig.advance(NAME_C_HELD_STANDBY_MS - 20);
    expect(rig.phone.screen.kind).not.toBe("standby");
    rig.advance(40);
    rig.phone.send({ type: "up", key: "c" });
    rig.advance(100);
    expect(rig.phone.screen.kind).toBe("standby");
  });

  it("prefills a saved tone's name, and OK on the renamed tone overwrites it", () => {
    const storage = seededStorage({ factory: true });
    new StockComposer(new StockEeprom(storage)).save(1, {
      name: "Old",
      tempo: 225,
      tokens: parseTokens("8c2"),
    });
    const rig = composerRig("factory", storage);
    playComposer(rig, setupKeys({ from: "editor", slot: 1 }));
    playComposer(rig, "1 menu down menu +600 c@1500 3 +1600 menu");
    expect(new StockComposer(new StockEeprom(storage)).slot(1)).toEqual({
      name: "D",
      tempo: 225,
      tokens: parseTokens("8c2 8c2"),
    });
  });

  it("asks Send's name, then its number; OK on a number opens 18c's placeholder", () => {
    const storage = seededStorage({ factory: true });
    const rig = composerRig("factory", storage);
    playComposer(rig, setupKeys({ from: "editor", slot: 1 }));
    playComposer(rig, "1 2 3 menu down down down menu +600 2 +1600 menu +1000 0 4 1 menu +600");
    const screen = rig.phone.screen;
    expect(screen.kind === "custom" ? screen.appId : "").toContain("composer");
    // Send writes nothing
    expect(new StockComposer(new StockEeprom(storage)).slot(1)).toBeNull();
  });
});
