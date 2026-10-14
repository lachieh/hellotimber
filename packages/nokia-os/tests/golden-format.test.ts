import { describe, expect, it } from "vite-plus/test";
import {
  GoldenFormatError,
  LCD_HEIGHT,
  LCD_WIDTH,
  parseGolden,
  parseTickGolden,
  serializeGolden,
  serializeTickGolden,
  type Golden,
  type TickGolden,
} from "../scripts/golden-format.ts";

const SHA = "0123456789abcdef".repeat(4);

function pixels(...lit: [number, number][]): Uint8Array {
  const out = new Uint8Array(LCD_WIDTH * LCD_HEIGHT);
  for (const [x, y] of lit) out[y * LCD_WIDTH + x] = 1;
  return out;
}

const timelineGolden: Golden = {
  id: "menu/05-tones.anim",
  status: "asserted",
  source: "captures/6.39/menu-anim-long/05-tones",
  sourceSha256: SHA,
  triggerFrame: 1,
  note: "▼ from Call register at frame 1; frame 0 is the previous screen.",
  omitted: [],
  images: [
    { name: "a", pixels: pixels([0, 0], [83, 47]) },
    { name: "b", pixels: pixels([1, 1]) },
  ],
  timeline: [
    { frame: 0, image: "a", startMs: 1, durationMs: 75, lowerBound: false, lcd: "normal", leds: 3 },
    {
      frame: 1,
      image: "b",
      startMs: 76,
      durationMs: 193,
      lowerBound: false,
      lcd: "normal",
      leds: 3,
    },
    {
      frame: 2,
      image: "a",
      startMs: 269,
      durationMs: 500,
      lowerBound: true,
      lcd: "normal",
      leds: 3,
    },
  ],
};

const stillGolden: Golden = {
  id: "menu/12-profiles.sub",
  status: "pending:17",
  source: "captures/6.39/menu/12-profiles/sub",
  sourceSha256: SHA,
  omitted: [
    { name: "06", reason: "uninitialised EEPROM name" },
    { name: "07", reason: "duplicate, wraps" },
  ],
  images: [
    { name: "01", pixels: pixels([5, 5]) },
    { name: "02", pixels: pixels() },
  ],
};

/** Text of the valid timeline golden, split into lines for targeted corruption. */
function lines(golden: Golden = timelineGolden): string[] {
  return serializeGolden(golden).split("\n");
}

function lineIndex(all: string[], predicate: (line: string) => boolean): number {
  const i = all.findIndex(predicate);
  if (i < 0) throw new Error("line not found");
  return i;
}

function parseError(text: string): string {
  try {
    parseGolden(text, "bad.lcd.txt");
  } catch (error) {
    expect(error).toBeInstanceOf(GoldenFormatError);
    return (error as Error).message;
  }
  throw new Error("expected a parse error");
}

