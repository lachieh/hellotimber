import { describe, expect, it } from "vite-plus/test";
import type { SoundRow } from "../scripts/sound-format.ts";
import {
  SoundProgramError,
  programFromRows,
  renderAtLevels,
  renderProgram,
} from "../scripts/sound-programs.ts";

const buzz = (ms: number, hz: number | null, volume = 16): SoundRow => ({
  ms,
  output: "buzzer",
  state: hz === null ? { kind: "off" } : { kind: "sounding", hz, volume },
});
const vib = (ms: number, on: boolean): SoundRow => ({
  ms,
  output: "vibrator",
  state: { kind: on ? "on" : "off" },
});

const ROWS: SoundRow[] = [
  buzz(0, 1319),
  vib(0, true),
  buzz(115, 1175),
  buzz(230, null),
  vib(711, false),
  buzz(1000, 740, 12),
  buzz(1240, null),
];

describe("programs from rows", () => {
  it("makes one step per edge, held until the next; the last edge is the end", () => {
    const program = programFromRows("t", ROWS);
    expect(program).toEqual({
      id: "t",
      steps: [
        { ms: 115, buzzer: { hz: 1319, volume: 16 }, vibrator: true },
        { ms: 115, buzzer: { hz: 1175, volume: 16 } },
        { ms: 481, buzzer: null },
        { ms: 289, vibrator: false },
        { ms: 240, buzzer: { hz: 740, volume: 12 } },
      ],
    });
  });

  it("renders back to its rows from any start (the round trip)", () => {
    const program = programFromRows("t", ROWS);
    expect(renderProgram(program, 0)).toEqual(ROWS);
    expect(renderProgram(program, 991)).toEqual(ROWS.map((r) => ({ ...r, ms: r.ms + 991 })));
  });

  it("silences what is still on at the end, or where it is cut", () => {
    const program = programFromRows("t", ROWS);
    expect(renderProgram(program, 0, { stopStep: 2 })).toEqual([
      buzz(0, 1319),
      vib(0, true),
      buzz(115, 1175),
      buzz(230, null),
      vib(230, false),
    ]);
  });

  it("refuses rows that end sounding, naming the program", () => {
    expect(() => programFromRows("cut", [buzz(0, 1319), buzz(100, 1175)])).toThrow(
      new SoundProgramError("cut", "the last edge (100 ms) turns buzzer on"),
    );
  });

  it("takes volumes from a level that changes, a sounding note at once", () => {
    const program = programFromRows("t", ROWS);
    const tables = {
      "1": { "1319": 4, "1175": 6, "740": 3 },
      "2": { "1319": 7, "1175": 8, "740": 5 },
    };
    expect(
      renderAtLevels(program, 0, tables, [
        { atMs: 0, level: 1 },
        { atMs: 150, level: 2 },
      ]).filter((r) => r.output === "buzzer"),
    ).toEqual([
      buzz(0, 1319, 4),
      buzz(115, 1175, 6),
      buzz(150, 1175, 8),
      buzz(230, null),
      buzz(1000, 740, 5),
      buzz(1240, null),
    ]);
  });
});
