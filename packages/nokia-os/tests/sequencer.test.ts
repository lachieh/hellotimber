// Plan 16 Task 4: the sound sequencer plays programs on the buzzer, the tone generator and the
// vibrator, emitting each output change stamped with the kernel time it happens at.
import { describe, expect, it } from "vite-plus/test";
import type { SoundProgram } from "../src/sound/program";
import type { StockSoundEvent } from "../src/sound/port";
import { SoundSequencer, type SoundVolume } from "../src/sound/sequencer";

function recorder(): { events: StockSoundEvent[]; sequencer: SoundSequencer } {
  const events: StockSoundEvent[] = [];
  return { events, sequencer: new SoundSequencer((event) => events.push(event)) };
}

const buzz = (atMs: number, hz: number | null, volume = 16): StockSoundEvent =>
  hz === null ? { output: "buzzer", atMs, hz: null } : { output: "buzzer", atMs, hz, volume };
const tone = (atMs: number, hz: number | null, volume = 0x9104): StockSoundEvent =>
  hz === null ? { output: "tone", atMs, hz: null } : { output: "tone", atMs, hz, volume };
const vib = (atMs: number, on: boolean): StockSoundEvent => ({ output: "vibrator", atMs, on });

/** Nokia tune's first notes, with its vibrator. */
const TUNE: SoundProgram = {
  id: "tune",
  steps: [
    { ms: 115, buzzer: { hz: 1319, volume: 16 }, vibrator: true },
    { ms: 115, buzzer: { hz: 1175, volume: 16 } },
    { ms: 240, buzzer: { hz: 740, volume: 12 } },
    { ms: 240, buzzer: null, vibrator: false },
  ],
};

const BEEP: SoundProgram = { id: "beep", steps: [{ ms: 145, tone: { hz: 900, volume: 0x9104 } }] };

describe("sound sequencer", () => {
  it("emits each step's changes at its exact time and silences what it set at its end", () => {
    const { events, sequencer } = recorder();
    sequencer.play(TUNE, 1000);
    sequencer.advance(5000);
    expect(events).toEqual([
      buzz(1000, 1319),
      vib(1000, true),
      buzz(1115, 1175),
      buzz(1230, 740, 12),
      buzz(1470, null),
      vib(1470, false),
    ]);
  });

  it("emits nothing for a step that repeats the current state", () => {
    const { events, sequencer } = recorder();
    sequencer.play(
      {
        id: "same",
        steps: [
          { ms: 100, buzzer: { hz: 440, volume: 3 } },
          { ms: 100, buzzer: { hz: 440, volume: 3 }, vibrator: false },
        ],
      },
      0,
    );
    sequencer.advance(1000);
    expect(events).toEqual([buzz(0, 440, 3), buzz(200, null)]);
  });

  it("silences at its end an output still on when the program ends", () => {
    const { events, sequencer } = recorder();
    sequencer.play(BEEP, 10);
    sequencer.advance(1000);
    expect(events).toEqual([tone(10, 900), tone(155, null)]);
  });

  it("repeats from loopFrom indefinitely", () => {
    const { events, sequencer } = recorder();
    const loop: SoundProgram = {
      id: "loop",
      steps: [
        { ms: 50, vibrator: true },
        { ms: 100, buzzer: { hz: 1000, volume: 22 } },
        { ms: 100, buzzer: null },
      ],
      loopFrom: 1,
    };
    sequencer.play(loop, 0);
    sequencer.advance(10_000);
    expect(events.slice(0, 6)).toEqual([
      vib(0, true),
      buzz(50, 1000, 22),
      buzz(150, null),
      buzz(250, 1000, 22),
      buzz(350, null),
      buzz(450, 1000, 22),
    ]);
    expect(events.at(-1)).toEqual(buzz(9950, null));
    expect(events).toHaveLength(1 + 2 * 50);
  });

  it("stops outputs at atMs, in the middle of a step, and drops the later steps", () => {
    const { events, sequencer } = recorder();
    sequencer.play(TUNE, 0);
    sequencer.stop(["buzzer", "vibrator"], 150);
    sequencer.advance(5000);
    expect(events).toEqual([
      buzz(0, 1319),
      vib(0, true),
      buzz(115, 1175),
      buzz(150, null),
      vib(150, false),
    ]);
  });

  it("stops only the outputs named; the program keeps the others", () => {
    const { events, sequencer } = recorder();
    sequencer.play(TUNE, 0);
    sequencer.stop(["vibrator"], 50);
    sequencer.advance(5000);
    expect(events).toEqual([
      buzz(0, 1319),
      vib(0, true),
      vib(50, false),
      buzz(115, 1175),
      buzz(230, 740, 12),
      buzz(470, null),
    ]);
  });

  it("replaces a busy output's program at atMs with one change, no off between", () => {
    const { events, sequencer } = recorder();
    sequencer.play(TUNE, 0);
    sequencer.play({ id: "next", steps: [{ ms: 100, buzzer: { hz: 2000, volume: 30 } }] }, 200);
    sequencer.advance(5000);
    // TUNE lost the buzzer only: its 740 Hz note never plays, its vibrator runs to its end.
    expect(events).toEqual([
      buzz(0, 1319),
      vib(0, true),
      buzz(115, 1175),
      buzz(200, 2000, 30),
      buzz(300, null),
      vib(470, false),
    ]);
  });

  it("emits nothing when the new program starts in the state the output is in", () => {
    const { events, sequencer } = recorder();
    sequencer.play(BEEP, 0);
    sequencer.play(BEEP, 100);
    sequencer.advance(1000);
    expect(events).toEqual([tone(0, 900), tone(245, null)]);
  });

  it("runs programs on different outputs independently", () => {
    const { events, sequencer } = recorder();
    sequencer.play(TUNE, 0);
    sequencer.play(BEEP, 100);
    sequencer.advance(5000);
    expect(events).toEqual([
      buzz(0, 1319),
      vib(0, true),
      tone(100, 900),
      buzz(115, 1175),
      buzz(230, 740, 12),
      tone(245, null),
      buzz(470, null),
      vib(470, false),
    ]);
  });

  it("cancels a program: what it still plays goes off, a scheduled one never starts", () => {
    const { events, sequencer } = recorder();
    const tune = sequencer.play(TUNE, 0);
    const beep = sequencer.play(BEEP, 100);
    sequencer.cancel(tune, 120);
    const later = sequencer.play(TUNE, 2000);
    sequencer.cancel(later, 1500);
    sequencer.advance(5000);
    expect(events).toEqual([
      buzz(0, 1319),
      vib(0, true),
      tone(100, 900),
      buzz(115, 1175),
      buzz(120, null),
      vib(120, false),
      tone(245, null),
    ]);
    sequencer.cancel(beep, 5000); // ended already: nothing
    sequencer.advance(6000);
    expect(events).toHaveLength(7);
  });

  it("reports whether a program is still playing or scheduled", () => {
    const { sequencer } = recorder();
    const beep = sequencer.play(BEEP, 100);
    expect(sequencer.playing(beep)).toBe(true);
    sequencer.advance(200);
    expect(sequencer.playing(beep)).toBe(true);
    sequencer.advance(245);
    expect(sequencer.playing(beep)).toBe(false);
  });

  it("knows each output's last emitted change", () => {
    const { sequencer } = recorder();
    expect(sequencer.last("tone")).toBeUndefined();
    sequencer.play(BEEP, 100);
    sequencer.advance(150);
    expect(sequencer.last("tone")).toEqual(tone(100, 900));
    sequencer.advance(300);
    expect(sequencer.last("tone")).toEqual(tone(245, null));
  });

  it("plays to `endStep` only", () => {
    const { events, sequencer } = recorder();
    sequencer.play(TUNE, 0, { endStep: 2 });
    sequencer.advance(5000);
    expect(events).toEqual([
      buzz(0, 1319),
      vib(0, true),
      buzz(115, 1175),
      buzz(230, null),
      vib(230, false),
    ]);
  });
});

