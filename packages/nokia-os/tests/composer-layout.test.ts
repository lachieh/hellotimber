// Plan 27 Task 3: the notation's lines, view and cursor (K6, Task 0 U). Lines and windows are
// transcribed from plan27/cursor, plan27/layout and plan27/entry stills, independent of the code.
import { describe, expect, it } from "vite-plus/test";
import { EMPTY_COMPOSER } from "../src/composer/editor";
import { composerLines } from "../src/composer/layout";
import { parseTokens } from "../src/composer/notation";
import { replayComposerKeys } from "./support/composer";

/** `MIXED50` of gen_v639_plan27.py: every form, 50 tokens (plan27/cursor/up/00 … 51). */
const MIXED_KEYS = (() => {
  const groups = ["1", "2 #", "0", "3 *", "4@1500", "5 8", "6 # 9", "0 8", "7 *", "1 9 9"];
  return Array.from({ length: 50 }, (_, i) => groups[i % groups.length]).join(" ");
})();

const MIXED_LINES = [
  "4c1 4#d1 4- 4e2",
  "4.f2 8g2 4#a2 8-",
  "4b3 1c3 1c3",
  "1#d3 1- 1e1 1.f1",
  "2g1 1#a1 2- 1b2",
  "16c2 16c2 16#d2",
  "16- 16e3 16.f3",
  "32g3 16#a3 32-",
  "16b1 4c1 4c1",
  "4#d1 4- 4e2 4.f2",
  "8g2 4#a2 8- 4b3",
  "1c3 1c3 1#d3 1-",
  "1e1 1.f1 2g1",
  "1#a1 2- 1b2",
  "16c2",
];

describe("composer lines", () => {
  const mixed = replayComposerKeys(EMPTY_COMPOSER, MIXED_KEYS).state;

  it("wraps at token boundaries in the small face (plan27/cursor)", () => {
    expect(mixed.tokens).toHaveLength(50);
    expect(composerLines(mixed.tokens, 50).lines).toEqual(MIXED_LINES);
  });

  it("fits a line of 83 px and wraps one of 84 (plan27/layout/edge-*)", () => {
    expect(composerLines(parseTokens("4d1 4d1 4d1 4.c1 4g1"), 5).lines).toEqual([
      "4d1 4d1 4d1 4.c1",
      "4g1",
    ]);
    expect(composerLines(parseTokens("4d1 4d1 4d1 4.d1 4g1"), 5).lines).toEqual([
      "4d1 4d1 4d1",
      "4.d1 4g1",
    ]);
    expect(composerLines(parseTokens("4c1 4d1 4d1 4d1 4g1"), 5).lines).toEqual([
      "4c1 4d1 4d1 4d1",
      "4g1",
    ]);
  });

  it("keeps whole tokens on a line (plan27/layout/prefix-*, rests-*)", () => {
    const sharp = "16.#f2 16.#f2 16.#f2 16.#f2";
    expect(composerLines(parseTokens(`4- 4- 4- 4- 4- 4- ${sharp}`), 10).lines).toEqual([
      "4- 4- 4- 4- 4- 4-",
      "16.#f2 16.#f2",
      "16.#f2 16.#f2",
    ]);
    expect(composerLines(parseTokens(`4- ${sharp}`), 5).lines).toEqual([
      "4- 16.#f2 16.#f2",
      "16.#f2 16.#f2",
    ]);
    expect(composerLines(parseTokens("16- ".repeat(9).trim()), 9).lines).toEqual([
      "16- 16- 16- 16-",
      "16- 16- 16- 16-",
      "16-",
    ]);
  });

  it("puts the cursor after the token before it, on that token's line", () => {
    expect(composerLines([], 0).cursorAt).toEqual({ line: 0, x: 0 });
    const three = parseTokens("4c1 4d1 4e1 4f1 4g1");
    expect(composerLines(three, 0).cursorAt).toEqual({ line: 0, x: 0 });
    expect(composerLines(three, 1).cursorAt).toEqual({ line: 0, x: 17 });
    expect(composerLines(three, 2).cursorAt).toEqual({ line: 0, x: 38 });
    expect(composerLines(three, 3).cursorAt).toEqual({ line: 0, x: 59 });
    expect(composerLines(three, 4).cursorAt).toEqual({ line: 0, x: 78 });
    expect(composerLines(three, 5).cursorAt).toEqual({ line: 1, x: 18 });
  });

  it("scrolls the view as little as the cursor needs (plan27/cursor/up, down)", () => {
    // ▲ ×51 from the end: the start (top 0), then the view follows the cursor down.
    const firstShown: number[] = [];
    let top = composerLines(mixed.tokens, 50).top;
    expect(top).toBe(12);
    for (let step = 1; step <= 51; step++) {
      const cursor = (50 + step) % 51;
      top = composerLines(mixed.tokens, cursor, top).top;
      firstShown.push(top);
    }
    // transcribed: steps 1-12 top 0, 13-16 top 1, 17-20 top 2, 21-23 top 3 …, 51 back at the end
    expect(firstShown.slice(0, 12)).toEqual(Array(12).fill(0));
    expect(firstShown.slice(12, 16)).toEqual([1, 1, 1, 1]);
    expect(firstShown.slice(16, 20)).toEqual([2, 2, 2, 2]);
    expect(firstShown[50]).toBe(12);
    // ▼ from the end: the view stays until the cursor leaves its top line
    let down = 12;
    const downTops: number[] = [];
    for (let step = 1; step <= 51; step++) {
      down = composerLines(mixed.tokens, 50 - step >= 0 ? 50 - step : 50, down).top;
      downTops.push(down);
    }
    // transcribed: steps 1-6 top 12, step 7 (after 1-) top 11, steps 11-14 top 10, 15 top 9
    expect(downTops.slice(0, 6)).toEqual([12, 12, 12, 12, 12, 12]);
    expect(downTops.slice(6, 10)).toEqual([11, 11, 11, 11]);
    expect(downTops.slice(10, 14)).toEqual([10, 10, 10, 10]);
    expect(downTops[14]).toBe(9);
    expect(downTops[49]).toBe(0);
    expect(downTops[50]).toBe(12);
  });
});
