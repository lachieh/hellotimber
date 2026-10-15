import { describe, expect, it } from "vite-plus/test";
import type { SoundGolden, SoundRow } from "../scripts/sound-format.ts";
import type { StockSoundEvent } from "../src/index";
import { expectSoundTimeline } from "./support/sound.ts";

const note = (ms: number, hz = 880, volume = 4): SoundRow => ({
  ms,
  output: "buzzer",
  state: { kind: "sounding", hz, volume },
});
const off = (ms: number): SoundRow => ({ ms, output: "buzzer", state: { kind: "off" } });

function compare(want: readonly SoundRow[], got: readonly SoundRow[]): void {
  const golden: SoundGolden = {
    id: "sound/test/diff",
    status: "asserted",
    source: "synthetic",
    sourceSha256: "0".repeat(64),
    state: "factory",
    omitted: [],
    rows: want,
  };
  const events: StockSoundEvent[] = got.map((row) => {
    if (row.state.kind === "on" || row.output === "vibrator")
      throw new Error("This fixture uses audible outputs only");
    return {
      atMs: row.ms,
      output: row.output,
      hz: row.state.kind === "off" ? null : row.state.hz,
      volume: row.state.kind === "off" ? 0 : row.state.volume,
    };
  });
  expectSoundTimeline({ originMs: 0, endMs: 2000, events }, golden, "synthetic sound regression");
}

// Every rule must work with either the golden or the port containing the short event.
function both(a: readonly SoundRow[], b: readonly SoundRow[], passes: boolean): void {
  for (const [want, got] of [
    [a, b],
    [b, a],
  ] as const) {
    if (passes) expect(() => compare(want, got)).not.toThrow();
    else expect(() => compare(want, got)).toThrow(/Sound mismatch/);
  }
}

describe("sound fidelity comparison", () => {
  it("ignores an absent 20 ms chirp at the start, between notes, and at the end", () => {
    both([note(0), off(20)], [], true);
    both([note(0), note(100, 660), note(120), off(300)], [note(0), off(300)], true);
    both([note(0), off(100), note(200), off(220)], [note(0), off(100)], true);
  });

  it("ignores an absent 20 ms rest between equal or different pitches", () => {
    both([note(0), off(100), note(120), off(300)], [note(0), off(300)], true);
    both([note(0), off(100), note(120, 660), off(300)], [note(0), note(120, 660), off(300)], true);
  });

  it("retains notes and rests at 34 ms and notes at 40 ms", () => {
    for (const duration of [33, 34, 40]) {
      both([note(0), off(duration)], [], duration < 34);
      both([note(0), off(100), note(100 + duration), off(300)], [note(0), off(300)], duration < 34);
    }
  });

  it("ignores different short pitches but retains an audible wrong counterpart", () => {
    both([note(0), off(20)], [note(0, 660), off(20)], true);
    both([note(0), off(20)], [note(0, 660), off(100)], false);
  });

  it("rejects a wrong frequency or volume on a 100 ms note", () => {
    both([note(0), off(100)], [note(0, 660), off(100)], false);
    both([note(0), off(100)], [note(0, 880, 5), off(100)], false);
  });

  it("rejects a missing sustained note even beside a short event of the same pitch", () => {
    both([note(0), off(20), note(100), off(200)], [], false);
    both([note(0), off(20)], [note(0), off(100)], false);
    both([note(0), off(100), note(120), off(220)], [note(0), off(100)], false);
  });

  it("keeps terminal states and the final off after a sustained note", () => {
    both([note(0), off(100)], [note(0)], false);
    both([note(0)], [], false);
    both([note(0), off(100), note(200)], [note(0), off(100)], false);
    both([note(0), note(100, 660), note(120), off(300)], [note(0)], false);
  });

  it("does not use a nearby repeated pitch to erase a sustained event", () => {
    both([note(0), off(100), note(140), off(160), note(200), off(300)], [note(0), off(100)], false);
    both(
      [note(0), off(100), note(140), off(160), note(200), off(300)],
      [note(0), off(100), note(200), off(300)],
      true,
    );
  });

  it("pairs a nearby sustained pitch once, leaving an absent short repetition optional", () => {
    both(
      [note(0), off(100), note(140), off(160), note(170), off(270)],
      [note(0), off(100), note(170), off(270)],
      true,
    );
    both(
      [note(0), off(100), note(120), off(140), note(160), off(260)],
      [note(0), off(100), note(160), off(260)],
      true,
    );
  });

  it("aligns an absent short chirp among repeated pitches without shifting later matches", () => {
    both(
      [note(100), off(120), note(200), off(220), note(300), off(320)],
      [note(100), off(120), note(300), off(320)],
      true,
    );
  });

  it("measures duration separately for each output", () => {
    const chirp = { ...note(110, 660), output: "tone" as const };
    both([note(0), chirp, { ...off(130), output: "tone" }, off(200)], [note(0), off(200)], true);
  });
});
