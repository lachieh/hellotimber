import { describe, expect, it } from "vite-plus/test";
import {
  GameScreen,
  ReplayFormatError,
  checkReplay,
  localGame,
  parseReplay,
  recordReplay,
  serializeReplay,
  type GameReplay,
} from "../src/index";
import { counterGame, FONTS, probeGame, startOf } from "./support/counter-game";

function art(screen: GameScreen): string[] {
  return Array.from({ length: 48 }, (_, y) =>
    Array.from({ length: 84 }, (_, x) => (screen.get(x, y) ? "#" : ".")).join(""),
  );
}

const FIRST = new GameScreen();
FIRST.fill(2, 2, 3, 3);
const SECOND = new GameScreen();
SECOND.fill(80, 40, 4, 8);
SECOND.set(0, 0);

const HAND_WRITTEN = [
  "game-replay 1",
  "game: counter",
  "seed: 4294967295",
  "level: 3",
  "mode: quick",
  "choices: board=0 step=1",
  "top-score: 12",
  "storage: AQID",
  "input: 0:5 400:6 900:up+ 950:up- 950:# 1200:*+ 1200:0 1200:*- 1500:down",
  "until: 2000",
  "note: hand-written, with every form.",
  "",
  "@effects",
  "# ms   kind    value",
  "0      sound   eat",
  "900    sound   notes 440x100 880x50",
  "900    sound   notes",
  "950    vibrate 480",
  "1000   save    AQ==",
  "1000   save    -",
  "1500   sound   crash",
  "1500   over    5124",
  "",
  "@frames",
  "t0",
  ...art(FIRST),
  "t1500",
  ...art(SECOND),
  "",
  "@hash fnv1a32 0x5c3e91a7",
  "",
].join("\n");

/** HAND_WRITTEN with one line replaced; `line` is 1-based, as in the errors. */
function edited(line: number, text: string | undefined, source = HAND_WRITTEN): string {
  const lines = source.split("\n");
  if (text === undefined) lines.splice(line - 1, 1);
  else lines[line - 1] = text;
  return lines.join("\n");
}

