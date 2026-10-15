// Plan 27 Task 8: the Composer on the stock phone: the editor's keys on key-down, holds, the
// blink, Options, Tempo, Clear screen, Exit, Play, the silenced keys and the slots' labels. The
// stills replay Task 0's cases (COMPOSER_CASES) from a settled standby.
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { COMPOSER_CASES } from "../scripts/capture-sets/27-composer.ts";
import { EMPTY_COMPOSER } from "../src/composer/editor";
import { parseTokens } from "../src/composer/notation";
import { StockComposer } from "../src/composer/store";
import { paintWidget } from "../src/display/widgets";
import { StockEeprom } from "../src/firmware/eeprom";
import { COMPOSER_TIMINGS } from "../src/resources";
import {
  composerModel,
  composerRig,
  composerStill,
  playComposer,
  replayComposerView,
  setupKeys,
} from "./support/composer";
import { seededStorage, type Rig } from "./support/rig.ts";

/** Slot 1's editor on a factory phone. */
function editor(): Rig {
  const rig = composerRig("factory");
  playComposer(rig, setupKeys({ from: "editor", slot: 1 }));
  return rig;
}

/** Whether the LCD shows the editor with `keys`' tokens (either cursor phase). */
function shows(rig: Rig, keys: string): boolean {
  const { state, top } = replayComposerView(EMPTY_COMPOSER, keys);
  const lcd = rig.paint().pixels;
  return [true, false].some((cursor) => {
    const fb = new Framebuffer();
    const model = composerModel(state, top);
    paintWidget(fb, cursor ? model : { ...model, cursor: null });
    return fb.pixels.every((p, i) => p === lcd[i]);
  });
}

/** The tone generator's 900 Hz key beeps the rig heard since `from`. */
const beeps = (rig: Rig, from: number) =>
  rig.sounds.filter((e) => e.atMs >= from && e.output === "tone" && e.hz === 900);

const STILLS = COMPOSER_CASES.filter((c) =>
  /^(entry\/(note|shorter|sharp|held|dotted|insert|delete)|returns\/(options|tempo|play)|leave\/(exit|options|clear)|options|tempo|newtempo\/(virgin|after-set))/.test(
    c.name,
  ),
);

describe("Task 0's editor, Options and Tempo stills on the phone", () => {
  it("covers every still group of Task 8", () => expect(STILLS.length).toBeGreaterThan(100));
  for (const c of STILLS) it(c.name, () => composerStill(c), 30_000);
});

describe("the Composer on the phone", () => {
  it("acts on key-down: a note shows before its key comes up", () => {
    const rig = editor();
    rig.phone.send({ type: "down", key: "1" });
    rig.advance(10);
    expect(shows(rig, "1")).toBe(true);
    rig.phone.send({ type: "up", key: "1" });
  });

  it("dots a held note key at its hold time, not before; C held clears", () => {
    const rig = editor();
    rig.press("3", COMPOSER_TIMINGS.dotMs - 20);
    rig.advance(300);
    expect(shows(rig, "3")).toBe(true);
    rig.press("3", COMPOSER_TIMINGS.dotMs + 20);
    rig.advance(300);
    expect(shows(rig, "3 3@1500")).toBe(true);
    rig.press("c", COMPOSER_TIMINGS.clearMs + 20);
    rig.advance(300);
    expect(shows(rig, "")).toBe(true);
  });

  it("beeps no editor key, not even C's long press; Options' keys beep", () => {
    const rig = editor();
    const from = rig.now;
    playComposer(rig, "1 2 8 9 * # 0 up down c c@1500");
    expect(beeps(rig, from)).toEqual([]);
    playComposer(rig, "1 menu");
    const options = rig.now;
    playComposer(rig, "down up c");
    expect(beeps(rig, options)).toHaveLength(3);
  });

  it("sounds an entered note on the buzzer for its time at the tone's tempo", () => {
    const rig = editor();
    const from = rig.now;
    playComposer(rig, "1");
    const notes = rig.sounds.filter((e) => e.atMs >= from && e.output === "buzzer");
    expect(notes[0]).toMatchObject({ hz: 523 });
    expect(notes[1]!.atMs - notes[0]!.atMs).toBeGreaterThan(490);
  });

  it("leaves an empty editor with Back or C for the Tones page", () => {
    for (const key of ["navi", "c"] as const) {
      const rig = editor();
      rig.press(key, 42);
      rig.advance(500);
      expect(rig.phone.path).toBe("menu/tones");
    }
  });

  it("plays the tone with Stop; Stop ends it at once", () => {
    const rig = editor();
    playComposer(rig, "1 2 3 menu");
    const from = rig.now;
    playComposer(rig, "menu~42 +600");
    const played = rig.sounds.filter((e) => e.atMs >= from && e.output === "buzzer");
    expect(played.map((e) => (e.output === "buzzer" ? e.hz : 0))).toEqual([523, null, 587]);
    const stop = rig.now;
    playComposer(rig, "menu");
    const after = rig.sounds.filter((e) => e.output === "buzzer").at(-1)!;
    expect(after).toMatchObject({ hz: null, atMs: stop });
  });

  it("names the slots after their saved tones (the level's label seam)", () => {
    const storage = seededStorage({ factory: true });
    new StockComposer(new StockEeprom(storage)).save(2, {
      name: "Tune",
      tempo: 112,
      tokens: parseTokens("4c1"),
    });
    const rig = composerRig("factory", storage);
    playComposer(rig, setupKeys({ from: "slots" }));
    const screen = rig.phone.screen;
    expect(screen.kind === "list" ? screen.items : []).toEqual([
      "(empty)",
      "Tune",
      "(empty)",
      "(empty)",
      "(empty)",
      "(empty)",
      "(empty)",
    ]);
    playComposer(rig, "down menu~60 +1440");
    expect(shows(rig, "1")).toBe(true);
  });
});
