// Plan 17 Task 2: the profiles capture set on synthetic recordings (no REF).
import { describe, expect, it } from "vite-plus/test";
import { shotImages, type CaptureSetEntry } from "../../scripts/capture-set.ts";
import {
  ASSERTED_TASKS,
  profiles,
  profilesLcd,
  profilesSounds,
  ProfilesCaptureError,
  SOUNDS,
  STILLS,
  THIN_GLYPH_PAGES,
  TIMELINES,
} from "../../scripts/capture-sets/17-profiles.ts";
import { captureSets } from "../../scripts/capture-registry.ts";
import { parseManifestNote } from "../../scripts/messages-capture-set.ts";
import {
  EVENTS_HEADER,
  KEYS_HEADER,
  type SoundCaptureIo,
} from "../../scripts/sound-capture-set.ts";
import type { RecordingFrame, TreeCaptureIo } from "../../scripts/tree-capture-set.ts";
import { TYPEABLE } from "../../src/text/keys";

/** A recording of `images` (one frame each, 100 ms apart). */
const recording = (...images: string[]): RecordingFrame[] =>
  images.map((image, i) => ({ image, startMs: 1 + 100 * i, durationMs: 100 }));

/** Every recording: the screen before, then the key's change, then six more frames. */
const EIGHT = ["before", "after", "b", "c", "d", "e", "f", "g"];
function frames(overrides: Readonly<Record<string, RecordingFrame[]>> = {}): TreeCaptureIo {
  return {
    recording: (dir) => overrides[dir] ?? recording(...EIGHT),
    scrollImages: () => [],
  };
}

const byId = (entries: readonly CaptureSetEntry[]) =>
  new Map(entries.map((entry) => [entry.id, entry] as const));

describe("profiles capture set", () => {
  it("registers as plan 17", () => {
    const sets = captureSets();
    expect(sets.some((set) => set.plan === "17" && set === profiles)).toBe(true);
  });

  it("lists every LCD row of the golden pipeline table, each id once", () => {
    const entries = profilesLcd(frames());
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      "profiles/activate-silent",
      "profiles/activate-general-from-loud",
      "profiles/standby-menu",
      "profiles/icon",
      "profiles/tones-silent",
      "profiles/power-general-list",
      "profiles/power-silent-digit-3",
      "profiles/rename-open-12-6",
      "profiles/rename-loud-ok",
      "profiles/persist-after-boot",
      "profiles/restore",
      "profiles/glyphs-thin",
    ]) {
      expect(ids, id).toContain(id);
    }
    expect(entries.every((e) => e.id.startsWith("profiles/"))).toBe(true);
  });

  it("is pending:17 until its task's scenarios exist", () => {
    const rows = new Map([...TIMELINES, ...STILLS].map((row) => [row.id, row.task] as const));
    for (const entry of profilesLcd(frames())) {
      const asserted = ASSERTED_TASKS.has(rows.get(entry.id)!);
      expect(entry.status, entry.id).toBe(asserted ? "asserted" : "pending:17");
    }
  });

  it("aligns a timeline on its first changed frame, or as its row says", () => {
    const lcd = byId(
      profilesLcd(
        frames({
          "plan17/power/general/digit-0": recording("list", "list", "invalid", "standby"),
          "plan17/activate/silent": recording("level", "level", "note", "a", "b", "c", "d", "e"),
        }),
      ),
    );
    expect(lcd.get("profiles/activate-silent")!.prefer.triggerFrame).toBe(2);
    expect(lcd.get("profiles/power-general-list")!.prefer.triggerFrame).toBe(1);
    // The window's Invalid shortcut comes 2.98 s after 0: the key changes nothing at once.
    expect(lcd.get("profiles/power-general-digit-0")!.prefer.triggerFrame).toBe(0);
    expect(lcd.get("profiles/power-general-digit-star")!.prefer.triggerFrame).toBe(0);
  });

  it("cuts Discreet's artefact and Menu's C from their recordings, naming why", () => {
    const lcd = byId(profilesLcd(frames()));
    const discreet = lcd.get("profiles/activate-discreet")!.prefer;
    expect(discreet.source).toEqual({
      kind: "composite",
      parts: [{ dir: "plan17/activate/discreet", from: 0, to: 6 }],
    });
    expect(Object.values(discreet.omitted ?? {})[0]).toMatch(/screen saver/);
    expect(lcd.get("profiles/standby-menu")!.prefer.source).toMatchObject({
      parts: [{ dir: "plan17/standby/menu-c", to: 4 }],
    });
  });

  it("fails clearly on a missing recording or nothing left to omit", () => {
    const missing: TreeCaptureIo = { recording: () => undefined, scrollImages: () => [] };
    expect(() => profilesLcd(missing)).toThrow(ProfilesCaptureError);
    expect(() =>
      profilesLcd(frames({ "plan17/activate/discreet": recording("a", "b", "c") })),
    ).toThrow(/no frame after 6/);
  });

  it("names every still image validly, and the thin glyph sheet carries its manifest", () => {
    for (const row of STILLS) expect(shotImages(row.files).length, row.id).toBeGreaterThan(0);
    const glyphs = byId(profilesLcd(frames())).get("profiles/glyphs-thin")!;
    expect(parseManifestNote(glyphs.prefer.note)).toEqual(THIN_GLYPH_PAGES);
    const files = glyphs.prefer.source.kind === "shots" ? glyphs.prefer.source.files : [];
    expect(files).toHaveLength(THIN_GLYPH_PAGES.length);
    for (const page of THIN_GLYPH_PAGES) {
      expect(Array.from(page).length).toBeLessThanOrEqual(10);
      for (const ch of page) expect(TYPEABLE.has(ch), ch).toBe(true);
    }
  });

  it("builds a sound golden per row from its events and keys", () => {
    const events = `${EVENTS_HEADER}\n1.0,0,0,0,0.0,0,0,0x910F\n51.0,900,0,0,0.0,0,0,0x9100\n197.0,0,0,0,0.0,0,0,0x910F\n`;
    const io: SoundCaptureIo = {
      events: () => events,
      keys: () => `${KEYS_HEADER}\nmenu,0.0,60.0\n`,
      sha256: () => "0".repeat(64),
      list: () => [],
    };
    const goldens = profilesSounds(io);
    expect(goldens.map((g) => g.id)).toEqual(SOUNDS.map((row) => row.id));
    expect(goldens.every((g) => g.state === "factory")).toBe(true);
    goldens.forEach((golden, i) =>
      expect(golden.status, golden.id).toBe(
        ASSERTED_TASKS.has(SOUNDS[i]!.task) ? "asserted" : "pending:17",
      ),
    );
    expect(goldens[0]!.keys).toHaveLength(1);
  });

  it("keeps rows in the plan's tasks: 6 Activate and standby, 7 power, 8 Rename", () => {
    for (const row of [...TIMELINES, ...STILLS, ...SOUNDS]) {
      expect([6, 7, 8], row.id).toContain(row.task);
      if (row.id.includes("/power-")) expect(row.task, row.id).toBe(7);
      if (/\/rename-/.test(row.id)) expect(row.task, row.id).toBe(8);
    }
  });
});
