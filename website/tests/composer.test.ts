import { describe, expect, it } from "vite-plus/test";
import { parseComposer } from "../src/phone/composer";
import { TONES } from "../src/phone/tones";

describe("parseComposer (spec §8 notation)", () => {
  it("parses pitch: composer octave 1 is scientific octave 5", () => {
    const [a1] = parseComposer("4a1", 180);
    expect(a1!.freq).toBeCloseTo(880, 1);
  });

  it("parses sharps and octaves", () => {
    const [fs1, e2, c3] = parseComposer("8#f1 8e2 8c3", 180);
    expect(fs1!.freq).toBeCloseTo(739.99, 1); // F#5
    expect(e2!.freq).toBeCloseTo(1318.51, 1); // E6
    expect(c3!.freq).toBeCloseTo(2093.0, 1); // C7
  });

  it("duration: number is the note fraction, dot adds 50%", () => {
    // 180 bpm → quarter = 333.33 ms
    const [quarter, eighth, dottedEighth, whole] = parseComposer("4a1 8a1 8.a1 1a1", 180);
    expect(quarter!.ms).toBeCloseTo(333.33, 1);
    expect(eighth!.ms).toBeCloseTo(166.67, 1);
    expect(dottedEighth!.ms).toBeCloseTo(250, 1);
    expect(whole!.ms).toBeCloseTo(1333.33, 1);
  });

  it("parses rests (the manual's example tokens '1-' and '8-')", () => {
    const notes = parseComposer("16.a2 16d2 8a2 1- 8-", 180);
    expect(notes).toHaveLength(5);
    expect(notes[0]!.freq).not.toBeNull(); // dotted 16th a2
    expect(notes[3]).toEqual({ freq: null, ms: expect.closeTo(1333.33, 1) });
    expect(notes[4]!.freq).toBeNull();
  });

  it("throws on malformed tokens", () => {
    expect(() => parseComposer("9a1", 180)).toThrow(/composer token/);
    expect(() => parseComposer("8h1", 180)).toThrow(/composer token/);
    expect(() => parseComposer("8a9", 180)).toThrow(/composer token/);
  });

  it("every shipped tone parses, and the Nokia tune is 13 notes", () => {
    for (const tone of TONES) {
      expect(() => parseComposer(tone.notation, tone.bpm), tone.id).not.toThrow();
    }
    const nokia = TONES.find((t) => t.id === "nokia-tune")!;
    const notes = parseComposer(nokia.notation, nokia.bpm).filter((n) => n.freq !== null);
    expect(notes).toHaveLength(13);
    expect(notes[0]!.freq).toBeCloseTo(1318.51, 1); // E6
    expect(notes.at(-1)!.freq).toBeCloseTo(880, 1); // A5
  });
});
