import { describe, expect, it } from "vite-plus/test";
import {
  EVENTS_HEADER,
  KEYS_HEADER,
  SOUND_CAPTURE_SET,
  SoundCaptureError,
  alignOnKeys,
  buildSoundGolden,
  detectLoop,
  noteGoldens,
  normaliseEvents,
  parseEventsCsv,
  parseKeysCsv,
  toneSlug,
  type SoundCaptureEntry,
  type SoundCaptureIo,
} from "../scripts/sound-capture-set.ts";
import { parseSoundGolden, serializeSoundGolden, type SoundRow } from "../scripts/sound-format.ts";

/** An events.csv from rows of [t, tone1, tone2, buzzerOn, buzzerHz, vibra, buzzerVol, dspLevel]. */
function eventsCsv(...rows: (string | number)[][]): string {
  return [EVENTS_HEADER, ...rows.map((r) => r.join(","))].join("\n") + "\n";
}

const IDLE = [0, 0, 0, "0.0", 0, 0, "0x910F"];
const row = (t: number, cells: (string | number)[] = IDLE): (string | number)[] => [
  t.toFixed(1),
  ...cells,
];

function keysCsv(...keys: [string, number, number][]): string {
  return [KEYS_HEADER, ...keys.map((k) => k.join(","))].join("\n") + "\n";
}

function io(recordings: Record<string, { events: string; keys: string }>): SoundCaptureIo {
  return {
    events: (dir) => recordings[dir]?.events,
    keys: (dir) => recordings[dir]?.keys,
    sha256: () => "a".repeat(64),
    list: (dir) =>
      Object.keys(recordings)
        .filter((d) => d.startsWith(`${dir}/`) && !d.slice(dir.length + 1).includes("/"))
        .map((d) => d.slice(dir.length + 1)),
  };
}

const ENTRY: SoundCaptureEntry = {
  id: "sound/test/one",
  dir: "plan16/test/one",
  state: "factory",
  status: "asserted",
  note: "A synthetic recording.",
};

describe("events and keys files", () => {
  it("parses the v2 columns", () => {
    const [event] = parseEventsCsv(
      eventsCsv(row(12.5, [900, 0, 1, "2683.7", 1, 22, "0x9104"])),
      "x.events.csv",
    );
    expect(event).toEqual({
      ms: 12.5,
      tone1: 900,
      tone2: 0,
      buzzerOn: true,
      buzzerHz: 2683.7,
      vibra: true,
      buzzerVol: 22,
      dspLevel: 0x9104,
    });
  });

  it("rejects v1 events, bad rows and unknown keys, naming the file", () => {
    expect(() =>
      parseEventsCsv("t_ms,dsp_tone1_hz,dsp_tone2_hz,buzzer_on,buzzer_hz,vibra\n", "a.events.csv"),
    ).toThrow(/^a\.events\.csv: expected the v2 events header/);
    expect(() => parseEventsCsv(eventsCsv(row(1, [0, 0, 0, 0, 0, 0, "9104"])), "a.csv")).toThrow(
      "a.csv:2: bad events row",
    );
    expect(() => parseKeysCsv(keysCsv(["select", 0, 60]), "k.csv")).toThrow("k.csv:2: bad key row");
    expect(parseKeysCsv(keysCsv(["menu", 0, 60], ["pwr", 100, 1600]), "k.csv")).toEqual([
      { key: "navi", downMs: 0, upMs: 60 },
      { key: "power", downMs: 100, upMs: 1600 },
    ]);
  });
});

