// Plan 19 Task 2: the phone book's capture set on synthetic sources (no REF).
import { describe, expect, it } from "vite-plus/test";
import type { CaptureIo, CaptureSetEntry } from "../scripts/capture-set.ts";
import {
  DONE_TASKS,
  PHONE_BOOK_GOLDEN_SIMS,
  PHONE_BOOK_SIMS,
  PHONE_BOOK_SOUNDS,
  phoneBook,
  phoneBookSounds,
} from "../scripts/capture-sets/19-phone-book.ts";
import { EVENTS_HEADER, KEYS_HEADER, type SoundCaptureIo } from "../scripts/sound-capture-set.ts";
import type { RecordingFrame } from "../scripts/tree-capture-set.ts";

/** Recordings whose frame 0 repeats once before the screen changes (trigger frame 2). */
const frames: readonly RecordingFrame[] = [
  { image: "a", startMs: 1, durationMs: 40 },
  { image: "a", startMs: 41, durationMs: 40 },
  { image: "b", startMs: 81, durationMs: 400 },
];

const io = {
  frames: { recording: () => frames, scrollImages: () => undefined },
} as unknown as CaptureIo;

const lcd: readonly CaptureSetEntry[] = phoneBook.lcd!(io);
const byId = new Map(lcd.map((entry) => [entry.id, entry] as const));

/** The plan's "Golden pipeline additions" rows, as id prefixes. */
const PIPELINE = [
  "phone-book/standby-down-",
  "phone-book/standby-up",
  "phone-book/view-large",
  "phone-book/view-list",
  "phone-book/view-number",
  "phone-book/letters-",
  "phone-book/search-",
  "phone-book/service-",
  "phone-book/add-",
  "phone-book/erase-",
  "phone-book/edit-",
  "phone-book/tone-",
  "phone-book/bcard-",
  "phone-book/memory-",
  "phone-book/view-choose-",
  "phone-book/speed-",
  "phone-book/hold-",
  "phone-book/voice-",
  "phone-book/persist-",
  "phone-book/sim-",
  "phone-book/pick-",
];

/** Call screens, the dialled numbers and held keys at standby: plan 22's (D11). */
/** Plan 22's follow-up: Call from a name or a service number, a held speed dial. */
const CALLS = ["phone-book/standby-list-call", "phone-book/service-call", "phone-book/hold-on-2"];

describe("phone book capture set", () => {
  it("is plan 19's, with LCD and sound goldens", () => {
    expect(phoneBook.plan).toBe("19");
    expect(phoneBook.sounds).toBeTypeOf("function");
  });

  it("covers every row of the golden pipeline table, with unique phone-book/ ids", () => {
    expect(new Set(lcd.map((e) => e.id)).size).toBe(lcd.length);
    for (const entry of lcd) expect(entry.id.startsWith("phone-book/"), entry.id).toBe(true);
    for (const prefix of PIPELINE) {
      expect(
        lcd.some((e) => e.id.startsWith(prefix)),
        prefix,
      ).toBe(true);
    }
  });

  it("reads shots as stills and recordings as timelines triggered on their first change", () => {
    const still = byId.get("phone-book/view-large")!;
    expect(still.kind).toBe("still");
    expect(still.prefer.source).toEqual({
      kind: "shots",
      files: Array.from(
        { length: 24 },
        (_, i) => `plan19/views/large/down-${String(i).padStart(2, "0")}.png`,
      ),
    });
    const timeline = byId.get("phone-book/standby-down-large")!;
    expect(timeline.kind).toBe("timeline");
    expect(timeline.prefer.source).toEqual({ kind: "recording", dir: "plan19/standby/down-large" });
    expect(timeline.prefer.triggerFrame).toBe(2);
  });

  it("names the SIM fixture of every golden in its note", () => {
    for (const entry of lcd) {
      const sim = PHONE_BOOK_GOLDEN_SIMS[entry.id];
      expect(sim, entry.id).toBeDefined();
      expect(PHONE_BOOK_SIMS[sim!], entry.id).toBeDefined();
      expect(entry.prefer.note?.startsWith(`SIM ${sim}`), entry.id).toBe(true);
    }
  });

  it("leaves calls to plan 22 and every other golden to its plan 19 task", () => {
    for (const id of CALLS) expect(byId.get(id)?.status, id).toBe("pending:22");
    for (const entry of lcd) {
      if (CALLS.includes(entry.id)) continue;
      expect(["asserted", "pending:19"], entry.id).toContain(entry.status);
    }
    if (DONE_TASKS.size === 0) {
      expect(lcd.filter((e) => e.status === "asserted").map((e) => e.id)).toEqual([]);
    }
  });

  it("names its sound goldens sound/note/<name> (a warning tone, its text quoted) or sound/phone-book/<name>", () => {
    for (const entry of PHONE_BOOK_SOUNDS) {
      if (entry.id.startsWith("sound/note/")) expect(entry.note, entry.id).toMatch(/^"[^"]+"/);
      else expect(entry.id.startsWith("sound/phone-book/"), entry.id).toBe(true);
      expect(entry.dir.startsWith("plan19/"), entry.id).toBe(true);
      expect(entry.state).toBe("factory");
    }
    expect(PHONE_BOOK_SOUNDS.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        "sound/note/nothing-to-save",
        "sound/note/memory-full",
        "sound/phone-book/bcard",
        "sound/phone-book/tone-preview-down",
      ]),
    );
  });

  it("builds sound goldens from a recording's events and keys", () => {
    const sound: SoundCaptureIo = {
      events: () =>
        [
          EVENTS_HEADER,
          "1.0,0,0,0,0.0,0,0,0x910F",
          "28.0,1750,0,0,0.0,0,0,0x9105",
          "322.0,0,0,0,0.0,0,0,0x910F",
        ].join("\n"),
      keys: () => [KEYS_HEADER, "menu,0.0,60.0"].join("\n"),
      sha256: () => "0".repeat(64),
      list: () => [],
    };
    const goldens = phoneBookSounds(sound);
    expect(goldens.map((g) => g.id)).toEqual(PHONE_BOOK_SOUNDS.map((e) => e.id));
    expect(goldens[0]!.rows.length).toBeGreaterThan(0);
  });
});

// Every name's glyphs in the small and large faces: tests/resources.test.ts (Task 3).
describe("PHONE_BOOK_SIMS (D2)", () => {
  const NUMBER = /^\+?[0-9*#p]{0,20}$/;
  for (const [name, sim] of Object.entries(PHONE_BOOK_SIMS)) {
    it(`${name} is a valid StockSimCard`, () => {
      expect(sim.id).not.toBe("");
      const locations = sim.phoneBook?.locations ?? 50;
      const nameLength = sim.phoneBook?.nameLength ?? 16;
      const entries = sim.phoneBook?.entries ?? [];
      expect(entries.length).toBeLessThanOrEqual(locations);
      for (const contact of [...entries, ...(sim.serviceNumbers ?? [])]) {
        if (contact === null) continue;
        expect(Array.from(contact.name).length, contact.name).toBeLessThanOrEqual(nameLength);
        expect(contact.number, contact.name).toMatch(NUMBER);
        expect(contact.name !== "" || contact.number !== "", JSON.stringify(contact)).toBe(true);
      }
    });
  }
});
