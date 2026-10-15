// Plan 27 Task 10: the Composer's saved tones as Ringing tone entries 36-42 (D8, D9): their names
// in Tones' and every Personalise list and as the page value, their previews in both lists and
// the Ringing volume list, and plan 22's ring(). The states are the captures' (`ringing-*` setups:
// TONES of `gen_v639_plan27.py`) written straight into storage.
import { describe, expect, it } from "vite-plus/test";
import { stillFixtureOf } from "../scripts/capture-sets/27-composer.ts";
import { EMPTY_COMPOSER } from "../src/composer/editor";
import { COMPOSER_RINGING_INDEX, StockComposer } from "../src/composer/store";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import type { StockSoundEvent, StockStorage } from "../src/index";
import { SoundSequencer } from "../src/sound/sequencer";
import { StockSounder } from "../src/sound/sounder";
import { recordTimeline } from "./support/acceptance.ts";
import { replayComposerKeys } from "./support/composer";
import { open } from "./support/drive.ts";
import { expectLcd, expectTimeline, PROBE_TOLERANCE_MS } from "./support/golden.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";
import { keys } from "./support/probes.ts";
import { seededStorage, standbyRig, type Rig } from "./support/rig.ts";
import {
  expectSoundTimeline,
  loadSoundGolden,
  playSound,
  type SoundTolerance,
} from "./support/sound.ts";

/** The captures' saved tones by slot: name, keys from the empty editor, tempo. */
const TONES: Readonly<Record<number, readonly [string, string, number]>> = {
  1: ["A", "1 2 3", 112],
  2: ["B", "1 2 3 4 5 6 7 1", 40],
  3: ["C", Array.from({ length: 30 }, (_, i) => String((i % 7) + 1)).join(" "), 112],
  4: ["D", Array.from({ length: 20 }, (_, i) => String((i % 7) + 1)).join(" "), 225],
  7: ["G", `1 8 ${Array.from({ length: 49 }, (_, i) => "2345671"[i % 7]).join(" ")}`, 40],
};
/**
 * `ringing-all` saves slots 1, 2, 3 and 7 in turn, and a new tone starts at the last tempo set:
 * slot 3 follows slot 2's 40 BPM there.
 */
const ALL_TEMPI: Readonly<Record<number, number>> = { 3: 40 };

const TONE = "tones/ringing-tone";
const VOLUME = "tones/ringing-volume";
const ALERT = "tones/incoming-call-alert";
const VIBRA = "tones/vibrating-alert";
const NOKIA_TUNE = 12;
/** The option index of slot k's entry (`5-1-36` is slot 1). */
const entryOf = (slot: number): number => COMPOSER_RINGING_INDEX + slot - 1;

/** Factory storage with `slots` saved and `choices` set. */
function ringingStorage(
  slots: readonly number[],
  choices: Readonly<Record<string, number>> = {},
  tempi: Readonly<Record<number, number>> = slots.length > 1 ? ALL_TEMPI : {},
): StockStorage {
  const storage = seededStorage({ factory: true });
  const eeprom = new StockEeprom(storage);
  const composer = new StockComposer(eeprom);
  for (const slot of slots) {
    const [name, keyScript, tempo] = TONES[slot]!;
    const { tokens } = replayComposerKeys(EMPTY_COMPOSER, keyScript).state;
    composer.save(slot, { name, tempo: tempi[slot] ?? tempo, tokens });
  }
  const settings = createStockSettings(eeprom);
  for (const [key, index] of Object.entries(choices)) settings.choose(key, index);
  return storage;
}

/** A factory phone at standby over `storage` (the captures' C held, then 1 s). */
function rigOver(storage: StockStorage): Rig {
  const rig = standbyRig({ storage });
  rig.press("c", 1500);
  rig.advance(1000);
  return rig;
}

function still(rig: Rig, name: string): void {
  const { id, image } = stillFixtureOf(name);
  expectLcd(rig.paint(), goldenImage(id, image), name);
}

