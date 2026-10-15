// Plan 27's scenarios (Tasks 9-12): every Composer golden replayed on the stock phone. Stills
// replay their Task 0 case (`COMPOSER_CASES`), timelines their recording's keys
// (`COMPOSER_RECORDING_KEYS`), sound goldens their recording (`composerSound`); the saved-tone
// states (`ringing-*`, `persist`, `restore`) are the captures' (`gen_v639_plan27.py`).
import type { PhoneKey } from "@hellotimber/phone-core";
import {
  COMPOSER_CASES,
  COMPOSER_RECORDING_KEYS,
  composerTimelineId,
  lcdRecording,
  OPEN_COMPOSER,
  stillFixtureOf,
  type ComposerCase,
} from "../../scripts/capture-sets/27-composer.ts";
import { findGoldenImage, LCD_WIDTH, type Golden } from "../../scripts/golden-format.ts";
import { EMPTY_COMPOSER } from "../../src/composer/editor";
import { COMPOSER_RINGING_INDEX, StockComposer } from "../../src/composer/store";
import { COMPOSER_TIMINGS } from "../../src/resources";
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import { recordTimeline } from "./acceptance.ts";
import {
  composerCase,
  composerRig,
  composerStill,
  playComposer,
  recordingChoices,
  replayComposerKeys,
  setupKeys,
  type StillChain,
} from "./composer.ts";
import { open } from "./drive.ts";
import { expectLcd, expectTimeline, PROBE_TOLERANCE_MS } from "./golden.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { keys } from "./probes.ts";
import { seededStorage, standbyRig, type Rig } from "./rig.ts";
import { soundStorage } from "./sound-scenarios.ts";
import { expectSoundTimeline, loadSoundGolden, playSound } from "./sound.ts";

// ---------------------------------------------------------------- saved tones (ringing-*)

/** The captures' saved tones by slot: name, keys from the empty editor, tempo (`TONES`). */
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
/** `ringing-all`'s slots. */
export const RINGING_ALL = [1, 2, 3, 7] as const;

const TONE = "tones/ringing-tone";
const VOLUME = "tones/ringing-volume";
const ALERT = "tones/incoming-call-alert";
const VIBRA = "tones/vibrating-alert";
/** Nokia tune, the factory ringing tone (its option index). */
const NOKIA_TUNE = 12;

/** The option index of slot k's Ringing tone entry (`5-1-36` is slot 1). */
export const entryOf = (slot: number): number => COMPOSER_RINGING_INDEX + slot - 1;