describe("normalisation (D6)", () => {
  it("turns the polled registers into per-output state changes", () => {
    const { rows, omitted } = normaliseEvents(
      parseEventsCsv(
        eventsCsv(
          row(1),
          row(30, [900, 0, 0, "0.0", 0, 0, "0x9104"]),
          row(171, [0, 0, 0, "0.0", 0, 0, "0x910F"]),
          row(993, [0, 0, 1, "1319.0", 1, 16, "0x910F"]),
          row(1108, [0, 0, 1, "1175.0", 1, 16, "0x910F"]),
        ),
        "x",
      ),
    );
    expect(rows).toEqual([
      { ms: 30, output: "tone", state: { kind: "sounding", hz: 900, volume: 0x9104 } },
      { ms: 171, output: "tone", state: { kind: "off" } },
      { ms: 993, output: "buzzer", state: { kind: "sounding", hz: 1319, volume: 16 } },
      { ms: 993, output: "vibrator", state: { kind: "on" } },
      { ms: 1108, output: "buzzer", state: { kind: "sounding", hz: 1175, volume: 16 } },
    ]);
    expect(omitted).toEqual([]);
  });

  it("drops states held for one grain and counts them by reason", () => {
    const { rows, omitted } = normaliseEvents(
      parseEventsCsv(
        eventsCsv(
          row(1),
          row(100, [0, 0, 1, "0.0", 0, 0, "0x910F"]), // divider rewrite
          row(101, [0, 0, 1, "831.0", 1, 12, "0x910F"]),
          row(200, [0, 0, 1, "831.0", 1, 17, "0x910F"]), // new volume, old frequency
          row(201, [0, 0, 1, "1109.0", 0, 17, "0x910F"]),
          row(300, [0, 0, 1, "1109.0", 1, 17, "0x910F"]), // vibrator on for one grain
          row(301, [900, 0, 1, "1109.0", 0, 17, "0x9104"]),
          row(440, [900, 0, 1, "1109.0", 0, 17, "0x910F"]), // the mute word before the stop
          row(441, [0, 0, 0, "0.0", 0, 17, "0x910F"]),
        ),
        "x",
      ),
    );
    expect(rows.map((r) => `${r.ms} ${r.output} ${r.state.kind}`)).toEqual([
      "101 buzzer sounding",
      "101 vibrator on",
      "201 buzzer sounding",
      "201 vibrator off",
      "301 tone sounding",
      "441 buzzer off",
      "441 tone off",
    ]);
    expect(omitted).toEqual([
      { count: 1, reason: "divider rewrite" },
      { count: 1, reason: "level rewrite" },
      { count: 1, reason: "stale frequency" },
      { count: 1, reason: "vibrator glitch" },
    ]);
  });

  it("drops a note's volume written ahead of its divider, however long", () => {
    const { rows, omitted } = normaliseEvents(
      parseEventsCsv(
        eventsCsv(
          row(1),
          row(456, [0, 0, 1, "880.0", 0, 14, "0x910F"]),
          row(510, [0, 0, 1, "880.0", 0, 13, "0x910F"]), // the next note's volume, 14 ms early
          row(524, [0, 0, 1, "698.0", 0, 13, "0x910F"]),
          row(572, [0, 0, 0, "0.0", 0, 13, "0x910F"]),
        ),
        "x",
      ),
    );
    expect(rows.map((r) => r.ms)).toEqual([456, 524, 572]);
    expect(omitted).toEqual([{ count: 1, reason: "stale frequency" }]);
  });

  it("keeps a DTMF pair as one tone state", () => {
    const { rows } = normaliseEvents(
      parseEventsCsv(eventsCsv(row(1), row(29, [1209, 697, 0, "0.0", 0, 0, "0x9104"])), "x"),
    );
    expect(rows[0]!.state).toEqual({ kind: "sounding", hz: 1209, hz2: 697, volume: 0x9104 });
  });

  it("aligns on the first key-down and keeps holds over 200 ms", () => {
    const aligned = alignOnKeys(
      [{ ms: 1030.4, output: "tone", state: { kind: "off" } }],
      [
        { key: "down", downMs: 1000, upMs: 1060 },
        { key: "c", downMs: 2000.6, upMs: 3500.6 },
      ],
    );
    expect(aligned.rows).toEqual([{ ms: 30, output: "tone", state: { kind: "off" } }]);
    expect(aligned.keys).toEqual([
      { ms: 0, key: "down" },
      { ms: 1001, key: "c", holdMs: 1500 },
    ]);
    expect(alignOnKeys([], []).keys).toBeUndefined();
  });
});

describe("the tone's cycle (@loop)", () => {
  const note = (ms: number, hz: number | null): SoundRow => ({
    ms,
    output: "buzzer",
    state: hz === null ? { kind: "off" } : { kind: "sounding", hz, volume: 16 },
  });
  const pass = (start: number, drift = 0): SoundRow[] => [
    note(start, 1319),
    note(start + 115 + drift, 1175),
    note(start + 230 + 2 * drift, null),
  ];

  it("finds the period of two passes, the second drifting within tolerance", () => {
    const rows = [...pass(1000), ...pass(2000, 10), note(3000, 1319)];
    expect(detectLoop(rows)).toEqual({ startMs: 1000, periodMs: 1000 });
  });

  it("accepts a second pass cut short, and ignores the key's beep", () => {
    const beep: SoundRow = {
      ms: 30,
      output: "tone",
      state: { kind: "sounding", hz: 900, volume: 0x9104 },
    };
    expect(detectLoop([beep, ...pass(1000), note(2000, 1319), note(2050, null)])).toEqual({
      startMs: 1000,
      periodMs: 1000,
    });
  });

  it("has no loop for a single pass or a mismatching second pass", () => {
    expect(detectLoop(pass(1000))).toBeUndefined();
    expect(detectLoop([...pass(1000), note(2000, 1319), note(2115, 988)])).toBeUndefined();
    expect(detectLoop([...pass(1000), ...pass(2000, 40)])).toBeUndefined();
  });
});

