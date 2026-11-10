import { describe, expect, it } from "vite-plus/test";
import {
  GAME_DIGITS,
  GameScreen,
  decodeBase64,
  drawNumber,
  drawText,
  encodeBase64,
  encodeFrame,
  sdk,
  textWidth,
  type GameFont,
} from "../src/index";

const FONT: GameFont = {
  height: 2,
  glyphs: {
    a: ["#.", ".#"],
    b: ["###", "#.#"],
  },
};

function rows(screen: GameScreen, x: number, y: number, w: number, h: number): string[] {
  return Array.from({ length: h }, (_, dy) =>
    Array.from({ length: w }, (_, dx) => (screen.get(x + dx, y + dy) ? "#" : ".")).join(""),
  );
}

function ink(screen: GameScreen): number {
  return screen.pixels.reduce((sum, pixel) => sum + pixel, 0);
}

describe("text", () => {
  it("measures text by each glyph's row length", () => {
    expect(textWidth(FONT, "")).toBe(0);
    expect(textWidth(FONT, "a")).toBe(2);
    expect(textWidth(FONT, "abba")).toBe(10);
  });

  it("draws glyphs side by side and returns the width", () => {
    const screen = new GameScreen();
    expect(drawText(screen, FONT, "ab", 1, 1)).toBe(5);
    expect(rows(screen, 0, 0, 7, 4)).toEqual([".......", ".#.###.", "..##.#.", "......."]);
  });

  it("paints only a glyph's ink, in the ink asked for", () => {
    const screen = new GameScreen();
    screen.fill(0, 0, 5, 2);
    drawText(screen, FONT, "ab", 0, 0, 0);
    expect(rows(screen, 0, 0, 5, 2)).toEqual([".#...", "#..#."]);
  });

  it("throws on a missing glyph, naming it, before drawing anything", () => {
    const screen = new GameScreen();
    expect(() => textWidth(FONT, "abc")).toThrow('"c"');
    expect(() => drawText(screen, FONT, "ac", 0, 0)).toThrow('"c"');
    expect(ink(screen)).toBe(0);
    // Inherited object properties are not glyphs.
    expect(() => textWidth({ height: 1, glyphs: {} }, "constructor")).toThrow('"c"');
  });
});

