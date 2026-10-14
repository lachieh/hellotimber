import { describe, expect, it } from "vite-plus/test";
import {
  creatureShown,
  framePeriod,
  GameCaptureError,
  gameCaptureSet,
  GRACE_MS,
  inputFromKeys,
  isBoardFrame,
  numberTicks,
  periodFixture,
  PERIOD_LEVELS,
  playBackToBack,
  scoreKey,
  tickName,
  tickRow,
  tickStillSelection,
  type GameCaptureIo,
  type GameRecordingFrame,
  type PlayedFrame,
} from "../scripts/game-capture-set.ts";
import { LCD_HEIGHT, LCD_WIDTH } from "../scripts/golden-format.ts";

/** A Snake II board with a mark at cell `x` of row 4, optional score and creature HUD pixels. */
function board(x: number, opts: { score?: number; creature?: boolean } = {}): Uint8Array {
  const pixels = new Uint8Array(LCD_WIDTH * LCD_HEIGHT);
  const set = (px: number, py: number): void => {
    pixels[py * LCD_WIDTH + px] = 1;
  };
  for (let px = 0; px < LCD_WIDTH; px++) [6, 8, 47].forEach((py) => set(px, py));
  for (let py = 8; py < LCD_HEIGHT; py++) [0, 83].forEach((px) => set(px, py));
  set(2 + 4 * x, 27);
  for (let i = 0; i < (opts.score ?? 0); i++) set(1 + i, 2);
  if (opts.creature) set(70, 2);
  return pixels;
}

function menu(): Uint8Array {
  const pixels = new Uint8Array(LCD_WIDTH * LCD_HEIGHT);
  pixels[10 * LCD_WIDTH + 10] = 1;
  return pixels;
}

/** Frames at the given start times with the given pixels; durations chain to the next start. */
function recording(rows: readonly [number, Uint8Array][], endMs?: number): GameRecordingFrame[] {
  return rows.map(([startMs, pixels], i) => ({
    pixels,
    startMs,
    durationMs: (rows[i + 1]?.[0] ?? endMs ?? startMs + 1000) - startMs,
  }));
}

function played(rows: readonly [number, Uint8Array][]): PlayedFrame[] {
  return playBackToBack([{ dir: "rec", frames: recording(rows) }]).frames;
}

describe("pixel features", () => {
  it("recognises the board, the score digits and the creature HUD", () => {
    expect(isBoardFrame(board(3))).toBe(true);
    expect(isBoardFrame(menu())).toBe(false);
    const ruleless = board(3);
    ruleless[7 * LCD_WIDTH + 40] = 1;
    expect(isBoardFrame(ruleless)).toBe(false);
    expect(scoreKey(board(3, { score: 2 }))).not.toBe(scoreKey(board(3)));
    expect(creatureShown(board(3, { creature: true }))).toBe(true);
    expect(creatureShown(board(3))).toBe(false);
  });
});