describe("golden format", () => {
  it("serializes the documented layout", () => {
    const text = serializeGolden(timelineGolden);
    const all = text.split("\n");
    expect(all.slice(0, 9)).toEqual([
      "lcd-golden 1",
      "id: menu/05-tones.anim",
      "status: asserted",
      "source: captures/6.39/menu-anim-long/05-tones",
      `source-sha256: ${SHA}`,
      "trigger-frame: 1",
      "note: ▼ from Call register at frame 1; frame 0 is the previous screen.",
      "omitted: none",
      "",
    ]);
    expect(all[9]).toBe("@image a");
    expect(all[10]).toBe("#" + ".".repeat(82) + ".");
    expect(all[10 + 47]).toBe(".".repeat(83) + "#");
    expect(all.slice(-6)).toEqual([
      "@timeline",
      "# frame image start_ms duration_ms lcd    leds",
      "0      a     1        75          normal 3",
      "1      b     76       193         normal 3",
      "2      a     269      500+        normal 3",
      "",
    ]);
    expect(text.endsWith("\n")).toBe(true);
  });

  it("round-trips timeline and still fixtures", () => {
    for (const golden of [timelineGolden, stillGolden]) {
      const text = serializeGolden(golden);
      const parsed = parseGolden(text, "x.lcd.txt");
      expect(parsed).toEqual(golden);
      expect(serializeGolden(parsed)).toBe(text);
    }
  });

  it("writes omissions as a comma list and before-recording triggers", () => {
    const text = serializeGolden({ ...timelineGolden, triggerFrame: "before-recording" });
    expect(text).toContain("\ntrigger-frame: before-recording\n");
    expect(serializeGolden(stillGolden)).toContain(
      "\nomitted: 06 (uninitialised EEPROM name), 07 (duplicate, wraps)\n",
    );
    expect(parseGolden(text, "x").triggerFrame).toBe("before-recording");
  });

  describe("rejects", () => {
    it("a missing magic line", () => {
      const all = lines();
      all[0] = "lcd-golden 2";
      expect(parseError(all.join("\n"))).toBe(
        'bad.lcd.txt:1: expected "lcd-golden 1", got "lcd-golden 2"',
      );
    });

    it("header keys out of order", () => {
      const all = lines();
      [all[2], all[3]] = [all[3]!, all[2]!];
      expect(parseError(all.join("\n"))).toBe(
        'bad.lcd.txt:3: expected header "status: …", got "source: captures/6.39/menu-anim-long/05-tones"',
      );
    });

    it("an unknown status", () => {
      const all = lines();
      all[2] = "status: maybe";
      expect(parseError(all.join("\n"))).toBe(
        'bad.lcd.txt:3: status must be "asserted" or "pending:<plan>", got "maybe"',
      );
    });

    it("a malformed sha256", () => {
      const all = lines();
      all[4] = "source-sha256: abc";
      expect(parseError(all.join("\n"))).toBe(
        "bad.lcd.txt:5: source-sha256 must be 64 lowercase hex digits",
      );
    });

    it("a malformed omitted list", () => {
      const all = lines();
      all[7] = "omitted: 06 because";
      expect(parseError(all.join("\n"))).toBe(
        'bad.lcd.txt:8: omitted must be "none" or a comma list of "name (reason)"',
      );
    });

    it("a row of the wrong width", () => {
      const all = lines();
      all[12] = all[12]!.slice(1);
      expect(parseError(all.join("\n"))).toBe(
        'bad.lcd.txt:13: image "a" row 2 has 83 columns, expected 84',
      );
    });

    it("an image with too few rows", () => {
      const all = lines();
      all.splice(12, 1);
      expect(parseError(all.join("\n"))).toBe('bad.lcd.txt:58: image "a" has 47 rows, expected 48');
    });

    it("characters other than # and .", () => {
      const all = lines();
      all[11] = "x" + all[11]!.slice(1);
      expect(parseError(all.join("\n"))).toBe(
        "bad.lcd.txt:12: image \"a\" row 1 column 0: expected '#' or '.', got 'x'",
      );
    });

    it("duplicate image names", () => {
      const all = lines(stillGolden);
      const second = lineIndex(all, (l) => l === "@image 02");
      all[second] = "@image 01";
      expect(parseError(all.join("\n"))).toBe(`bad.lcd.txt:${second + 1}: duplicate image "01"`);
    });

    it("invalid image names", () => {
      const all = lines(stillGolden);
      const first = lineIndex(all, (l) => l === "@image 01");
      all[first] = "@image Big";
      expect(parseError(all.join("\n"))).toBe(
        `bad.lcd.txt:${first + 1}: image name must match [a-z0-9-]+, got "Big"`,
      );
    });

    it("unknown image references", () => {
      const all = lines();
      const row = lineIndex(all, (l) => l.startsWith("1      b"));
      all[row] = all[row]!.replace("1      b", "1      z");
      expect(parseError(all.join("\n"))).toBe(`bad.lcd.txt:${row + 1}: unknown image "z"`);
    });

    it("timeline images not named a, b, … in first-appearance order", () => {
      const swapped = serializeGolden({
        ...timelineGolden,
        timeline: timelineGolden.timeline!.map((row) => ({
          ...row,
          image: row.image === "a" ? "b" : "a",
        })),
      });
      const all = swapped.split("\n");
      const row = lineIndex(all, (l) => l.startsWith("0      b"));
      expect(parseError(swapped)).toBe(
        `bad.lcd.txt:${row + 1}: frame 0 first shows image "b", expected "a" (timeline images are named in first-appearance order)`,
      );
    });

    it("non-monotonic starts", () => {
      const all = lines();
      const row = lineIndex(all, (l) => l.startsWith("2      a"));
      all[row] = "2      a     70       500+        normal 3";
      expect(parseError(all.join("\n"))).toBe(
        `bad.lcd.txt:${row + 1}: start_ms 70 is not after the previous start 76`,
      );
    });

    it("starts that do not chain from the previous duration", () => {
      const all = lines();
      const row = lineIndex(all, (l) => l.startsWith("2      a"));
      all[row] = "2      a     270      500+        normal 3";
      expect(parseError(all.join("\n"))).toBe(
        `bad.lcd.txt:${row + 1}: start_ms 270 must equal the previous start + duration (269)`,
      );
    });

    it("a lower-bound + on any row but the last", () => {
      const all = lines();
      const row = lineIndex(all, (l) => l.startsWith("1      b"));
      all[row] = "1      b     76       193+        normal 3";
      expect(parseError(all.join("\n"))).toBe(
        `bad.lcd.txt:${row + 1}: only the last frame's duration may be a lower bound (+)`,
      );
    });

    it("a + on start_ms", () => {
      const all = lines();
      const row = lineIndex(all, (l) => l.startsWith("1      b"));
      all[row] = "1      b     76+      193         normal 3";
      expect(parseError(all.join("\n"))).toBe(
        `bad.lcd.txt:${row + 1}: start_ms must be an integer, got "76+"`,
      );
    });

    it("bad lcd modes and leds", () => {
      const all = lines();
      const row = lineIndex(all, (l) => l.startsWith("1      b"));
      all[row] = "1      b     76       193         dim    3";
      expect(parseError(all.join("\n"))).toBe(
        `bad.lcd.txt:${row + 1}: lcd must be normal, inverse or blank, got "dim"`,
      );
      all[row] = "1      b     76       193         normal 4";
      expect(parseError(all.join("\n"))).toBe(`bad.lcd.txt:${row + 1}: leds must be 0-3, got "4"`);
    });

    it("frames out of sequence", () => {
      const all = lines();
      const row = lineIndex(all, (l) => l.startsWith("1      b"));
      all[row] = all[row]!.replace(/^1 /, "5 ");
      expect(parseError(all.join("\n"))).toBe(`bad.lcd.txt:${row + 1}: expected frame 1, got 5`);
    });

    it("a trigger frame outside the timeline, or on a still", () => {
      const all = lines();
      all[5] = "trigger-frame: 3";
      expect(parseError(all.join("\n"))).toBe(
        "bad.lcd.txt:6: trigger-frame 3 is outside the timeline (3 frames)",
      );
      const still = serializeGolden({ ...stillGolden, triggerFrame: 0 });
      expect(parseError(still)).toBe("bad.lcd.txt:6: trigger-frame requires a @timeline");
    });

    it("unused images in a timeline fixture", () => {
      const text = serializeGolden({
        ...timelineGolden,
        images: [...timelineGolden.images, { name: "c", pixels: pixels() }],
      });
      const all = text.split("\n");
      const c = lineIndex(all, (l) => l === "@image c");
      expect(parseError(text)).toBe(`bad.lcd.txt:${c + 1}: image "c" is not used by the timeline`);
    });

    it("unknown sections and missing images", () => {
      const all = lines();
      const timeline = lineIndex(all, (l) => l === "@timeline");
      all[timeline] = "@frames";
      expect(parseError(all.join("\n"))).toBe(
        `bad.lcd.txt:${timeline + 1}: expected "@image <name>" or "@timeline", got "@frames"`,
      );
      const header = serializeGolden(stillGolden).split("\n").slice(0, 6).join("\n") + "\n\n";
      expect(parseError(header)).toBe("bad.lcd.txt:8: a golden needs at least one @image");
    });
  });
});