describe("parseReplay", () => {
  it("reads the header, the effects, the frames and the hash", () => {
    const replay = parseReplay(HAND_WRITTEN);
    expect(replay.game).toBe("counter");
    expect(replay.start).toEqual({
      seed: 4294967295,
      level: 3,
      mode: "quick",
      choices: { board: 0, step: 1 },
      topScore: 12,
      storage: Uint8Array.of(1, 2, 3),
    });
    expect(replay.until).toBe(2000);
    expect(replay.note).toBe("hand-written, with every form.");
    expect(replay.effects).toEqual([
      { kind: "sound", at: 0, sound: "eat" },
      {
        kind: "sound",
        at: 900,
        sound: {
          notes: [
            { hz: 440, ms: 100 },
            { hz: 880, ms: 50 },
          ],
        },
      },
      { kind: "sound", at: 900, sound: { notes: [] } },
      { kind: "vibrate", at: 950, ms: 480 },
      { kind: "save", at: 1000, bytes: Uint8Array.of(1) },
      { kind: "save", at: 1000, bytes: new Uint8Array(0) },
      { kind: "sound", at: 1500, sound: "crash" },
      { kind: "over", at: 1500, score: 5124 },
    ]);
    expect(replay.frames).toEqual([
      { at: 0, frame: FIRST.pack() },
      { at: 1500, frame: SECOND.pack() },
    ]);
    expect(replay.hash).toBe(0x5c3e91a7);
  });

  it("reads `k` as a key-down and a key-up at that ms, and `k+`/`k-` as each alone", () => {
    expect(parseReplay(HAND_WRITTEN).input).toEqual([
      { at: 0, key: "5", down: true },
      { at: 0, key: "5", down: false },
      { at: 400, key: "6", down: true },
      { at: 400, key: "6", down: false },
      { at: 900, key: "up", down: true },
      { at: 950, key: "up", down: false },
      { at: 950, key: "#", down: true },
      { at: 950, key: "#", down: false },
      { at: 1200, key: "*", down: true },
      { at: 1200, key: "0", down: true },
      { at: 1200, key: "0", down: false },
      { at: 1200, key: "*", down: false },
      { at: 1500, key: "down", down: true },
      { at: 1500, key: "down", down: false },
    ]);
  });

  it("reads empty values", () => {
    let text = edited(5, "mode:");
    text = edited(6, "choices:", text);
    text = edited(8, "storage:", text);
    text = edited(9, "input:", text);
    text = edited(11, "note:", text);
    text = edited(22, "1500   over    -", text);
    const replay = parseReplay(text);
    expect(replay.start.mode).toBe("");
    expect(replay.start.choices).toEqual({});
    expect(replay.start.storage).toEqual(new Uint8Array(0));
    expect(replay.input).toEqual([]);
    expect(replay.note).toBe("");
    expect(replay.effects.at(-1)).toEqual({ kind: "over", at: 1500, score: undefined });
    expect(serializeReplay(replay)).toBe(text);
  });

  it("reads a replay without effects", () => {
    const lines = HAND_WRITTEN.split("\n");
    lines.splice(14, 8);
    const replay = parseReplay(lines.join("\n"));
    expect(replay.effects).toEqual([]);
    expect(serializeReplay(replay)).toBe(lines.join("\n"));
  });

  describe("names the file and line of what it cannot read", () => {
    const cases: readonly (readonly [string, string, number, string])[] = [
      ["another format", edited(1, "game-replay 2"), 1, "game-replay 1"],
      ["a header key out of order", edited(3, "level: 3"), 3, '"seed:"'],
      ["a missing header key", edited(7, undefined), 7, '"top-score:"'],
      ["a game that is not an id", edited(2, "game: Counter Game"), 2, "game"],
      ["a seed past uint32", edited(3, "seed: 4294967296"), 3, "seed"],
      ["a seed that is not a number", edited(3, "seed: 0x10"), 3, "seed"],
      ["a zero level", edited(4, "level: 0"), 4, "level"],
      ["a malformed choice", edited(6, "choices: board"), 6, "board"],
      ["a repeated choice", edited(6, "choices: step=0 step=1"), 6, "step"],
      ["a negative top score", edited(7, "top-score: -1"), 7, "top-score"],
      ["storage that is not base64", edited(8, "storage: AQI"), 8, "storage"],
      ["an input without a key", edited(9, "input: 400"), 9, '"400"'],
      ["an unknown key", edited(9, "input: 400:select"), 9, '"400:select"'],
      ["input going back in time", edited(9, "input: 400:5 399:6"), 9, "399"],
      ["input after the end", edited(9, "input: 400:5 2001:6"), 9, "2001"],
      ["an until that is not a whole ms", edited(10, "until: 20.5"), 10, "until"],
      ["a missing blank line", edited(12, "@effects"), 12, "blank"],
      ["a missing @effects", edited(13, "@frames"), 13, "@effects"],
      ["an effect without a kind", edited(15, "0"), 15, "effect"],
      ["an unknown effect", edited(15, "0      beep    eat"), 15, "beep"],
      ["an unknown sound", edited(15, "0      sound   beep"), 15, "beep"],
      ["a malformed note", edited(16, "900    sound   notes 440"), 16, '"440"'],
      ["a zero-length note", edited(16, "900    sound   notes 440x0"), 16, '"440x0"'],
      ["a vibration without a length", edited(18, "950    vibrate"), 18, "vibrate"],
      ["a save that is not base64", edited(19, "1000   save    ****"), 19, "save"],
      ["a score that is not a number", edited(22, "1500   over    high"), 22, "over"],
      ["effects going back in time", edited(18, "899    vibrate 480"), 18, "899"],
      ["a missing @frames", edited(24, "@frame"), 24, "@frames"],
      ["a frame label without a time", edited(25, "frame0"), 25, "t<ms>"],
      ["a short frame row", edited(30, ".".repeat(83)), 30, "84"],
      ["a frame row of other characters", edited(30, "x".repeat(84)), 30, "#"],
      ["a frame of 47 rows", edited(30, undefined), 73, "48 rows"],
      ["frames out of order", edited(74, "t0"), 74, "t0"],
      ["a missing hash", edited(124, undefined), 124, "@hash"],
      ["a hash in another form", edited(124, "@hash fnv1a32 5c3e91a7"), 124, "@hash"],
      ["text after the hash", edited(125, "more"), 125, "end"],
    ];

    it.each(cases)("%s", (_name, text, line, detail) => {
      let error: unknown;
      try {
        parseReplay(text, "goldens/counter.replay");
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(ReplayFormatError);
      expect((error as ReplayFormatError).message).toContain(`goldens/counter.replay:${line}: `);
      expect((error as ReplayFormatError).message).toContain(detail);
      expect((error as ReplayFormatError).line).toBe(line);
    });

    it("says where a truncated file ends", () => {
      const text = HAND_WRITTEN.split("\n").slice(0, 40).join("\n");
      expect(() => parseReplay(text)).toThrow(/^replay:41: .*48 rows/);
    });
  });
});

describe("serializeReplay", () => {
  it("writes what parseReplay read, byte for byte", () => {
    expect(serializeReplay(parseReplay(HAND_WRITTEN))).toBe(HAND_WRITTEN);
  });

  it("round-trips a replay object", () => {
    const replay = parseReplay(HAND_WRITTEN);
    expect(parseReplay(serializeReplay(replay))).toEqual(replay);
  });

  it("writes choices in slug order and widens the ms column for long sessions", () => {
    const replay = parseReplay(HAND_WRITTEN);
    const long: GameReplay = {
      ...replay,
      start: { ...replay.start, choices: { step: 1, board: 0 } },
      until: 12_345_678,
      effects: [{ kind: "vibrate", at: 12_345_678, ms: 5 }],
    };
    const lines = serializeReplay(long).split("\n");
    expect(lines[5]).toBe("choices: board=0 step=1");
    expect(lines.slice(13, 15)).toEqual(["# ms      kind    value", "12345678  vibrate 5"]);
    expect(parseReplay(lines.join("\n"))).toEqual(long);
  });

  it("refuses a replay it could not read back", () => {
    const replay = parseReplay(HAND_WRITTEN);
    expect(() => serializeReplay({ ...replay, note: "two\nlines" })).toThrow("note");
    expect(() => serializeReplay({ ...replay, start: { ...replay.start, mode: " x" } })).toThrow(
      "mode",
    );
  });
});

const counter = localGame(counterGame);
const INPUT = "300:5 700:1 900:2 1200:3 1500:8+ 2100:8- 2600:0 3000:5 3500:5 3500:9";
const START = startOf({ level: 2, choices: { step: 1 }, storage: Uint8Array.of(7) });

describe("recordReplay", () => {
  const replay = recordReplay(counter, START, INPUT, 9000, { note: "counter, every key." });

  it("records the start, the keys and the note", () => {
    expect(replay.game).toBe("counter");
    expect(replay.start).toEqual(START);
    expect(replay.note).toBe("counter, every key.");
    expect(serializeReplay(replay).split("\n")[8]).toBe(`input: ${INPUT}`);
  });

  it("records every effect with the ms of its call", () => {
    const tune = {
      notes: [
        { hz: 523, ms: 80 },
        { hz: 659, ms: 80 },
        { hz: 784, ms: 160 },
      ],
    };
    // 7 saved + 20 at 300; the held 8 adds one at 1700, 1760, … 2060 (seven); 20 at 3500.
    expect(replay.effects).toEqual([
      { kind: "sound", at: 300, sound: "eat" },
      { kind: "sound", at: 700, sound: tune },
      { kind: "vibrate", at: 900, ms: 120 },
      { kind: "save", at: 1200, bytes: Uint8Array.of(27) },
      { kind: "sound", at: 3500, sound: "eat" },
      { kind: "sound", at: 6000, sound: "crash" },
      { kind: "vibrate", at: 6000, ms: 300 },
      { kind: "over", at: 6000, score: 54 },
    ]);
  });

  it("ends at over, earlier than the time asked for", () => {
    expect(replay.until).toBe(6000);
  });

  it("holds the frame standing at 0, at every vibrate or over, and at the end", () => {
    expect(replay.frames.map((frame) => frame.at)).toEqual([0, 900, 6000]);
    for (const { frame } of replay.frames) expect(frame.length).toBe(504);
  });

  it("holds a frame every 10 000 ms, and the one at the end of a run that is not over", () => {
    const paused = recordReplay(counter, START, "1000:0", 25_000);
    expect(paused.until).toBe(25_000);
    expect(paused.frames.map((frame) => frame.at)).toEqual([0, 10_000, 20_000, 25_000]);
    expect(paused.frames[1]!.frame).toEqual(paused.frames[3]!.frame);
    expect(paused.effects).toEqual([]);
  });

  it("hashes every distinct frame with the ms it was drawn at", () => {
    const again = recordReplay(counter, START, INPUT, 9000);
    expect(again.hash).toBe(replay.hash);
    // The same frames 1 ms later: only the hash can tell.
    const shifted = recordReplay(
      counter,
      START,
      INPUT.replace("3500:5 3500:9", "3501:5 3501:9"),
      9000,
    );
    expect(shifted.effects.map((effect) => effect.at)).toContain(3501);
    expect(shifted.frames).toEqual(replay.frames);
    expect(shifted.hash).not.toBe(replay.hash);
  });

  it("keeps only the keys played before the end", () => {
    const short = recordReplay(counter, START, "100:5 400:* 500:5 600:5", 9000);
    expect(short.until).toBe(400);
    expect(short.input).toEqual([
      { at: 100, key: "5", down: true },
      { at: 100, key: "5", down: false },
      { at: 400, key: "*", down: true },
    ]);
  });

  it("takes the keys as text or as a list", () => {
    const listed = recordReplay(counter, START, parseReplay(serializeReplay(replay)).input, 9000, {
      note: "counter, every key.",
    });
    expect(listed).toEqual(replay);
  });

  it("refuses keys it could not write down", () => {
    expect(() => recordReplay(counter, START, "500:5 400:5", 9000)).toThrow("400");
    expect(() => recordReplay(counter, START, "500:5", 400)).toThrow("500");
    expect(() => recordReplay(counter, START, "500:select", 900)).toThrow("select");
  });

  it("throws when the game fails, saying when", () => {
    const broken = localGame(
      probeGame({
        update: (now) => {
          if (now === 300) throw new Error("boom");
          return 100;
        },
      }).definition,
    );
    expect(() => recordReplay(broken, startOf(), "", 1000)).toThrow("300 ms: game: boom");
  });
});

describe("checkReplay", () => {
  const replay = recordReplay(counter, START, INPUT, 9000);
  const text = serializeReplay(replay);
  const lines = text.split("\n");
  const lineOf = (start: string) => lines.findIndex((line) => line.startsWith(start));
  const withLine = (index: number, line: string) =>
    parseReplay(lines.map((old, i) => (i === index ? line : old)).join("\n"));

  it("passes the replay it recorded, from the object and from its text", () => {
    expect(checkReplay(counter, replay)).toBeUndefined();
    expect(checkReplay(counter, parseReplay(text))).toBeUndefined();
  });

  it.each([1, 17, 1000])("passes the same replay with advanceMs %i", (advanceMs) => {
    expect(checkReplay(counter, replay, { advanceMs })).toBeUndefined();
  });

  it("passes with the fonts a game is given", () => {
    expect(
      checkReplay(counter, replay, { fonts: { ...FONTS, small: FONTS.game } }),
    ).toBeUndefined();
  });

  it("reports an edited effect with its ms", () => {
    const index = lineOf("900 ");
    const mismatch = checkReplay(counter, withLine(index, "900    vibrate 121"));
    expect(mismatch?.at).toBe(900);
    expect(mismatch?.message).toBe(
      ["effect 3 differs at 900 ms", "  replay: 900 vibrate 121", "  game:   900 vibrate 120"].join(
        "\n",
      ),
    );
  });

  it("reports an edited effect ms with the earlier of the two", () => {
    const index = lineOf("3500 ");
    const mismatch = checkReplay(counter, withLine(index, "3400   sound   eat"));
    expect(mismatch?.at).toBe(3400);
    expect(mismatch?.message).toContain("replay: 3400 sound eat");
    expect(mismatch?.message).toContain("game:   3500 sound eat");
  });

  it("reports an effect the replay lacks, and one the game lacks", () => {
    const index = lineOf("6000   over");
    const missing = lines.filter((_, i) => i !== index).join("\n");
    const lacking = checkReplay(counter, parseReplay(missing));
    expect(lacking?.at).toBe(6000);
    expect(lacking?.message).toContain("replay: (none)");
    expect(lacking?.message).toContain("game:   6000 over 54");

    const extra = [...lines.slice(0, index + 1), "6000   vibrate 5", ...lines.slice(index + 1)];
    const surplus = checkReplay(counter, parseReplay(extra.join("\n")));
    expect(surplus?.message).toContain("replay: 6000 vibrate 5");
    expect(surplus?.message).toContain("game:   (none)");
  });

  it("reports an edited pixel with its ms and a row diff", () => {
    const label = lines.indexOf("t900");
    // Row 3 of the frame at 900 ms: one pixel added at x=10, and the frame's own ink untouched.
    const row = lines[label + 1 + 3]!;
    expect(row[10]).toBe(".");
    const mismatch = checkReplay(
      counter,
      withLine(label + 1 + 3, `${row.slice(0, 10)}#${row.slice(11)}`),
    );
    expect(mismatch?.at).toBe(900);
    const report = mismatch!.message.split("\n");
    expect(report[0]).toBe(
      "frame t900 differs: 1 px (0 only in the game, 1 only in the replay); first at (x=10, y=3)",
    );
    expect(report[1]).toBe("# both  + only the game  - only the replay  . neither");
    expect(report[2]).toBe(`y=3   ${row.slice(0, 10)}-${row.slice(11)}`);
    expect(report.length).toBe(3);
  });

  it("marks ink only the game drew with +", () => {
    const label = lines.indexOf("t0");
    const y = lines.slice(label + 1, label + 49).findIndex((row) => row.includes("#"));
    const row = lines[label + 1 + y]!;
    const x = row.indexOf("#");
    const mismatch = checkReplay(
      counter,
      withLine(label + 1 + y, `${row.slice(0, x)}.${row.slice(x + 1)}`),
    );
    expect(mismatch?.at).toBe(0);
    expect(mismatch?.message).toContain(`first at (x=${x}, y=${y})`);
    expect(mismatch?.message.split("\n")[2]![6 + x]).toBe("+");
  });

  it("reports the earliest difference", () => {
    const frame = lines.indexOf("t900");
    const effect = lineOf("700 ");
    const both = lines.map((line, i) =>
      i === frame + 1 ? "#".repeat(84) : i === effect ? "700    sound   crash" : line,
    );
    expect(checkReplay(counter, parseReplay(both.join("\n")))?.at).toBe(700);
  });

  it("reports a checkpoint the game does not reach", () => {
    const index = lines.indexOf("t900");
    const mismatch = checkReplay(counter, withLine(index, "t800"));
    expect(mismatch?.at).toBe(800);
    expect(mismatch?.message).toContain("t800");
    expect(mismatch?.message).toContain("t900");
  });

  it("reports a hash that differs when every checkpoint matches", () => {
    const mismatch = checkReplay(counter, { ...replay, hash: (replay.hash ^ 1) >>> 0 });
    expect(mismatch?.at).toBeUndefined();
    expect(mismatch?.message).toContain("@hash");
    expect(mismatch?.message).toContain(`0x${replay.hash.toString(16).padStart(8, "0")}`);
  });

  it("reports a different start", () => {
    const mismatch = checkReplay(counter, { ...replay, start: { ...replay.start, seed: 1 } });
    expect(mismatch?.at).toBe(0);
    expect(mismatch?.message).toContain("frame t0 differs");
  });

  it("lets `until` run past the game's own end", () => {
    expect(checkReplay(counter, { ...replay, until: 6500 })).toBeUndefined();
  });

  it("reports a game that fails", () => {
    const broken = localGame({
      manifest: counterGame.manifest,
      create(ctx) {
        const instance = counterGame.create(ctx);
        return {
          ...instance,
          update(nowMs) {
            if (nowMs > 2000) throw new Error("boom");
            return instance.update(nowMs);
          },
        };
      },
    });
    const mismatch = checkReplay(broken, replay);
    expect(mismatch?.at).toBe(2060);
    expect(mismatch?.message).toBe("the game failed at 2060 ms: game: boom");
  });

  it("throws at a session that leaves its wake standing, instead of spinning", () => {
    const stuck = {
      manifest: counter.manifest,
      start: () => ({
        keyDown: () => {},
        keyUp: () => {},
        advance: () => {},
        wake: () => 130,
        frame: () => undefined,
        drain: () => [],
        failure: undefined,
        dispose: () => {},
      }),
    };
    expect(() => checkReplay(stuck, replay)).toThrow("130 ms");
  });

  it("refuses a replay of another game", () => {
    expect(() => checkReplay(counter, { ...replay, game: "2048" })).toThrow("2048");
  });
});
