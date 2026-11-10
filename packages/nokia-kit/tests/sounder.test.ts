// Plan 28 (D10): a game's own notes through the sounder, and stopping what a game started. The
// sounder's stock behaviour is tested with the sound goldens in nokia-os.
import { describe, expect, it } from "vite-plus/test";
import type { StockCue, StockCueSink } from "../src/system/cues";
import type { StockSettings } from "../src/system/settings";
import { GAME_NOTE_VOLUME, StockSounder } from "../src/system/sounder";
import { GAME_CUES } from "../src/ui/resources";
import type { StockSoundEvent } from "../src/ui/sound/port";
import type { SoundProgram } from "../src/ui/sound/program";
import { SoundSequencer } from "../src/ui/sound/sequencer";

/** Tones lists read On, Off; the games' Sounds and Shakes read Off, On. */
const TONES = { on: 0, off: 1 } as const;
const GAMES = { off: 0, on: 1 } as const;

/** A one-second 220 Hz game sound, and a ring that is not a game's. */
const LONG: SoundProgram = {
  id: "test/long",
  steps: [{ ms: 1000, buzzer: { hz: 220, volume: 9 } }],
};
const RING: SoundProgram = {
  id: "test/ring",
  steps: [{ ms: 500, buzzer: { hz: 330, volume: 9 }, vibrator: true }],
};

/** A sounder over the four settings that gate game cues (all On unless given). */
function rig(choices: Readonly<Record<string, number | null>> = {}) {
  const stored: Record<string, number | null> = {
    "tones/warning-tones": TONES.on,
    "games/settings/sounds": GAMES.on,
    "games/settings/shakes": GAMES.on,
    "tones/vibrating-alert": TONES.on,
    ...choices,
  };
  const settings = { choice: (key: string) => stored[key] ?? null } as StockSettings;
  const events: StockSoundEvent[] = [];
  const sequencer = new SoundSequencer((event) => events.push(event));
  const sounder = new StockSounder(sequencer, settings, () => 0, {
    gameSounds: { "test/long": LONG },
  });
  const sink: StockCueSink = sounder;
  return {
    events,
    sequencer,
    stored,
    cue: (cue: StockCue, atMs: number) => sink.cue(cue, atMs),
    /** Every event up to `ms`. */
    until: (ms: number): StockSoundEvent[] => {
      sequencer.advance(ms);
      return events;
    },
  };
}

const buzz = (atMs: number, hz: number | null, volume = GAME_NOTE_VOLUME): StockSoundEvent =>
  hz === null ? { output: "buzzer", atMs, hz } : { output: "buzzer", atMs, hz, volume };
const vib = (atMs: number, on: boolean): StockSoundEvent => ({ output: "vibrator", atMs, on });

const TUNE: StockCue = {
  kind: "notes",
  notes: [
    { hz: 440, ms: 100 },
    { hz: 880, ms: 200 },
  ],
};