describe("scenario and covers header keys (plan 14)", () => {
  const leafGolden: Golden = {
    ...timelineGolden,
    id: "tree/01-phone-book/1-2.leaf",
    scenario: "leaf",
    covers: ["1-2", "1-4-1", "1-10-2"],
  };

  it("follow omitted, in order, and round-trip", () => {
    const text = serializeGolden(leafGolden);
    const all = text.split("\n");
    expect(all.slice(7, 11)).toEqual([
      "omitted: none",
      "scenario: leaf",
      "covers: 1-2 1-4-1 1-10-2",
      "",
    ]);
    const parsed = parseGolden(text, "x.lcd.txt");
    expect(parsed).toEqual(leafGolden);
    expect(serializeGolden(parsed)).toBe(text);
  });

  it("are absent from plan 13 goldens", () => {
    const parsed = parseGolden(serializeGolden(stillGolden), "x.lcd.txt");
    expect(parsed).not.toHaveProperty("scenario");
    expect(parsed).not.toHaveProperty("covers");
  });

  it("accept every scenario name", () => {
    for (const scenario of ["list", "options", "open", "leaf", "choose"] as const) {
      const golden = { ...stillGolden, scenario, covers: ["8-1-3"] };
      expect(parseGolden(serializeGolden(golden), "x").scenario).toBe(scenario);
    }
  });

  describe("rejects", () => {
    const at = (all: string[], key: string): number => lineIndex(all, (l) => l.startsWith(key));

    it("scenario without covers", () => {
      const all = serializeGolden(leafGolden).split("\n");
      const covers = at(all, "covers: ");
      all.splice(covers, 1);
      expect(parseError(all.join("\n"))).toBe(
        `bad.lcd.txt:${covers + 1}: scenario and covers must both be present or both absent`,
      );
    });

    it("covers without scenario", () => {
      const all = serializeGolden(leafGolden).split("\n");
      const scenario = at(all, "scenario: ");
      all.splice(scenario, 1);
      expect(parseError(all.join("\n"))).toBe(
        `bad.lcd.txt:${scenario + 1}: scenario and covers must both be present or both absent`,
      );
    });

    it("covers before scenario", () => {
      const all = serializeGolden(leafGolden).split("\n");
      const scenario = at(all, "scenario: ");
      [all[scenario], all[scenario + 1]] = [all[scenario + 1]!, all[scenario]!];
      expect(parseError(all.join("\n"))).toBe(
        `bad.lcd.txt:${scenario + 1}: scenario and covers must both be present or both absent`,
      );
    });

    it("an unknown scenario", () => {
      const all = serializeGolden(leafGolden).split("\n");
      const scenario = at(all, "scenario: ");
      all[scenario] = "scenario: walk";
      expect(parseError(all.join("\n"))).toBe(
        `bad.lcd.txt:${scenario + 1}: scenario must be one of list, options, open, leaf, choose, got "walk"`,
      );
    });

    it("empty, malformed or repeated covers", () => {
      const all = serializeGolden(leafGolden).split("\n");
      const covers = at(all, "covers: ");
      for (const [value, message] of [
        ["", 'covers must be a space-separated list of menu numbers such as 1-8-1, got ""'],
        [
          "1-2  1-3",
          'covers must be a space-separated list of menu numbers such as 1-8-1, got "1-2  1-3"',
        ],
        ["1-02", 'covers must be a space-separated list of menu numbers such as 1-8-1, got "1-02"'],
        ["1-8-", 'covers must be a space-separated list of menu numbers such as 1-8-1, got "1-8-"'],
        ["1-2 1-2", 'covers lists "1-2" twice'],
      ] as const) {
        all[covers] = `covers: ${value}`;
        expect(parseError(all.join("\n"))).toBe(`bad.lcd.txt:${covers + 1}: ${message}`);
      }
    });
  });
});

