// Plan 16 Task 7: warning tones on notes (D12). Every `sound/note/*` golden runs in
// tests/acceptance.test.ts (tests/support/sound-scenarios.ts).
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import type { StockSoundEvent } from "../src/index";
import { NOTE_SOUNDS } from "../src/resources";
import { SoundSequencer } from "../src/sound/sequencer";
import { StockSounder } from "../src/sound/sounder";
import type { Flow } from "../src/widgets/flow";
import { note } from "../src/widgets/note";
import { soundStorage, type SettingChoices } from "./support/sound-scenarios.ts";

function sounderAt(choices: SettingChoices = {}) {
  const events: StockSoundEvent[] = [];
  const sequencer = new SoundSequencer((event) => events.push(event));
  const settings = createStockSettings(new StockEeprom(soundStorage("factory", choices)));
  let now = 1000;
  const sounder = new StockSounder(sequencer, settings, () => now);
  return {
    events,
    sounder,
    run: (ms: number): void => {
      now += ms;
      sequencer.advance(now);
    },
  };
}

const INVALID = ["Invalid", "shortcut"] as const;

describe("note warning tones (D12)", () => {
  it("plays a note's tone from its first frame in place of the key's beep (Warning tones On)", () => {
    const { events, sounder, run } = sounderAt();
    sounder.keyDown("9");
    sounder.note(INVALID);
    run(1000);
    const tone = NOTE_SOUNDS["Invalid shortcut"]!.steps[0]!;
    expect(events).toEqual([
      { output: "tone", atMs: 1000, hz: 1750, volume: 0x9105 },
      { output: "tone", atMs: 1000 + tone.ms, hz: null },
    ]);
  });

  it("plays `Code error` on the buzzer and silences the key's beep on the tone generator", () => {
    const { events, sounder, run } = sounderAt();
    sounder.keyDown("navi");
    sounder.note(["Code", "error"]);
    run(1000);
    expect(events.map((e) => e.output)).toEqual(["buzzer", "buzzer"]);
    expect(events[0]).toMatchObject({ hz: 1000, volume: 22 });
  });

  it("keeps the key silent with Warning tones Off", () => {
    const { events, sounder, run } = sounderAt({ "tones/warning-tones": 1 });
    sounder.keyDown("9");
    sounder.note(INVALID);
    run(1000);
    expect(events).toEqual([]);
  });

  it("changes nothing for a note without a captured tone (`Done`)", () => {
    const { events, sounder, run } = sounderAt();
    sounder.keyDown("navi");
    sounder.note(["Done"]);
    run(1000);
    expect(events).toEqual([
      { output: "tone", atMs: 1000, hz: 900, volume: 0x9104 },
      { output: "tone", atMs: 1124, hz: null },
    ]);
  });

  it("lets the tone run out when a later key ends the note", () => {
    const { events, sounder, run } = sounderAt();
    sounder.note(INVALID);
    run(100);
    sounder.keyDown("c");
    run(1000);
    // The C beep takes the tone generator over (its own program); the note's tone is not stopped
    // first (no off between them).
    expect(events.map((e) => [e.atMs, e.output === "tone" ? e.hz : e.output])).toEqual([
      [1000, 1750],
      [1100, 900],
      [1245, null],
    ]);
  });
});

describe("the note widget's sound hook", () => {
  it("sounds on opening and on each key-down, with the note's lines", () => {
    const heard: string[] = [];
    const widget = note({
      lines: ["Not", "allowed"],
      sound: (lines) => heard.push(lines.join(" ")),
    });
    expect(heard).toEqual(["Not allowed"]);
    widget.onKeyDown?.("down", {} as Flow);
    expect(heard).toEqual(["Not allowed", "Not allowed"]);
  });
});