describe("GAME_DIGITS", () => {
  it("holds ten 4×5 cells with ink in the right three columns", () => {
    expect(GAME_DIGITS.height).toBe(5);
    expect(Object.keys(GAME_DIGITS.glyphs)).toEqual("0123456789".split(""));
    for (const glyph of Object.values(GAME_DIGITS.glyphs)) {
      expect(glyph.length).toBe(5);
      for (const row of glyph) expect(row).toMatch(/^\.[#.]{3}$/);
    }
    expect(GAME_DIGITS.glyphs["4"]).toEqual([".#.#", ".#.#", ".###", "...#", "...#"]);
  });
});

describe("drawNumber", () => {
  it("draws GAME_DIGITS at scale 1 from the left by default", () => {
    const screen = new GameScreen();
    expect(drawNumber(screen, 17, 2, 1)).toBe(8);
    expect(rows(screen, 2, 1, 8, 5)).toEqual([
      "..#..###",
      ".##....#",
      "..#...#.",
      "..#...#.",
      "..#...#.",
    ]);
    expect(ink(screen)).toBe(6 + 7);
  });

  it("scales each font pixel to a square", () => {
    const screen = new GameScreen();
    expect(drawNumber(screen, 1, 0, 0, { scale: 3 })).toBe(12);
    expect(rows(screen, 0, 0, 12, 15)).toEqual([
      "......###...",
      "......###...",
      "......###...",
      "...######...",
      "...######...",
      "...######...",
      "......###...",
      "......###...",
      "......###...",
      "......###...",
      "......###...",
      "......###...",
      "......###...",
      "......###...",
      "......###...",
    ]);
  });

  it("right-aligns to an exclusive right edge", () => {
    const screen = new GameScreen();
    expect(drawNumber(screen, 17, 84, 0, { align: "right" })).toBe(8);
    expect(rows(screen, 76, 0, 8, 1)).toEqual(["..#..###"]);
    expect(ink(screen)).toBe(13);
  });

  it("puts `gap` pixels between digits, none by default", () => {
    const tight = new GameScreen();
    expect(drawNumber(tight, 11, 0, 0, { gap: 0 })).toBe(8);
    expect(rows(tight, 0, 0, 8, 1)).toEqual(["..#...#."]);
    const loose = new GameScreen();
    expect(drawNumber(loose, 11, 20, 0, { gap: 2, align: "right" })).toBe(10);
    expect(rows(loose, 10, 0, 10, 1)).toEqual(["..#.....#."]);
  });

  it("draws in paper on a filled box", () => {
    const screen = new GameScreen();
    screen.fill(0, 0, 6, 7);
    drawNumber(screen, 7, 1, 1, { ink: 0 });
    expect(rows(screen, 0, 0, 6, 7)).toEqual([
      "######",
      "##...#",
      "####.#",
      "###.##",
      "###.##",
      "###.##",
      "######",
    ]);
  });

  it("draws with another font", () => {
    const screen = new GameScreen();
    const font: GameFont = { height: 1, glyphs: { "4": ["#"], "2": ["##."] } };
    expect(drawNumber(screen, 42, 0, 0, { font, gap: 1 })).toBe(5);
    expect(rows(screen, 0, 0, 5, 1)).toEqual(["#.##."]);
  });

  it("refuses what it cannot draw", () => {
    const screen = new GameScreen();
    expect(() => drawNumber(screen, 1.5, 0, 0)).toThrow("integer");
    expect(() => drawNumber(screen, -1, 0, 0)).toThrow('"-"');
    expect(() => drawNumber(screen, 1, 0, 0, { scale: 0 as 1 })).toThrow("scale");
    expect(ink(screen)).toBe(0);
  });
});

describe("base64", () => {
  it("encodes with padding", () => {
    const bytes = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));
    expect(encodeBase64(bytes(""))).toBe("");
    expect(encodeBase64(bytes("f"))).toBe("Zg==");
    expect(encodeBase64(bytes("fo"))).toBe("Zm8=");
    expect(encodeBase64(bytes("foo"))).toBe("Zm9v");
    expect(encodeBase64(bytes("foobar"))).toBe("Zm9vYmFy");
    expect(encodeBase64(Uint8Array.of(0xfb, 0xff, 0xfe))).toBe("+//+");
  });

  it("decodes what it encodes", () => {
    const bytes = Uint8Array.from({ length: 259 }, (_, i) => (i * 37) & 0xff);
    for (const length of [0, 1, 2, 3, 258, 259]) {
      const part = bytes.subarray(0, length);
      expect(decodeBase64(encodeBase64(part))).toEqual(part);
    }
  });

  it("refuses text that is not canonical base64", () => {
    for (const text of ["Zg", "Zg=", "Z===", "Zm9v\n", "Zm 9v", "Zm9-", "Zh==", "=Zg="]) {
      expect(() => decodeBase64(text), text).toThrow("base64");
    }
  });
});

describe("encodeFrame", () => {
  it("is the base64 of the packed frame", () => {
    const screen = new GameScreen();
    expect(encodeFrame(screen)).toBe("A".repeat(672));
    screen.set(0, 0);
    screen.set(83, 47);
    const text = encodeFrame(screen);
    expect(text).toBe(`g${"A".repeat(670)}B`);
    expect(decodeBase64(text)).toEqual(screen.pack());
  });
});

describe("sdk", () => {
  it("is the frozen helper object a game factory receives", () => {
    expect(Object.isFrozen(sdk)).toBe(true);
    expect(sdk.version).toBe(1);
    expect(sdk.MIN_WAKE_MS).toBe(10);
    expect(sdk.GAME_DIGITS).toBe(GAME_DIGITS);
    const screen = sdk.createScreen();
    expect(screen).toBeInstanceOf(GameScreen);
    expect(sdk.createScreen()).not.toBe(screen);
    expect(sdk.textWidth(GAME_DIGITS, "2048")).toBe(16);
    expect(sdk.drawText(screen, GAME_DIGITS, "7", 0, 0)).toBe(4);
    expect(sdk.drawNumber(screen, 7, 0, 0)).toBe(4);
    expect(sdk.encodeFrame(screen)).toBe(encodeFrame(screen));
  });

  it("freezes the shared digits", () => {
    expect(Object.isFrozen(GAME_DIGITS)).toBe(true);
    expect(Object.isFrozen(GAME_DIGITS.glyphs)).toBe(true);
    expect(Object.isFrozen(GAME_DIGITS.glyphs["0"])).toBe(true);
  });
});