describe("the notes cue", () => {
  it("plays at the meal's captured register", () => {
    expect(GAME_NOTE_VOLUME).toBe(6);
    const meal = GAME_CUES.eat.steps[0]!.buzzer;
    expect(meal?.volume).toBe(GAME_NOTE_VOLUME);
  });

  it("plays each note on the buzzer for its ms, from the cue's kernel time", () => {
    const { cue, until } = rig();
    cue(TUNE, 50);
    expect(until(1000)).toEqual([buzz(50, 440), buzz(150, 880), buzz(350, null)]);
  });

  it("holds a repeated frequency as one sound", () => {
    const { cue, until } = rig();
    cue(
      {
        kind: "notes",
        notes: [
          { hz: 440, ms: 30 },
          { hz: 440, ms: 30 },
        ],
      },
      0,
    );
    expect(until(1000)).toEqual([buzz(0, 440), buzz(60, null)]);
  });

  it("plays nothing for no notes", () => {
    const { cue, until } = rig();
    cue({ kind: "notes", notes: [] }, 0);
    expect(until(1000)).toEqual([]);
  });

  it.each([
    ["Warning tones Off", { "tones/warning-tones": TONES.off }],
    ["Warning tones never set", { "tones/warning-tones": null }],
    ["Games sounds Off", { "games/settings/sounds": GAMES.off }],
  ])("is silent with %s, like the captured game cues", (_name, choices) => {
    const { cue, until } = rig(choices);
    cue(TUNE, 0);
    cue({ kind: "eat" }, 400);
    expect(until(1000)).toEqual([]);
  });

  it("does not need the vibrator's settings", () => {
    const { cue, until } = rig({
      "games/settings/shakes": GAMES.off,
      "tones/vibrating-alert": TONES.off,
    });
    cue(TUNE, 0);
    expect(until(1000)).toEqual([buzz(0, 440), buzz(100, 880), buzz(300, null)]);
  });

  it("is replaced by the next sound, and replaces the one playing; neither resumes", () => {
    const { cue, until } = rig();
    cue({ kind: "game-sound", id: "test/long" }, 0);
    cue(TUNE, 20);
    cue({ kind: "game-sound", id: "test/long" }, 40);
    cue(TUNE, 60);
    cue({ kind: "notes", notes: [{ hz: 660, ms: 10 }] }, 70);
    expect(until(3000)).toEqual([
      buzz(0, 220, 9),
      buzz(20, 440),
      buzz(40, 220, 9),
      buzz(60, 440),
      buzz(70, 660),
      buzz(80, null),
    ]);
  });
});

describe("the stop cue", () => {
  it("ends a tune and a shake at its kernel time", () => {
    const { cue, until } = rig();
    cue(TUNE, 0);
    cue({ kind: "vibrate", ms: 1000 }, 0);
    cue({ kind: "stop" }, 130);
    expect(until(3000)).toEqual([
      buzz(0, 440),
      vib(0, true),
      buzz(100, 880),
      buzz(130, null),
      vib(130, false),
    ]);
  });

  it("ends a captured game sound, and a shake that replaced another", () => {
    const { cue, until } = rig();
    cue({ kind: "game-sound", id: "test/long" }, 0);
    cue({ kind: "vibrate", ms: 100 }, 0);
    cue({ kind: "vibrate", ms: 2000 }, 50);
    cue({ kind: "stop" }, 300);
    expect(until(3000)).toEqual([buzz(0, 220, 9), vib(0, true), buzz(300, null), vib(300, false)]);
  });

  it("stops whatever the settings are by then", () => {
    const { cue, until, stored } = rig();
    cue(TUNE, 0);
    cue({ kind: "vibrate", ms: 1000 }, 0);
    stored["games/settings/sounds"] = GAMES.off;
    stored["games/settings/shakes"] = GAMES.off;
    cue({ kind: "stop" }, 30);
    expect(until(3000)).toEqual([buzz(0, 440), vib(0, true), buzz(30, null), vib(30, false)]);
  });

  it("does nothing when no game cue is playing, or twice", () => {
    const { cue, until } = rig();
    cue({ kind: "stop" }, 0);
    cue(TUNE, 10);
    cue({ kind: "stop" }, 20);
    cue({ kind: "stop" }, 25);
    expect(until(3000)).toEqual([buzz(10, 440), buzz(20, null)]);
  });

  it("leaves a sound that is not the game's playing", () => {
    const { cue, until, sequencer } = rig();
    cue(TUNE, 0);
    cue({ kind: "vibrate", ms: 1000 }, 0);
    sequencer.play(RING, 10);
    cue({ kind: "stop" }, 20);
    expect(until(3000)).toEqual([
      buzz(0, 440),
      vib(0, true),
      buzz(10, 330, 9),
      buzz(510, null),
      vib(510, false),
    ]);
  });

  it("lets the next cue play", () => {
    const { cue, until } = rig();
    cue(TUNE, 0);
    cue({ kind: "stop" }, 10);
    cue({ kind: "notes", notes: [{ hz: 660, ms: 40 }] }, 20);
    expect(until(3000)).toEqual([buzz(0, 440), buzz(10, null), buzz(20, 660), buzz(60, null)]);
  });
});
