import { describe, expect, it } from "vite-plus/test";
import { GameScreen, unpackFrame } from "../src/index";

/** The rows of a screen region as `#`/`.` art. */
function rows(screen: GameScreen, x: number, y: number, w: number, h: number): string[] {
  return Array.from({ length: h }, (_, dy) =>
    Array.from({ length: w }, (_, dx) => (screen.get(x + dx, y + dy) ? "#" : ".")).join(""),
  );
}

function ink(screen: GameScreen): number {
  return screen.pixels.reduce((sum, pixel) => sum + pixel, 0);
}

describe("GameScreen", () => {
  it("is a blank 84×48 screen of one byte per pixel", () => {
    const screen = new GameScreen();
    expect([screen.width, screen.height, screen.pixels.length]).toEqual([84, 48, 4032]);
    expect(ink(screen)).toBe(0);
  });

  it("sets and reads pixels row-major, ink by default", () => {
    const screen = new GameScreen();
    screen.set(2, 1);
    expect(screen.pixels[84 + 2]).toBe(1);
    expect(screen.get(2, 1)).toBe(1);
    screen.set(2, 1, 0);
    expect(screen.get(2, 1)).toBe(0);
  });

  it("clips writes and reads 0 outside the screen", () => {
    const screen = new GameScreen();
    for (const [x, y] of [
      [-1, 0],
      [84, 0],
      [0, -1],
      [0, 48],
      [Number.NaN, 0],
      [0, Number.POSITIVE_INFINITY],
    ] as const) {
      screen.set(x, y);
      expect(screen.get(x, y)).toBe(0);
    }
    expect(ink(screen)).toBe(0);
    // A column past the right edge must not wrap onto the next row.
    screen.set(84, 3);
    expect(screen.get(0, 4)).toBe(0);
  });

  it("fills a rectangle, clipped to the screen", () => {
    const screen = new GameScreen();
    screen.fill(1, 1, 3, 2);
    expect(rows(screen, 0, 0, 5, 4)).toEqual([".....", ".###.", ".###.", "....."]);
    screen.fill(-2, -2, 4, 3);
    expect(rows(screen, 0, 0, 3, 2)).toEqual(["##.", ".##"]);
    screen.fill(82, 46, 10, 10);
    expect(rows(screen, 81, 45, 3, 3)).toEqual(["...", ".##", ".##"]);
    expect(ink(screen)).toBe(6 + 2 + 4);
    screen.fill(0, 0, 84, 48, 0);
    expect(ink(screen)).toBe(0);
  });

  it("draws nothing for an empty or negative rectangle", () => {
    const screen = new GameScreen();
    screen.fill(5, 5, 0, 3);
    screen.fill(5, 5, 3, -1);
    screen.invert(5, 5, -2, 2);
    expect(ink(screen)).toBe(0);
  });

  it("inverts a rectangle, clipped to the screen", () => {
    const screen = new GameScreen();
    screen.fill(1, 0, 2, 2);
    screen.invert(0, 0, 3, 1);
    expect(rows(screen, 0, 0, 4, 2)).toEqual(["#...", ".##."]);
    screen.invert(-5, 47, 7, 5);
    expect(rows(screen, 0, 46, 3, 2)).toEqual(["...", "##."]);
    expect(ink(screen)).toBe(1 + 2 + 2);
  });

  it("blits `#` as ink and `.` as paper, and skips every other character", () => {
    const screen = new GameScreen();
    screen.fill(0, 0, 4, 2);
    screen.blit(["#. #", " .."], 0, 0);
    expect(rows(screen, 0, 0, 4, 2)).toEqual(["#.##", "#..#"]);
  });

  it("clips a blit at every edge", () => {
    const screen = new GameScreen();
    screen.blit(["##", "##"], -1, -1);
    screen.blit(["##", "##"], 83, 47);
    expect(ink(screen)).toBe(2);
    expect([screen.get(0, 0), screen.get(83, 47)]).toEqual([1, 1]);
  });

  it("clears to paper", () => {
    const screen = new GameScreen();
    screen.fill(0, 0, 84, 48);
    screen.clear();
    expect(ink(screen)).toBe(0);
  });
});

describe("packed frames", () => {
  it("packs row-major, MSB first, into 504 bytes", () => {
    const screen = new GameScreen();
    // Bit index = y * 84 + x: 0, 7, 83, 84 and 4031.
    screen.set(0, 0);
    screen.set(7, 0);
    screen.set(83, 0);
    screen.set(0, 1);
    screen.set(83, 47);
    const packed = screen.pack();
    expect(packed.length).toBe(504);
    const expected = new Uint8Array(504);
    expected[0] = 0b1000_0001;
    expected[10] = 0b0001_1000;
    expected[503] = 0b0000_0001;
    expect(packed).toEqual(expected);
  });

  it("returns a fresh array from each pack", () => {
    const screen = new GameScreen();
    const first = screen.pack();
    screen.set(0, 0);
    expect(first[0]).toBe(0);
    expect(screen.pack()[0]).toBe(0x80);
  });

  it("round-trips through unpackFrame", () => {
    const screen = new GameScreen();
    for (let i = 0; i < 4032; i += 7) screen.pixels[i] = 1;
    screen.fill(40, 20, 9, 9);
    const unpacked = unpackFrame(screen.pack());
    expect(unpacked.length).toBe(4032);
    expect(unpacked).toEqual(screen.pixels);
  });

  it("refuses a frame of another length", () => {
    expect(() => unpackFrame(new Uint8Array(503))).toThrow("504");
    expect(() => unpackFrame(new Uint8Array(505))).toThrow("504");
  });
});