describe("numberTicks", () => {
  it("numbers board frames at least half a period apart, from the first board frame", () => {
    const ticks = numberTicks(
      played([
        [0, menu()],
        [56, board(0)],
        [671, board(1)],
        [1306, board(2)],
      ]),
      635,
    );
    expect(ticks.map((t) => [t.tick, t.startMs, t.virtual])).toEqual([
      [0, 56, false],
      [1, 671, false],
      [2, 1306, false],
    ]);
  });

  it("keeps a redraw in two bursts as one tick: first frame for the time, last for the still", () => {
    const partial = board(2);
    const ticks = numberTicks(
      played([
        [0, board(0)],
        [635, board(1)],
        [1270, partial],
        [1283, board(3)],
        [1905, board(4)],
      ]),
      635,
    );
    expect(ticks.map((t) => t.tick)).toEqual([0, 1, 2, 3]);
    expect(ticks[2]!.first!.pixels).toBe(partial);
    expect(ticks[2]!.last!.startMs).toBe(1283);
  });

  it("skips non-board frames and repeated pixels", () => {
    const ticks = numberTicks(
      played([
        [0, board(0)],
        [300, menu()],
        [635, board(0)],
        [700, board(1)],
      ]),
      635,
    );
    expect(ticks.map((t) => [t.tick, t.startMs])).toEqual([
      [0, 0],
      [1, 700],
    ]);
  });

  it("infers a blocked tick (no frame) from a grace-length gap", () => {
    const ticks = numberTicks(
      played([
        [0, board(0)],
        [635, board(1)],
        [635 + 635 + GRACE_MS, board(2)],
        [635 + 635 + GRACE_MS + 635, board(3)],
      ]),
      635,
    );
    expect(ticks.map((t) => [t.tick, t.startMs, t.virtual])).toEqual([
      [0, 0, false],
      [1, 635, false],
      [2, 1270, true],
      [3, 1363, false],
      [4, 1998, false],
    ]);
  });

  it("plays recordings back to back on one clock", () => {
    const { frames, offsets } = playBackToBack([
      { dir: "a", frames: recording([[0, board(0)]], 500) },
      {
        dir: "b",
        frames: recording([
          [1, board(0)],
          [100, board(1)],
        ]),
      },
    ]);
    expect(offsets.get("b")).toBe(500);
    expect(frames.map((f) => [f.dir, f.frame, f.startMs])).toEqual([
      ["a", 0, 0],
      ["b", 0, 501],
      ["b", 1, 600],
    ]);
  });
});

describe("inputFromKeys", () => {
  const ticks = numberTicks(
    played([
      [0, menu()],
      [56, board(0)],
      [671, board(1)],
      [1306, board(2)],
      [1941, board(3)],
    ]),
    635,
  );

  it("gives each key the last tick before it is processed; the starting Select is not input", () => {
    expect(
      inputFromKeys(
        ticks,
        [
          { key: "menu", pressMs: 0 },
          { key: "8", pressMs: 156 },
          { key: "2", pressMs: 1500 },
          { key: "menu", pressMs: 1600 },
        ],
        "rec",
      ),
    ).toEqual([
      { tick: 0, key: "8" },
      { tick: 2, key: "2" },
      { tick: 2, key: "navi" },
    ]);
  });

  it("throws, naming the recording, for a key whose latency window holds a tick", () => {
    expect(() => inputFromKeys(ticks, [{ key: "2", pressMs: 1900 }], "plan23/keys/x")).toThrow(
      GameCaptureError,
    );
    expect(() => inputFromKeys(ticks, [{ key: "2", pressMs: 1900 }], "plan23/keys/x")).toThrow(
      /plan23\/keys\/x: key 2 at 1900 ms is ambiguous: tick 3 starts at 1941 ms/,
    );
    expect(() => inputFromKeys(ticks, [{ key: "left", pressMs: 300 }], "r")).toThrow(/unknown key/);
  });

  it("puts a key pressed during the grace on the blocked tick", () => {
    const grace = numberTicks(
      played([
        [0, board(0)],
        [635, board(1)],
        [1363, board(2)],
      ]),
      635,
    );
    expect(inputFromKeys(grace, [{ key: "6", pressMs: 1270 + 40 }], "r")).toEqual([
      { tick: 2, key: "6" },
    ]);
  });
});