describe("tick independence", () => {
  const run = (step: number): StockSoundEvent[] => {
    const { events, sequencer } = recorder();
    sequencer.play(TUNE, 3);
    sequencer.play(BEEP, 40);
    sequencer.play({ ...TUNE, loopFrom: 0 }, 2000);
    sequencer.stop(["vibrator"], 4321);
    for (let t = 0; t <= 10_000; t += step) {
      const seen = events.length;
      sequencer.advance(t);
      const late = events.slice(seen).filter((event) => event.atMs > t);
      if (late.length > 0) throw new Error(`advance(${t}) emitted ${JSON.stringify(late)}`);
    }
    return events;
  };

  it("emits the same events with the same times at 1 ms and in one 10 s jump", () => {
    expect(run(10_000)).toEqual(run(1));
    expect(run(7)).toEqual(run(1));
  });

  it("emits in time order across outputs, ties as buzzer, tone, vibrator", () => {
    const { events, sequencer } = recorder();
    sequencer.play({ id: "v", steps: [{ ms: 10, vibrator: true }] }, 0);
    sequencer.play(BEEP, 0);
    sequencer.play({ id: "b", steps: [{ ms: 10, buzzer: { hz: 440, volume: 3 } }] }, 0);
    sequencer.advance(1000);
    expect(events.map((e) => `${e.atMs} ${e.output}`)).toEqual([
      "0 buzzer",
      "0 tone",
      "0 vibrator",
      "10 buzzer",
      "10 vibrator",
      "145 tone",
    ]);
    const times = events.map((e) => e.atMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("starts a program asked for in the past at the time already reached", () => {
    const { events, sequencer } = recorder();
    sequencer.advance(500);
    sequencer.play(BEEP, 100);
    sequencer.advance(1000);
    expect(events).toEqual([tone(500, 900), tone(645, null)]);
  });
});

describe("the volume option", () => {
  /** Volume doubles from 300 ms into the program: a level change at a time, not a step. */
  const louder: SoundVolume = {
    changesAtMs: [300],
    of: (_output, _hz, stored, offsetMs) => (offsetMs >= 300 ? stored * 2 : stored),
  };

  it("changes only volumes: at each step's start, and for a sounding note at a change time", () => {
    const { events, sequencer } = recorder();
    sequencer.play(TUNE, 1000, { volume: louder });
    sequencer.advance(5000);
    expect(events).toEqual([
      buzz(1000, 1319),
      vib(1000, true),
      buzz(1115, 1175),
      buzz(1230, 740, 12),
      buzz(1300, 740, 24),
      buzz(1470, null),
      vib(1470, false),
    ]);
  });

  it("reads the frequency and the output", () => {
    const { events, sequencer } = recorder();
    const seen: string[] = [];
    sequencer.play(
      {
        id: "both",
        steps: [{ ms: 10, buzzer: { hz: 440, volume: 3 }, tone: { hz: 900, volume: 7 } }],
      },
      0,
      {
        volume: {
          changesAtMs: [],
          of: (output, hz, stored) => {
            seen.push(`${output} ${hz}`);
            return stored + 1;
          },
        },
      },
    );
    sequencer.advance(100);
    expect(seen).toEqual(["buzzer 440", "tone 900"]);
    expect(events.slice(0, 2)).toEqual([buzz(0, 440, 4), tone(0, 900, 8)]);
  });
});
