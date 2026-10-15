// Plan 27 Task 2: the Composer's capture set on synthetic sources (no REF).
import { describe, expect, it } from "vite-plus/test";
import { shotImages, type CaptureSetEntry } from "../scripts/capture-set.ts";
import {
  composer,
  COMPOSER_CASES,
  COMPOSER_RECORDING_KEYS,
  COMPOSER_SOUNDS,
  ComposerCaptureError,
  composerLcd,
  composerSoundId,
  composerSounds,
  composerStills,
  composerTimelineId,
  stillFixtureOf,
} from "../scripts/capture-sets/27-composer.ts";
import { EVENTS_HEADER, KEYS_HEADER, type SoundCaptureIo } from "../scripts/sound-capture-set.ts";

const byId = (entries: readonly CaptureSetEntry[]) =>
  new Map(entries.map((entry) => [entry.id, entry] as const));

/** The plan's "Golden pipeline additions" LCD rows, as the fixture ids they became. */
const PIPELINE_LCD = [
  "composer/slots-virgin",
  "composer/slots-factory",
  "composer/slots-named",
  "composer/open-slot-1",
  "composer/open-saved",
  "composer/entry",
  "composer/hold-note-3-750",
  "composer/hold-note-3-800",
  "composer/cursor-up",
  "composer/cursor-down",
  "composer/layout",
  "composer/hold-c-500",
  "composer/limit",
  "composer/leave-back",
  "composer/leave-c",
  "composer/leave-exit",
  "composer/leave-clear-back",
  "composer/options-list",
  "composer/tempo-from-112",
  "composer/tempo-done-40",
  "composer/play-short",
  "composer/play-c",
  "composer/play-stop",
  "composer/play-up",
  "composer/play-note",
  "composer/save-open",
  "composer/save-ok",
  "composer/save-keys",
  "composer/send-name",
  "composer/send-number",
  "composer/send-number-c",
  "composer/send-ok",
  "composer/ringing-tones",
  "composer/ringing-general",
  "composer/persist",
  "composer/restore",
];

describe("composer capture set", () => {
  const lcd = byId(composerLcd());

  it("lists every LCD row of the golden pipeline table, pending until its scenario", () => {
    for (const id of PIPELINE_LCD) expect(lcd.has(id), id).toBe(true);
    for (const entry of lcd.values()) {
      expect(entry.status, entry.id).toBe(
        entry.id === "composer/send-ok" ? "pending:18c" : "pending:27",
      );
    }
    expect(composer.plan).toBe("27");
  });

  it("names every still by its case, in case order, one fixture per capture directory", () => {
    const entry = lcd.get("composer/entry")!;
    const files = entry.prefer.source.kind === "shots" ? entry.prefer.source.files : [];
    const cases = COMPOSER_CASES.filter((c) => stillFixtureOf(c.name).id === "composer/entry");
    expect(files).toEqual(cases.map((c) => `plan27/${c.name}.png`));
    expect(files[0]).toBe("plan27/entry/empty.png");
    expect(stillFixtureOf("cursor/up/07")).toEqual({ id: "composer/cursor-up", image: "07" });
    const all = [...lcd.values()].flatMap((s) =>
      s.prefer.source.kind === "shots" ? shotImages(s.prefer.source.files) : [],
    );
    expect(all).toHaveLength(COMPOSER_CASES.length);
    expect(COMPOSER_CASES).toHaveLength(418);
  });

  it("throws naming both sides for a case without its image or an image without a case", () => {
    const cases = [{ name: "slots/virgin/00", from: "slots", state: "virgin", keys: "" }] as const;
    expect(() => composerStills(cases, () => ["00", "01"])).toThrow(
      /plan27\/slots\/virgin\/01\.png has no case/,
    );
    const two = [...cases, { ...cases[0], name: "slots/virgin/01" }];
    expect(() => composerStills(two, () => ["00"])).toThrow(/slots\/virgin\/01 has no image/);
    expect(() => composerStills([...cases, ...cases])).toThrow(ComposerCaptureError);
  });

  it("names timelines and sound goldens after their recordings", () => {
    expect(composerTimelineId("hold/note-3-800")).toBe("composer/hold-note-3-800");
    expect(composerSoundId("sound/tempo/112")).toBe("sound/composer/tempo-112");
    expect(composerSoundId("play/short")).toBe("sound/composer/play-short");
    const sounds = new Set(COMPOSER_SOUNDS.map((s) => s.id));
    for (const bpm of [40, 45, 50, 56, 63, 70, 80, 90, 100, 112, 125, 140, 160, 180, 200, 225]) {
      expect(sounds.has(`sound/composer/tempo-${bpm}`), String(bpm)).toBe(true);
    }
    for (const level of [1, 2, 3, 4, 5]) {
      expect(sounds.has(`sound/composer/pitch-level-${level}`)).toBe(true);
      expect(sounds.has(`sound/composer/preview-volume-${level}`)).toBe(true);
    }
    expect(sounds.has("sound/composer/pitch-virgin")).toBe(true);
    expect(COMPOSER_SOUNDS.find((s) => s.id === "sound/composer/pitch-virgin")!.state).toBe(
      "virgin",
    );
    // a key held on other keys than 3 below 1500 ms is not imported (it repeats key 3's)
    expect(sounds.has("sound/composer/hold-note-5-800")).toBe(false);
    expect(sounds.has("sound/composer/hold-note-5-1500")).toBe(true);
    expect(COMPOSER_RECORDING_KEYS.length).toBeGreaterThan(200);
  });

  it("builds sound goldens with plan 16's normalisation, aligned on the first key", () => {
    const io: SoundCaptureIo = {
      events: () =>
        [
          EVENTS_HEADER,
          "1.0,0,0,0,0.0,0,11,0x900F",
          "23.0,0,0,1,523.0,0,11,0x900F",
          "526.0,0,0,0,0.0,0,11,0x900F",
        ].join("\n"),
      keys: () => [KEYS_HEADER, "1,0.0,60.0"].join("\n"),
      sha256: () => "0".repeat(64),
      list: () => [],
    };
    const golden = composerSounds(io).find((g) => g.id === "sound/composer/entry-note")!;
    expect(golden.state).toBe("factory");
    expect(golden.status).toBe("pending:27");
    expect(golden.rows.map((r) => [r.ms, r.output])).toEqual([
      [23, "buzzer"],
      [526, "buzzer"],
    ]);
  });
});