describe("building goldens", () => {
  const recording = {
    events: eventsCsv(
      row(1),
      row(31, [900, 0, 0, "0.0", 0, 0, "0x9104"]),
      row(171),
      row(993, [0, 0, 1, "1319.0", 1, 16, "0x910F"]),
      row(1300, [0, 0, 0, "0.0", 0, 16, "0x910F"]),
    ),
    keys: keysCsv(["down", 0, 60]),
  };

  it("writes a golden that round-trips through the format", () => {
    const golden = buildSoundGolden(ENTRY, io({ "plan16/test/one": recording }));
    expect(golden).toMatchObject({
      id: "sound/test/one",
      source: "captures/6.39/plan16/test/one",
      state: "factory",
      keys: [{ ms: 0, key: "down" }],
      omitted: [],
    });
    expect(golden.rows).toHaveLength(6);
    const text = serializeSoundGolden(golden);
    expect(parseSoundGolden(text, "one.sound.txt")).toEqual(golden);
  });

  it("names the recording when a file is missing or a loop is required but absent", () => {
    expect(() => buildSoundGolden(ENTRY, io({}))).toThrow(
      "sound/test/one: missing plan16/test/one.events.csv",
    );
    expect(() =>
      buildSoundGolden(ENTRY, io({ "plan16/test/one": { ...recording, keys: undefined! } })),
    ).toThrow("sound/test/one: missing plan16/test/one/keys.csv");
    expect(() =>
      buildSoundGolden({ ...ENTRY, loop: "required" }, io({ "plan16/test/one": recording })),
    ).toThrow(SoundCaptureError);
  });

  it("shares equal note recordings and names sounding ones by their text", () => {
    const beep = (onset: number) => ({
      events: eventsCsv(row(1), row(onset, [900, 0, 0, "0.0", 0, 0, "0x9104"]), row(onset + 140)),
      keys: keysCsv(["menu", 0, 60]),
    });
    const notes = noteGoldens(
      io({
        "plan16/notes/1-1": beep(30),
        "plan16/notes/1-3": beep(31),
        "plan16/notes/1-8-1-1": beep(40),
        "plan16/notes/4-6-3": {
          events: eventsCsv(row(1), row(25, [0, 0, 1, "1000.0", 0, 22, "0x910F"]), row(310)),
          keys: keysCsv(["menu", 0, 60]),
        },
        "plan16/notes/invalid-shortcut": beep(30),
      }),
    );
    expect(notes.map((g) => [g.id, g.note])).toEqual([
      ["sound/note/1-1", "OK on 1-1, 1-3 (factory)."],
      ["sound/note/1-8-1-1", "OK on 1-8-1-1 (factory)."],
      ["sound/note/4-6-3", '"Not allowed" (Warning tones On) after OK on 4-6-3 (factory).'],
    ]);
  });

  it("refuses a sounding note without a text", () => {
    expect(() =>
      noteGoldens(
        io({
          "plan16/notes/1-1": {
            events: eventsCsv(row(1), row(25, [1750, 0, 0, "0.0", 0, 0, "0x9105"]), row(300)),
            keys: keysCsv(["menu", 0, 60]),
          },
        }),
      ),
    ).toThrow("sound/note/1-1: a sounding note needs its text in NOTE_TEXTS");
  });
});

describe("the capture set table", () => {
  it("has unique ids and covers every tone once per family", () => {
    const ids = SOUND_CAPTURE_SET.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const family of [
      "ringing-tone",
      "ringing-tone/level-5",
      "alert/ascending",
      "ringing-volume/tone",
    ]) {
      const tones = ids.filter((id) => new RegExp(`^sound/${family}/\\d\\d-`).test(id));
      expect(tones, family).toHaveLength(35);
    }
    expect(toneSlug(9)).toBe("09-thats-it");
    expect(toneSlug(27)).toBe("27-hurdy-gurdy");
  });

  it("names no golden after plan 16", () => {
    expect(SOUND_CAPTURE_SET.filter((e) => e.status === "pending:16")).toEqual([]);
  });
});