describe("tick stills and the period fixture", () => {
  const long = numberTicks(
    played(
      Array.from({ length: 60 }, (_, i): [number, Uint8Array] => [
        i * 635,
        board(i % 20, { score: i >= 30 ? 1 : 0, creature: i >= 40 && i < 45 }),
      ]),
    ),
    635,
  );

  it("selects tick 0, HUD changes ±1, every 25th tick and the last 12 for games", () => {
    expect(tickStillSelection(long).map(tickName)).toEqual(
      [
        0, 25, 29, 30, 31, 39, 40, 41, 44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
      ].map(tickName),
    );
  });

  it("selects meals only, or each key's tick and the two after it", () => {
    expect(tickStillSelection(long, "meals")).toEqual([0, 30, 59]);
    expect(tickStillSelection(long, "input", [{ tick: 2, key: "2" }])).toEqual([2, 3, 4]);
  });

  it("measures the first tick and every interval of a level", () => {
    const ticks = numberTicks(
      played([
        [0, menu()],
        [56, board(0)],
        [62, board(1)],
        [70, board(2)],
        [78, board(3)],
        [100, board(4)],
      ]),
      8,
    );
    expect(tickRow(175, ticks, "r")).toEqual({ level: 175, firstMs: 6, intervalsMs: [8, 8, 22] });
    expect(() => tickRow(10, ticks.slice(0, 3), "plan23/periods/10")).toThrow(
      /plan23\/periods\/10: 3 tick frames, need the start and 3 ticks/,
    );
    expect(
      framePeriod(
        played([
          [0, board(0)],
          [8, board(1)],
          [16, board(2)],
          [38, board(3)],
        ]),
      ),
    ).toBe(8);
  });
});

describe("gameCaptureSet on synthetic recordings", () => {
  /** Every recording: the menu, then a level-1 game ticking 14 times; keys: Select, 2 after tick 2. */
  const io: GameCaptureIo = {
    recording: () =>
      recording([
        [0, menu()],
        ...Array.from({ length: 15 }, (_, i): [number, Uint8Array] => [
          56 + i * 635,
          board(i % 20),
        ]),
      ]),
    keys: () => [
      { tick: -1, key: "menu", pressMs: 0 },
      { tick: 2, key: "2", pressMs: 56 + 2 * 635 + 285 },
    ],
  };
  const entries = gameCaptureSet(io);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  it("names every golden game/snake/<name> with unique ids", () => {
    expect(entries.every((entry) => entry.id.startsWith("game/snake/"))).toBe(true);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  });

  it("cuts a ticks timeline after tick 8 with the New game frame as trigger", () => {
    const ticks = byId.get("game/snake/ticks-l1")!;
    expect(ticks.kind).toBe("timeline");
    expect(ticks.prefer.triggerFrame).toBe(1);
    expect(ticks.prefer.source).toEqual({
      kind: "composite",
      parts: [{ dir: "plan23/ticks/1", from: 0, to: 9 }],
    });
  });

  it("turns keys.csv into input and names tick stills t<tick>", () => {
    const bot = byId.get("game/snake/bot-long")!;
    expect(bot.input).toEqual([{ tick: 2, key: "2" }]);
    const source = bot.prefer.source;
    if (source.kind !== "frames") throw new Error(source.kind);
    expect(source.frames[0]).toEqual({ name: "t0000", dir: "plan23/bot/long/game", frame: 1 });
    const keys = byId.get("game/snake/keys-right-2")!.prefer.source;
    if (keys.kind !== "frames") throw new Error(keys.kind);
    expect(keys.frames.map((f) => f.name)).toEqual(["t0002", "t0003", "t0004"]);
  });

  it("uses the frame-read input of the level-175 recordings", () => {
    expect(byId.get("game/snake/virgin-game")!.input).toEqual([
      { tick: 3, key: "2" },
      { tick: 7, key: "4" },
    ]);
  });

  it("builds the period fixture for every level 10..175", () => {
    const fixture = periodFixture(io);
    expect(fixture.rows.map((row) => row.level)).toEqual(PERIOD_LEVELS);
    expect(fixture.rows[0]).toEqual({
      level: 10,
      firstMs: 635,
      intervalsMs: Array.from({ length: 13 }, () => 635),
    });
    expect(fixture.timings[0]).toBe("plan23/periods/10/timings.csv");
  });

  it("throws, naming the recording, when a capture is missing", () => {
    expect(() => gameCaptureSet({ recording: () => undefined, keys: () => undefined })).toThrow(
      /plan23\/.*: missing capture/,
    );
  });
});
