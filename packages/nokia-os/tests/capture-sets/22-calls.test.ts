// Plan 22 Task 2: the calls capture set on synthetic sources (no REF).
import { describe, expect, it } from "vite-plus/test";
import {
  ALL_CALL_CASES,
  CALL_RECORDINGS,
  CALL_SOUNDS,
  CALL_STILLS,
  calls,
  CallsCaptureError,
  callsLcd,
  callStills,
  recordingId,
  stillFixtureOf,
} from "../../scripts/capture-sets/22-calls.ts";
import type { CaptureIo } from "../../scripts/capture-set.ts";
import { IMAGE_NAME } from "../../scripts/golden-format.ts";

describe("calls capture set", () => {
  it("is plan 22's, registered with LCD and sound goldens", () => {
    expect(calls.plan).toBe("22");
    expect(calls.lcd).toBeDefined();
    expect(calls.sounds).toBeDefined();
  });

  it("puts every case in a declared still fixture under a valid image name", () => {
    for (const c of ALL_CALL_CASES) {
      const { id, image } = stillFixtureOf(c);
      expect(
        CALL_STILLS.some((fixture) => fixture.id === id),
        c.name,
      ).toBe(true);
      expect(IMAGE_NAME.test(image), `${c.name}: ${image}`).toBe(true);
    }
  });

  it("keeps the pending fixtures apart from the asserted ones", () => {
    expect(stillFixtureOf({ name: "entry/save", keys: "" }).id).toBe("calls/entry-save");
    expect(stillFixtureOf({ name: "entry/power", keys: "" }).id).toBe("calls/entry-keys");
    expect(stillFixtureOf({ name: "code/imei-down", keys: "" }).id).toBe("calls/code-down");
  });

  it("refuses a case listed twice and a fixture without cases", () => {
    const c = ALL_CALL_CASES[0]!;
    expect(() => callStills([c, c])).toThrow(CallsCaptureError);
    expect(() => callStills([c])).toThrow(/has no case/);
  });

  it("names every recording uniquely and aligns interruptions on the ringing screen", () => {
    const ids = CALL_RECORDINGS.map((r) => recordingId(r.dir));
    expect(new Set(ids).size).toBe(ids.length);
    const io = {
      frames: {
        recording: () => [
          { image: "a", startMs: 1, durationMs: 2100 },
          { image: "b", startMs: 2101, durationMs: 480 },
        ],
        scrollImages: () => undefined,
      },
    } as unknown as CaptureIo;
    const entry = callsLcd(io).find((e) => e.id === "calls/interrupt-menu-reject")!;
    expect(entry.prefer.triggerFrame).toBe(1);
  });

  it("lists sound goldens under sound/calls and the warning tones as note goldens", () => {
    for (const entry of CALL_SOUNDS) {
      expect(entry.id).toMatch(/^sound\/(calls|note\/calls-)/);
      if (entry.id.startsWith("sound/note/")) expect(entry.note).toMatch(/^"[^"]+"/);
    }
  });
});