/** Factory storage with `slots` saved (as the captures saved them) and `choices` set. */
export function ringingStorage(
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
export function ringingRig(storage: StockStorage): Rig {
  const rig = standbyRig({ storage });
  rig.press("c", 1500);
  rig.advance(1000);
  return rig;
}

/** Compares the LCD with still `name` (`<dir>/<image>`). */
export function expectStill(rig: Rig, name: string): void {
  const { id, image } = stillFixtureOf(name);
  expectLcd(rig.paint(), goldenImage(id, image), name);
}

/** The Ringing tone list opened on Nokia tune and moved to option 33, then `n` ▼. */
function ringingList(rig: Rig, list: "tones" | "general" | "silent", n: number): void {
  if (list === "tones") keys(rig, "navi 5 1");
  else open(rig, `12-${list === "general" ? 1 : 2}-2-1`);
  rig.advance(1500);
  keys(rig, `down*${33 - NOKIA_TUNE + n}`);
}

/** Slot 3's entry chosen in Tones › Ringing tone (`choose 5-1 38`): `Done`, then the page. */
function chooseSlot3(rig: Rig): void {
  keys(rig, `navi 5 1 wait:1500 down*${entryOf(3) - NOKIA_TUNE} navi wait:4000`);
}

/** A `ringing/*` still (the `ringing-all` state). */
function ringingStill(c: ComposerCase): void {
  const rig = ringingRig(
    c.name === "ringing/overwritten-open"
      ? overwritten()
      : ringingStorage(RINGING_ALL, c.name === "ringing/stored-open" ? { [TONE]: entryOf(3) } : {}),
  );
  const list = /^ringing\/(tones|general|silent)\/(\d+)$/.exec(c.name);
  if (list !== null) {
    ringingList(rig, list[1] as "tones" | "general" | "silent", Number(list[2]));
  } else if (c.name === "ringing/page") {
    chooseSlot3(rig);
  } else if (c.name === "ringing/page-tones") {
    chooseSlot3(rig);
    keys(rig, "c~1500 wait:1000 navi wait:400 5 wait:4500");
  } else {
    // the list opening on the stored saved tone (`menu 5 1`)
    keys(rig, "navi 5 1 wait:1500");
  }
  expectStill(rig, c.name);
}

/** `ringing-all` with slot 3 the stored tone, then overwritten by `Cd` (`5 5` at its 40 BPM). */
function overwritten(): StockStorage {
  const storage = ringingStorage(RINGING_ALL, { [TONE]: entryOf(3) });
  const tokens = replayComposerKeys(EMPTY_COMPOSER, "5 5").state.tokens;
  new StockComposer(new StockEeprom(storage)).save(3, { name: "Cd", tempo: 40, tokens });
  return storage;
}

// ---------------------------------------------------------------- persist and restore (M, K13)

/** `<group>/before-slots`' tones saved through the phone over `storage`, at the slot list. */
function saveTones(storage: StockStorage, group: "persist" | "restore"): Rig {
  const before = composerCase(`${group}/before-slots`);
  const rig = composerRig(before.state, storage);
  playComposer(rig, OPEN_COMPOSER);
  playComposer(rig, before.keys);
  return rig;
}

/**
 * Slot 2's entry (`B`) chosen in Tones › Ringing tone from standby, back to standby. The list
 * opens on `opening`; unset (virgin), on no option: the first ▼ highlights the first.
 */
function chooseSlot2(rig: Rig, opening: number | null): void {
  playComposer(rig, "c@1500 +1000");
  const downs = opening === null ? entryOf(2) + 1 : entryOf(2) - opening;
  keys(rig, `navi 5 1 wait:1500 down*${downs} navi wait:4000`);
  playComposer(rig, "c@1500 +1000");
}

/** The Tones page from standby (`tones_page`: Menu, 400 ms, 5, 4500 ms). */
const TONES_PAGE = "menu +400 5 +4500";

/** A `persist/*` still: the tones saved, slot 2 the ringing tone, a cold boot, then the case. */
function persistStill(c: ComposerCase): void {
  const storage = seededStorage({ factory: true });
  const first = saveTones(storage, "persist");
  if (c.name === "persist/before-slots") return expectStill(first, c.name);
  chooseSlot2(first, NOKIA_TUNE);
  // a second phone over the same storage: the cold boot
  const rig = composerRig("factory", storage);
  if (c.from === "standby") playComposer(rig, TONES_PAGE);
  else {
    playComposer(rig, OPEN_COMPOSER);
    playComposer(rig, c.keys);
  }
  expectStill(rig, c.name);
}

/** Menu 6 4, the security code, OK, then standby (the capture's `key menu 6 4` is faster). */
const RESTORE = "menu 6 4 +4000 1 2 3 4 5 menu +6000 c@1500 +1000";

/** A `restore/*` still: the tones saved and slot 2 chosen, Restore factory settings, the case. */
function restoreStill(c: ComposerCase): void {
  const rig = saveTones(createMemoryStorage(), "restore");
  if (c.name === "restore/before-slots") return expectStill(rig, c.name);
  chooseSlot2(rig, null);
  if (c.name === "restore/before-page") {
    playComposer(rig, TONES_PAGE);
    return expectStill(rig, c.name);
  }
  playComposer(rig, RESTORE);
  if (c.from === "standby") playComposer(rig, TONES_PAGE);
  else {
    playComposer(rig, OPEN_COMPOSER);
    playComposer(rig, c.keys);
  }
  expectStill(rig, c.name);
}

/** Any Task 0 case's still. */
export function caseStill(c: ComposerCase, chain?: StillChain): void {
  if (c.name.startsWith("ringing/")) return ringingStill(c);
  if (c.name.startsWith("persist/")) return persistStill(c);
  if (c.name.startsWith("restore/")) return restoreStill(c);
  composerStill(c, chain);
}

// ---------------------------------------------------------------- still fixtures

/**
 * Images nokia-os does not reproduce, by case: why. Their fixture's scenario expects each to
 * fail and every other image to pass.
 */
export const COMPOSER_IMAGE_GAPS: Readonly<Record<string, string>> = {
  "save/keys/fifteen":
    "a name wider than the large face is drawn small on two lines; plan 18's prompt draws large",
  "save/keys/sixteen":
    "a name wider than the large face is drawn small on two lines; plan 18's prompt draws large",
  "save/keys/prefilled-edit":
    "the prompt's cursor phase after C and a key on a prefilled name (no blink rule found)",
  "open/saved-save": "the prompt's cursor phase on a reopened saved slot (no blink rule found)",
  "leave/saved-cleared-reopen":
    "the editor's cursor phase on a reopen after a Save (no blink rule found)",
  "leave/saved-exit-edited":
    "the editor's cursor phase on a reopen after a Save (no blink rule found)",
  "restore/slot-1": "the editor's cursor phase on a reopen after a Save (no blink rule found)",
};

/** Still fixture `id`'s images: every case of its directory, gaps expected to fail. */
export function stillFixtureScenario(id: string): void {
  const cases = COMPOSER_CASES.filter((c) => stillFixtureOf(c.name).id === id);
  if (cases.length === 0) throw new Error(`No composer case for ${id}.`);
  const failures: string[] = [];
  // a case extending the previous one's keys continues its phone (composerStill)
  const chain: StillChain = {};
  for (const c of cases) {
    const gap = COMPOSER_IMAGE_GAPS[c.name];
    try {
      caseStill(c, chain);
      if (gap !== undefined) failures.push(`${c.name} passes: drop its gap (${gap})`);
    } catch (error) {
      if (gap === undefined) failures.push(String(error instanceof Error ? error.message : error));
    }
  }
  if (failures.length > 0) throw new Error(failures.join("\n\n"));
}

// ---------------------------------------------------------------- timelines

interface ScheduledKey {
  readonly atMs: number;
  readonly key: PhoneKey;
  readonly holdMs: number;
}

/**
 * A recording's keys as raw edges (`rec_keys`): a tap is 60 ms down and 240 ms more, `k@ms`
 * holds then 50 ms (the harness) and 250 ms, `+ms` waits.
 */
export function recordingKeys(script: string): ScheduledKey[] {
  const out: ScheduledKey[] = [];
  let t = 0;
  // `c at 1100`: a tap at that time from the first key (C over a held note, `hold/c-*`)
  const at = [...script.matchAll(/(\S+) at (\d+)/g)];
  for (const [, name, ms] of at) {
    out.push({ atMs: Number(ms), key: (name === "menu" ? "navi" : name) as PhoneKey, holdMs: 60 });
  }
  const rest = script.replace(/(\S+) at (\d+)/g, "");
  for (const token of rest.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("+")) {
      t += Number(token.slice(1));
      continue;
    }
    const held = /^(.+)@(\d+)$/.exec(token);
    const name = held ? held[1]! : token;
    const key = (name === "menu" ? "navi" : name) as PhoneKey;
    const holdMs = held ? Number(held[2]) : 60;
    out.push({ atMs: t, key, holdMs });
    t += held ? holdMs + 300 : 300;
  }
  return out.sort((a, b) => a.atMs - b.atMs);
}

