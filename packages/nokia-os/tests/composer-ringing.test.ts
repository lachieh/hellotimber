// Plan 27 Task 10: the Composer's saved tones as Ringing tone entries 36-42 (D8, D9): their names
// in Tones' and every Personalise list and as the page value, their previews in both lists and
// the Ringing volume list, and plan 22's ring(). The states are the captures' (`ringing-*` setups:
// TONES of `gen_v639_plan27.py`) written straight into storage.
import { describe, expect, it } from "vite-plus/test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { EMPTY_COMPOSER } from "../src/composer/editor";
import { StockComposer } from "../src/composer/store";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import type { StockSoundEvent } from "../src/index";
import { SoundSequencer } from "../src/sound/sequencer";
import { StockSounder } from "../src/sound/sounder";
import { recordTimeline } from "./support/acceptance.ts";
import { replayComposerKeys } from "./support/composer";
import {
  entryOf,
  expectStill,
  PREVIEW_GAPS,
  previewScenario,
  RINGING_ALL,
  ringingRig,
  ringingStorage,
} from "./support/composer-scenarios.ts";
import { open } from "./support/drive.ts";
import { expectTimeline, PROBE_TOLERANCE_MS } from "./support/golden.ts";
import { loadGolden } from "./support/goldens.ts";
import { keys } from "./support/probes.ts";
import type { Rig } from "./support/rig.ts";

const TONE = "tones/ringing-tone";
const NOKIA_TUNE = 12;
const ALL = RINGING_ALL;
const rigOver = ringingRig;
const still = expectStill;

describe("names in the Ringing tone lists (D8, K12)", () => {
  /** A list opened on Nokia tune and moved to option 33, then nine ▼ with a still each. */
  function walk(rig: Rig, group: string): void {
    rig.advance(1500);
    keys(rig, `down*${33 - NOKIA_TUNE}`);
    for (let i = 0; i <= 9; i++) {
      if (i > 0) keys(rig, "down");
      still(rig, `${group}/${String(i).padStart(2, "0")}`);
    }
  }

  it("Tones › Ringing tone", () => {
    const rig = rigOver(ringingStorage(ALL));
    keys(rig, "navi 5 1");
    walk(rig, "ringing/tones");
  });

  for (const [n, profile] of [
    [1, "general"],
    [2, "silent"],
  ] as const) {
    it(`Profiles › ${profile} › Personalise › Ringing tone`, () => {
      const rig = rigOver(ringingStorage(ALL));
      open(rig, `12-${n}-2-1`);
      walk(rig, `ringing/${profile}`);
    });
  }

  it("OK on a saved tone: Done, then its name is the page value; the list opens on it", () => {
    const rig = rigOver(ringingStorage(ALL));
    keys(rig, `navi 5 1 wait:1500 down*${entryOf(3) - NOKIA_TUNE}`);
    const golden = loadGolden("composer/ringing-choose");
    const recording = recordTimeline(rig, golden, () => rig.press("navi"));
    expectTimeline(recording, golden, "ringing/choose", { toleranceMs: PROBE_TOLERANCE_MS });
    still(rig, "ringing/page");
    keys(rig, "c~1500 wait:1000 navi wait:400 5 wait:4500");
    still(rig, "ringing/page-tones");
    keys(rig, "c~1500 wait:1000 navi 5 1 wait:1500");
    still(rig, "ringing/stored-open");
  });

  it("a slot overwritten under the stored tone shows its new name", () => {
    const storage = ringingStorage(ALL, { [TONE]: entryOf(3) });
    const tokens = replayComposerKeys(EMPTY_COMPOSER, "5 5").state.tokens;
    new StockComposer(new StockEeprom(storage)).save(3, { name: "Cd", tempo: 112, tokens });
    const rig = rigOver(storage);
    keys(rig, "navi 5 1 wait:1500");
    still(rig, "ringing/overwritten-open");
  });

  it("an emptied slot is `(empty)` again (Restore factory settings, K13)", () => {
    const storage = ringingStorage([1]);
    new StockEeprom(storage).restoreFactory();
    expect(new StockComposer(new StockEeprom(storage)).ringingToneLabel(entryOf(1))).toBe(
      undefined,
    );
  });
});

describe("saved tones' previews (D9)", () => {
  const ids = readdirSync(join(import.meta.dirname, "../goldens/sound/composer"))
    .map((file) => `sound/composer/${file.replace(/\.sound\.txt$/, "")}`)
    .filter((id) => id.startsWith("sound/composer/preview-"));
  it("has every preview golden", () => expect(ids).toHaveLength(58));
  for (const id of ids) {
    if (id in PREVIEW_GAPS) continue;
    it(id, () => previewScenario(id), 60_000);
  }

  it("an (empty) slot previews nothing", () => {
    const rig = rigOver(ringingStorage([], { [TONE]: entryOf(1) - 1 }));
    keys(rig, "navi 5 1 wait:1500");
    const from = rig.sounds.length;
    keys(rig, "down wait:4000");
    expect(rig.sounds.slice(from).filter((e) => e.output === "buzzer")).toEqual([]);
  });
});

describe("plan 22's ring() with a saved tone", () => {
  it("repeats the stored saved tone's pass", () => {
    const storage = ringingStorage([1], { [TONE]: entryOf(1) });
    const eeprom = new StockEeprom(storage);
    const composer = new StockComposer(eeprom);
    const events: StockSoundEvent[] = [];
    const sequencer = new SoundSequencer((event) => events.push(event));
    const sounder = new StockSounder(sequencer, createStockSettings(eeprom), () => 0, {
      userTones: (index) => composer.userRingingTone(index),
    });
    expect(sounder.ring("tones")).toBeDefined();
    sequencer.advance(4000);
    const onsets = events.flatMap((e) =>
      e.output === "buzzer" && e.hz !== null ? [[e.atMs, e.hz] as const] : [],
    );
    const pass = composer.userRingingTone(entryOf(1))!.cycleMs!;
    expect(onsets.map(([, hz]) => hz).slice(0, 6)).toEqual([523, 587, 659, 523, 587, 659]);
    expect(onsets[3]![0]).toBe(pass);
  });
});