describe("input header key (plan 23)", () => {
  const gameGolden: Golden = {
    ...timelineGolden,
    id: "game/snake/keys-right-2",
    input: [
      { tick: 0, key: "8" },
      { tick: 14, key: "6" },
      { tick: 31, key: "2" },
      { tick: 31, key: "navi" },
    ],
  };
  const treeGolden: Golden = { ...gameGolden, scenario: "leaf", covers: ["8-1-1"] };
  const at = (all: string[], key: string): number => lineIndex(all, (l) => l.startsWith(key));

  it("follows omitted (or covers), round-trips, and keeps same-tick keys in order", () => {
    const text = serializeGolden(gameGolden);
    const all = text.split("\n");
    expect(all.slice(7, 10)).toEqual(["omitted: none", "input: 0:8 14:6 31:2 31:navi", ""]);
    expect(parseGolden(text, "x")).toEqual(gameGolden);
    expect(serializeGolden(parseGolden(text, "x"))).toBe(text);

    const tree = serializeGolden(treeGolden).split("\n");
    expect(tree.slice(9, 12)).toEqual(["covers: 8-1-1", "input: 0:8 14:6 31:2 31:navi", ""]);
    expect(parseGolden(tree.join("\n"), "x")).toEqual(treeGolden);
  });

  it("is absent from earlier goldens", () => {
    expect(parseGolden(serializeGolden(stillGolden), "x")).not.toHaveProperty("input");
  });

  it("accepts every phone key name", () => {
    const keys = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#", "up", "down"];
    const input = [...keys, "navi", "c", "power"].map((key, tick) => ({ tick, key }));
    const golden = { ...gameGolden, input };
    expect(parseGolden(serializeGolden(golden), "x").input).toEqual(input);
  });

  describe("rejects", () => {
    it("descending ticks, unknown keys and malformed pairs", () => {
      const all = serializeGolden(gameGolden).split("\n");
      const input = at(all, "input: ");
      for (const [value, message] of [
        ["3:2 2:4", "input ticks must ascend: 2 after 3"],
        [
          "3:left",
          'input key must be a phone key (0-9, *, #, up, down, navi, c, power), got "left"',
        ],
        ["3", 'input must be space-separated <tick>:<key> pairs, got "3"'],
        ["03:2", 'input must be space-separated <tick>:<key> pairs, got "03:2"'],
        ["", 'input must be space-separated <tick>:<key> pairs, got ""'],
      ] as const) {
        all[input] = `input: ${value}`;
        expect(parseError(all.join("\n"))).toBe(`bad.lcd.txt:${input + 1}: ${message}`);
      }
    });

    it("input before omitted", () => {
      const all = serializeGolden(gameGolden).split("\n");
      const input = at(all, "input: ");
      const omitted = at(all, "omitted: ");
      [all[omitted], all[input]] = [all[input]!, all[omitted]!];
      expect(parseError(all.join("\n"))).toBe(
        `bad.lcd.txt:${omitted + 1}: expected header "omitted: …", got "input: 0:8 14:6 31:2 31:navi"`,
      );
    });
  });
});