/** Records `keys` from `rig` and compares with timeline golden `id` (frame 1 = the first key). */
function expectRecording(id: string, rig: Rig, script: string, context: string): void {
  const golden = loadGolden(id);
  const [first, ...later] = recordingKeys(script);
  if (first === undefined) throw new Error(`${id}: no keys to record.`);
  const schedule = [
    { atMs: first.holdMs, run: () => rig.release(first.key) },
    ...later.flatMap((k) => [
      { atMs: k.atMs, run: () => rig.hold(k.key) },
      { atMs: k.atMs + k.holdMs, run: () => rig.release(k.key) },
    ]),
  ];
  const rows = golden.timeline!;
  const t = golden.triggerFrame as number;
  const last = rows[rows.length - 1]!;
  const span = last.startMs + last.durationMs - rows[t]!.startMs + 100;
  alignBlink(rig, golden);
  const recorded = rig.record(span, () => rig.hold(first.key), schedule);
  // The capture's frame 1 is its first change (the import's alignment): the key's effect, or a
  // key acting on its release (lists, Select on a slot), or the blink when the key changed
  // nothing visible. The recording aligns on its own first change in those two cases.
  const firstChange = recorded.frames[1]?.startMs;
  const invisible = cursorToggle(
    findGoldenImage(golden, rows[t - 1]!.image).pixels,
    findGoldenImage(golden, rows[t]!.image).pixels,
  );
  // the first change that is not the blink's
  const content = recorded.frames.find(
    (frame, i) => i > 0 && !cursorToggle(recorded.frames[i - 1]!.pixels, frame.pixels),
  )?.startMs;
  const onRelease = content === recorded.triggerMs + first.holdMs;
  const triggerMs = invisible ? firstChange : onRelease ? content : undefined;
  const recording = triggerMs === undefined ? recorded : { ...recorded, triggerMs };
  expectTimeline(recording, golden, `${id}: ${context}, then ${script}`, {
    toleranceMs: PROBE_TOLERANCE_MS,
  });
}

