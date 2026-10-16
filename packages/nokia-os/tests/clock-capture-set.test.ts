// Plan 21 Task 2: the clock's capture set on synthetic sources (no REF).
import { describe, expect, it } from "vite-plus/test";
import { shotImages, type CaptureIo } from "../scripts/capture-set.ts";
import {
  clockAndReminders,
  clockLcd,
  clockSounds,
  CLOCK_CUTS,
  CLOCK_RECORDINGS,
  CLOCK_SOUNDS,
  CLOCK_STILLS,
  statusOf,
  triggerOf,
} from "../scripts/capture-sets/21-clock-and-reminders.ts";
import { EVENTS_HEADER, KEYS_HEADER, type SoundCaptureIo } from "../scripts/sound-capture-set.ts";

describe("clock capture set", () => {
  const lcd = clockLcd();

  it("has unique ids under clock/ and reminders/", () => {
    const ids = lcd.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(/^(clock\/[a-z-]+\/|reminders\/)[a-z0-9-]+$/);
  });

  it("imports each recording whole as a timeline, keyed from its first change", () => {
    for (const recording of CLOCK_RECORDINGS) {
      const entry = lcd.find((e) => e.id === recording.id)!;
      expect(entry.kind).toBe("timeline");
      if (CLOCK_CUTS[recording.id] === undefined)
        expect(entry.prefer.source).toEqual({ kind: "recording", dir: `plan21/${recording.dir}` });
      expect(entry.prefer.triggerFrame).toBe(triggerOf(recording));
      for (const [key, down, hold] of recording.keys) {
        expect(key).toMatch(/^([0-9*#]|menu|c|up|down|power)$/);
        expect(down).toBeGreaterThanOrEqual(0);
        expect(hold).toBeGreaterThan(0);
      }
    }
  });

  it("waits for the blink in recordings that start on a prompt", () => {
    const of = (id: string) => triggerOf(CLOCK_RECORDINGS.find((r) => r.id === id)!);
    expect(of("reminders/add-save")).toBe("before-recording");
    expect(of("reminders/add-time-0900")).toBe("before-recording");
    expect(of("reminders/add-time-open")).toBe(1);
    expect(of("reminders/add-date-c")).toBe(1);
    expect(of("clock/settings/set-time-keys")).toBe(1);
  });

  it("names every still image validly", () => {
    for (const { source } of CLOCK_STILLS) {
      if (source.kind === "shots") {
        const { files } = source;
        expect(() => shotImages(files)).not.toThrow();
      }
    }
  });

  it("starts every golden pending on plan 21 until its task asserts it", () => {
    for (const entry of lcd) expect(entry.status).toBe(statusOf(entry.id));
    expect(statusOf("clock/nothing/like-this")).toBe("pending:21");
  });

  it("builds the alerts' sound goldens through plan 16's importer", () => {
    const events = `${EVENTS_HEADER}\n1.0,0,0,0,0.0,0,0,0x900F\n100.0,0,0,1,2683.7,1,6,0x900F\n193.0,0,0,0,0.0,0,6,0x900F\n`;
    const io: SoundCaptureIo = {
      events: () => events,
      keys: () => `${KEYS_HEADER}\n`,
      sha256: () => "0".repeat(64),
      list: () => [],
    };
    const goldens = clockSounds({ sound: io } as unknown as CaptureIo);
    expect(goldens.map((g) => g.id)).toEqual(CLOCK_SOUNDS.map((s) => s.id));
    for (const golden of goldens) expect(golden.rows.length).toBeGreaterThan(0);
  });

  it("is plan 21's set", () => {
    expect(clockAndReminders.plan).toBe("21");
  });
});