/** `sound/composer/<id>`'s keys on `rig` (after `setup`), compared as a later recording. */
function expectPreview(id: string, rig: Rig, setup: string, tolerance: SoundTolerance = {}): void {
  const golden = loadSoundGolden(`sound/composer/${id}`);
  if (setup !== "") keys(rig, setup);
  const recorded = playSound(rig, golden);
  expectSoundTimeline(recorded, golden, `${id}: ${setup}, then ${golden.note ?? ""}`, {
    drift: true,
    ...tolerance,
  });
}

const ALL = [1, 2, 3, 7];

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

/** Each slot's preview conditions: settings written before the list opens. */
const CONDITIONS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "level-1": { [VOLUME]: 0 },
  "level-2": { [VOLUME]: 1 },
  "level-3": { [VOLUME]: 2 },
  "level-4": {},
  "level-5": { [VOLUME]: 4 },
  ascending: { [ALERT]: 1 },
  "ring-once": { [ALERT]: 2 },
  "beep-once": { [ALERT]: 3 },
  off: { [ALERT]: 4 },
  "vibrator-off": { [VIBRA]: 1 },
};

/**
 * Previews nokia-os does not reproduce (Task 12's known gaps): Level 5's jump and Ascending's
 * steps of the tones long enough to reach them follow no rule of the tone (D9: nokia-os steps
 * every `levelStepMs` from the start); and at 225 BPM a preview holds each quarter 33 timer units
 * where Play holds 32 (`sound/composer/tempo-225`: slot 4, the one 225 BPM tone captured).
 */
export const PREVIEW_GAPS: ReadonlySet<string> = new Set([
  ...[2, 3, 7].flatMap((slot) => [
    `preview-slot-${slot}-level-5`,
    `preview-slot-${slot}-ascending`,
  ]),
  ...Object.keys({
    "level-1": 0,
    "level-2": 0,
    "level-3": 0,
    "level-4": 0,
    "level-5": 0,
    ascending: 0,
    "ring-once": 0,
    "vibrator-off": 0,
  }).map((condition) => `preview-slot-4-${condition}`),
  "preview-volume-5",
]);

describe("saved tones' previews (D9)", () => {
  for (const slot of [1, 2, 3, 4, 7]) {
    for (const [condition, choices] of Object.entries(CONDITIONS)) {
      const id = `preview-slot-${slot}-${condition}`;
      if (PREVIEW_GAPS.has(id)) continue;
      it(
        id,
        () => {
          // the list opens on the entry above the slot's, so ▼ arms the slot's preview
          const storage = ringingStorage([slot], { ...choices, [TONE]: entryOf(slot) - 1 });
          expectPreview(id, rigOver(storage), "navi 5 1 wait:1500");
        },
        60_000,
      );
    }
  }

  for (const [n, profile] of [
    [1, "general"],
    [2, "silent"],
  ] as const) {
    it(`preview-${profile}-slot-3 (a Personalise list)`, () => {
      const prefix = `profiles/${profile}/personalise`;
      const rig = rigOver(ringingStorage(ALL, { [`${prefix}/ringing-tone`]: entryOf(3) - 1 }));
      open(rig, `12-${n}-2-1`);
      rig.advance(1500);
      expectPreview(`preview-${profile}-slot-3`, rig, "");
    }, 60_000);
  }

  for (const level of [1, 2, 3, 4, 5]) {
    if (PREVIEW_GAPS.has(`preview-volume-${level}`)) continue;
    it(`preview-volume-${level} (the Ringing volume list plays the stored saved tone)`, () => {
      const golden = loadSoundGolden(`sound/composer/preview-volume-${level}`);
      const up = golden.keys?.[0]?.key === "up";
      const from = up ? level : level - 2;
      const rig = rigOver(ringingStorage(ALL, { [TONE]: entryOf(3), [VOLUME]: from }));
      expectPreview(`preview-volume-${level}`, rig, "navi 5 2 wait:1500");
    }, 60_000);
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