/** Whether `b` differs from `a` in one column only (a cursor's toggle). */
function cursorToggle(a: Uint8Array, b: Uint8Array): boolean {
  const columns = new Set<number>();
  for (let p = 0; p < a.length; p++) if (a[p] !== b[p]) columns.add(p % LCD_WIDTH);
  return columns.size === 1;
}

const ink = (pixels: Uint8Array): number => pixels.reduce((sum, p) => sum + p, 0);

/**
 * Waits until the phone's cursor blink stands where the capture's stood at its trigger: the
 * golden's first cursor toggle after frame 1 comes as long after the key, in the same direction.
 * The blink runs free (Task 0), and the replay's taps reach it at their own phase; the capture
 * pressed the key wherever its blink stood. Nothing to align without a cursor in the golden.
 */
function alignBlink(rig: Rig, golden: Golden): void {
  const rows = golden.timeline!;
  const t = golden.triggerFrame as number;
  let j = t;
  for (; j < rows.length; j++) {
    const a = findGoldenImage(golden, rows[j - 1]!.image).pixels;
    const b = findGoldenImage(golden, rows[j]!.image).pixels;
    if (cursorToggle(a, b)) break;
  }
  if (j >= rows.length) return;
  // frame 1 itself a toggle: the key changed nothing visible, so the toggle comes just after it
  const afterKey = j === t ? 1 : rows[j]!.startMs - rows[t]!.startMs;
  const shows =
    ink(findGoldenImage(golden, rows[j]!.image).pixels) >
    ink(findGoldenImage(golden, rows[j - 1]!.image).pixels);
  // the phone's next toggle, and its direction
  let before = rig.paint().pixels;
  let toggledAt: number | undefined;
  let shown = false;
  for (let waited = 0; waited < 2 * COMPOSER_TIMINGS.blinkStepMs; waited++) {
    rig.advance(1);
    const now = rig.paint().pixels;
    if (now !== before && cursorToggle(before, now)) {
      toggledAt = rig.now;
      shown = ink(now) > ink(before);
      break;
    }
    before = now;
  }
  if (toggledAt === undefined) return;
  const step = COMPOSER_TIMINGS.blinkStepMs;
  // toggle k after the observed one shows the cursor when (k even) === shown
  for (let k = 1; k < 10; k++) {
    if ((k % 2 === 0) !== (shows === shown)) continue;
    const key = toggledAt + k * step - afterKey;
    if (key >= rig.now) {
      rig.advance(Math.round(key - rig.now));
      return;
    }
  }
}

/** Timeline `id` from its recording row: the state, settings, setup, `before`, then its keys. */
export function timelineScenario(id: string): void {
  const r = COMPOSER_RECORDING_KEYS.find((row) => composerTimelineId(row.dir) === id);
  if (r === undefined || !lcdRecording(r.dir)) throw new Error(`No composer recording for ${id}.`);
  const storage = soundStorage(
    r.state === "factory" ? "factory" : "virgin",
    recordingChoices(r.dir),
  );
  const rig = composerRig(r.state, storage);
  playComposer(rig, setupKeys(r));
  playComposer(rig, r.before);
  expectRecording(id, rig, r.keys, `${r.setup ?? r.from}, ${r.before || "-"}`);
}

/** `composer/ringing-choose`: OK on slot 3's entry of Tones › Ringing tone. */
export function ringingChooseScenario(id: string): void {
  const rig = ringingRig(ringingStorage(RINGING_ALL));
  keys(rig, `navi 5 1 wait:1500 down*${entryOf(3) - NOKIA_TUNE}`);
  const golden = loadGolden(id);
  const recording = recordTimeline(rig, golden, () => rig.press("navi"));
  expectTimeline(recording, golden, "ringing/choose", { toleranceMs: PROBE_TOLERANCE_MS });
}

