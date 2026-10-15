// Plan 27 Task 3: the Composer's notation (K6): `[duration][.][#]<note><octave>` or
// `[duration]-`. Forms transcribed from the composer goldens' notation (plan27/entry, cursor,
// layout), independent of the code.
import { describe, expect, it } from "vite-plus/test";
import { formatToken, parseTokens, type ComposerToken } from "../src/composer/notation";

const note = (
  value: ComposerToken["value"],
  pitch: "c" | "d" | "e" | "f" | "g" | "a" | "b",
  octave: 1 | 2 | 3,
  extra: { dotted?: boolean; sharp?: boolean } = {},
): ComposerToken => ({
  kind: "note",
  value,
  dotted: extra.dotted ?? false,
  pitch,
  sharp: extra.sharp ?? false,
  octave,
});

describe("composer notation", () => {
  it("formats every token form the goldens draw", () => {
    expect(formatToken(note(4, "c", 1))).toBe("4c1");
    expect(formatToken(note(1, "d", 2, { dotted: true }))).toBe("1.d2");
    expect(formatToken(note(16, "f", 3, { sharp: true }))).toBe("16#f3");
    expect(formatToken(note(32, "a", 1, { dotted: true, sharp: true }))).toBe("32.#a1");
    expect(formatToken({ kind: "rest", value: 8 })).toBe("8-");
  });

  it("round-trips forms through parseTokens", () => {
    const text = "4c1 1.d2 16#f3 32.#a1 8- 2.g3 1-";
    const tokens = parseTokens(text);
    expect(tokens).toHaveLength(7);
    expect(tokens.map(formatToken).join(" ")).toBe(text);
    expect(parseTokens("")).toEqual([]);
  });

  it("throws naming an invalid token", () => {
    expect(() => parseTokens("4c1 4#e1")).toThrow(/4#e1/);
    expect(() => parseTokens("3c1")).toThrow(/3c1/);
    expect(() => parseTokens("4c4")).toThrow(/4c4/);
    expect(() => parseTokens("4#b1")).toThrow(/4#b1/);
    expect(() => parseTokens("4.-")).toThrow(/4\.-/);
  });
});