describe("tick fixture format (plan 23)", () => {
  const fixture: TickGolden = {
    id: "game/snake/periods",
    status: "asserted",
    source: "captures/6.39/plan23/periods",
    sourceSha256: SHA,
    note: "New game at each level, No maze, no keys; tick start times after the start frame.",
    rows: [
      { level: 10, firstMs: 1846, intervalsMs: [1859, 1858] },
      { level: 175, firstMs: 6, intervalsMs: [8, 7, 8] },
    ],
  };

  it("serializes the documented layout and round-trips", () => {
    const text = serializeTickGolden(fixture);
    expect(text.split("\n")).toEqual([
      "tick-golden 1",
      "id: game/snake/periods",
      "status: asserted",
      "source: captures/6.39/plan23/periods",
      `source-sha256: ${SHA}`,
      "note: New game at each level, No maze, no keys; tick start times after the start frame.",
      "",
      "@ticks",
      "# level first_ms intervals_ms…",
      "10    1846 1859 1858",
      "175   6 8 7 8",
      "",
    ]);
    expect(parseTickGolden(text, "x")).toEqual(fixture);
    const { note: _note, ...plain } = fixture;
    expect(parseTickGolden(serializeTickGolden(plain), "x")).toEqual(plain);
  });

  describe("rejects", () => {
    const tickError = (text: string): string => {
      try {
        parseTickGolden(text, "p.ticks.txt");
      } catch (error) {
        expect(error).toBeInstanceOf(GoldenFormatError);
        return (error as Error).message;
      }
      throw new Error("expected a parse error");
    };
    const all = (): string[] => serializeTickGolden(fixture).split("\n");

    it("a missing magic line or headers out of order", () => {
      const lines = all();
      lines[0] = "lcd-golden 1";
      expect(tickError(lines.join("\n"))).toBe(
        'p.ticks.txt:1: expected "tick-golden 1", got "lcd-golden 1"',
      );
      const swapped = all();
      [swapped[2], swapped[3]] = [swapped[3]!, swapped[2]!];
      expect(tickError(swapped.join("\n"))).toBe(
        'p.ticks.txt:3: expected header "status: …", got "source: captures/6.39/plan23/periods"',
      );
    });

    it("levels out of order or repeated, non-integers and too few intervals", () => {
      for (const [row, message] of [
        ["9     5 6 7", "levels must ascend: 9 after 10"],
        ["10    5 6 7", "levels must ascend: 10 after 10"],
        ["11    5 6.5 7", 'expected integers, got "6.5"'],
        ["11    5 6", "a level needs a first tick and at least two intervals"],
      ] as const) {
        const lines = all();
        lines.splice(10, 0, row);
        expect(tickError(lines.join("\n"))).toBe(`p.ticks.txt:11: ${message}`);
      }
    });

    it("a missing @ticks section or no rows", () => {
      const lines = all();
      expect(tickError(lines.slice(0, 7).join("\n"))).toBe('p.ticks.txt:8: expected "@ticks"');
      expect(tickError([...lines.slice(0, 9), ""].join("\n"))).toBe(
        "p.ticks.txt:10: @ticks has no rows",
      );
    });
  });
});