/** `composer/restore-run`: OK on Restore factory settings' code with two tones saved. */
export function restoreRunScenario(id: string): void {
  const rig = saveTones(createMemoryStorage(), "restore");
  chooseSlot2(rig, null);
  playComposer(rig, "menu 6 4 +4000 1 2 3 4 5");
  expectRecording(id, rig, "menu", "two tones saved, Menu 6 4, 12345");
}

// ---------------------------------------------------------------- previews (D9)

/** Each slot's preview conditions: settings written before the list opens. */
const PREVIEW_CONDITIONS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
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

/** Sound golden `id`'s keys on `rig` (after `setup`), compared as a later recording. */
function expectPreview(id: string, rig: Rig, setup: string): void {
  const golden = loadSoundGolden(id);
  if (setup !== "") keys(rig, setup);
  const recorded = playSound(rig, golden);
  expectSoundTimeline(recorded, golden, `${id}: ${setup}, then ${golden.note ?? ""}`, {
    drift: true,
  });
}

/** A `sound/composer/preview-*` golden. */
export function previewScenario(id: string): void {
  const slot = /^sound\/composer\/preview-slot-(\d)-(.+)$/.exec(id);
  if (slot !== null) {
    const k = Number(slot[1]);
    const choices = PREVIEW_CONDITIONS[slot[2]!];
    if (choices === undefined) throw new Error(`No preview condition for ${id}.`);
    // the list opens on the entry above the slot's, so ▼ arms the slot's preview
    const rig = ringingRig(ringingStorage([k], { ...choices, [TONE]: entryOf(k) - 1 }));
    return expectPreview(id, rig, "navi 5 1 wait:1500");
  }
  const profile = /^sound\/composer\/preview-(general|silent)-slot-3$/.exec(id)?.[1];
  if (profile !== undefined) {
    const prefix = `profiles/${profile}/personalise`;
    const rig = ringingRig(
      ringingStorage(RINGING_ALL, { [`${prefix}/ringing-tone`]: entryOf(3) - 1 }),
    );
    open(rig, `12-${profile === "general" ? 1 : 2}-2-1`);
    rig.advance(1500);
    return expectPreview(id, rig, "");
  }
  const level = /^sound\/composer\/preview-volume-(\d)$/.exec(id)?.[1];
  if (level !== undefined) {
    const golden = loadSoundGolden(id);
    const from = golden.keys?.[0]?.key === "up" ? Number(level) : Number(level) - 2;
    const rig = ringingRig(ringingStorage(RINGING_ALL, { [TONE]: entryOf(3), [VOLUME]: from }));
    return expectPreview(id, rig, "navi 5 2 wait:1500");
  }
  if (id === "sound/composer/preview-overwritten") {
    // the Ringing volume list on Level 3, ▼ to Level 4: slot 3 overwritten by `Cd`
    const storage = overwritten();
    createStockSettings(new StockEeprom(storage)).choose(VOLUME, 2);
    return expectPreview(id, ringingRig(storage), "navi 5 2 wait:1500");
  }
  throw new Error(`No preview scenario for ${id}.`);
}

/**
 * Previews nokia-os does not reproduce, by id: why. Level 5's jump and Ascending's steps of the
 * tones long enough to reach them follow a free-running timer (D9: nokia-os steps every
 * `levelStepMs` from the start); at 225 BPM a preview holds each quarter 33 timer units where Play
 * holds 32 (slot 4, the one 225 BPM tone captured).
 */
export const PREVIEW_GAPS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    [2, 3, 7].flatMap((slot) => [
      [
        `sound/composer/preview-slot-${slot}-level-5`,
        "Level 5's jump follows a free-running timer",
      ],
      [
        `sound/composer/preview-slot-${slot}-ascending`,
        "Ascending's steps follow a free-running timer",
      ],
    ]),
  ),
  ...Object.fromEntries(
    [
      "level-1",
      "level-2",
      "level-3",
      "level-4",
      "level-5",
      "ascending",
      "ring-once",
      "vibrator-off",
    ].map((condition) => [
      `sound/composer/preview-slot-4-${condition}`,
      "at 225 BPM a preview's quarter is 33 timer units, Play's 32 (one tone captured)",
    ]),
  ),
  "sound/composer/preview-volume-5": "Level 5's jump follows a free-running timer",
  "sound/composer/preview-overwritten":
    "with a two-note tone the Ringing volume list's vibrator stays on 1.9 s past the tone's end " +
    "in the capture; D9's vibrator track ends with the tone",
};
