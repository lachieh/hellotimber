// Plan 27 Task 9: Options › Save and Send on the stock phone: `Tone name:` (K11), `Tone saved`,
// the slots named at once, the saved tones over a cold boot (two phones over one storage) and
// Restore factory settings. The stills replay Task 0's cases (COMPOSER_CASES).
import { describe, expect, it } from "vite-plus/test";
import {
  COMPOSER_CASES,
  OPEN_COMPOSER,
  stillFixtureOf,
  type ComposerCase,
} from "../scripts/capture-sets/27-composer.ts";
import { parseTokens } from "../src/composer/notation";
import { StockComposer } from "../src/composer/store";
import { createMemoryStorage, StockEeprom, type StockStorage } from "../src/firmware/eeprom";
import { NAME_C_HELD_STANDBY_MS } from "../src/widgets/composer";
import {
  composerCase,
  composerRig,
  composerStill,
  playComposer,
  setupKeys,
} from "./support/composer";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";
import { seededStorage, type Rig } from "./support/rig.ts";

/**
 * Stills this task does not reproduce (Task 12 lists them as known gaps): a long name drawn in the
 * small face on two lines (plan 18's text prompt draws the large face only), and the cursor's
 * phase on five showings after a Save (no single blink rule found, Task 0 `returns`). The
 * Ringing tone page cases are Task 10's.
 */
const GAPS = new Set([
  "save/keys/fifteen",
  "save/keys/sixteen",
  "save/keys/prefilled-edit",
  "open/saved-save",
  "leave/saved-cleared-reopen",
  "leave/saved-exit-edited",
  "restore/slot-1",
]);

const STILLS = COMPOSER_CASES.filter(
  (c) =>
    /^(save|send|slots\/named|open\/saved|returns\/save|leave\/saved|newtempo\/after-save)/.test(
      c.name,
    ) && !GAPS.has(c.name),
);

describe("Task 0's Save and Send stills on the phone", () => {
  it("covers the Save and Send groups; every gap is a case", () => {
    expect(STILLS.length).toBeGreaterThan(30);
    for (const name of GAPS) expect(composerCase(name).name).toBe(name);
  });
  for (const c of STILLS) it(c.name, () => composerStill(c), 30_000);
});

/** The case's still on `rig` after its keys. */
function expectStill(rig: Rig, c: ComposerCase): void {
  playComposer(rig, c.keys);
  const { id, image } = stillFixtureOf(c.name);
  expectLcd(rig.paint(), goldenImage(id, image), `${c.name}: ${c.keys || "(no key)"}`);
}

/** `<group>/before-slots`' tones saved on a phone over `storage` (`gen_v639_plan27.py`). */
function saveTones(storage: StockStorage, group: "persist" | "restore"): Rig {
  const before = composerCase(`${group}/before-slots`);
  const rig = composerRig(before.state, storage);
  playComposer(rig, OPEN_COMPOSER);
  expectStill(rig, before);
  return rig;
}

describe("saved tones over a cold boot (Task 0 M, D7)", () => {
  const cases = COMPOSER_CASES.filter(
    (c) => c.setup === "persist" && c.name !== "persist/ringing-page",
  );
  it("has the slots, slot and tempo cases", () => expect(cases.length).toBeGreaterThan(10));
  for (const c of cases) {
    it(
      c.name,
      () => {
        const storage = seededStorage({ factory: true });
        saveTones(storage, "persist");
        // a second phone over the same storage: a cold boot
        const rig = composerRig("factory", storage);
        playComposer(rig, OPEN_COMPOSER);
        expectStill(rig, c);
      },
      30_000,
    );
  }
});

describe("Restore factory settings (K13)", () => {
  const cases = COMPOSER_CASES.filter(
    (c) => c.setup === "restore" && c.name !== "restore/ringing-page" && !GAPS.has(c.name),
  );
  it("has the slots, slot and tempo cases", () => expect(cases.length).toBeGreaterThan(3));
  for (const c of cases) {
    it(
      c.name,
      () => {
        const rig = saveTones(createMemoryStorage(), "restore");
        // Menu 6 4, the security code, OK (the capture's `key menu 6 4` types the shortcut faster)
        playComposer(rig, "c@1500 +1000 menu 6 4 +4000 1 2 3 4 5 menu +6000 c@1500 +1000");
        playComposer(rig, OPEN_COMPOSER);
        expectStill(rig, c);
      },
      30_000,
    );
  }
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
