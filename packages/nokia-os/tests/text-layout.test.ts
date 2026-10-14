import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { STOCK_FONTS } from "../src/resources";
import { WIDGET_DATA } from "../src/resources/generated/widgets";
import {
  cursorLine,
  EDITOR_LINE_WIDTH,
  pendingSlot,
  textWidth,
  viewTop,
  wrapText,
  type TextLine,
} from "../src/text/layout";
import { emptyText, shownMode, textKey, type TextState } from "../src/text/multitap";
import { loadGolden } from "./support/goldens";
import { replayTrace, TEXT_TRACES, type TextTrace } from "./support/messages";

/** The lines' text. */
function shown(text: string, lines: readonly TextLine[]): string[] {
  return lines.map((line) => Array.from(text).slice(line.start, line.end).join(""));
}

const wrap = (text: string, font: "small" | "large" = "small") =>
  shown(text, wrapText(text, font, EDITOR_LINE_WIDTH));

describe("wrapText (measured on the wrap goldens)", () => {
  it("breaks a word longer than the line where it overflows its 83 columns", () => {
    // text/wrap-long-word 13, 14: 13 letters (80 columns) fit, the 14th starts line 2.
    expect(textWidth("small", "Adgjmptwadgjm")).toBe(80);
    expect(wrap("Adgjmptwadgjm")).toEqual(["Adgjmptwadgjm"]);
    expect(wrap("Adgjmptwadgjmp")).toEqual(["Adgjmptwadgjm", "p"]);
    expect(wrap("Adgjmptwadgjmptwadgjmptwadgj")).toEqual(["Adgjmptwadgjm", "ptwadgjmptwad", "gj"]);
  });

  it("moves a word that does not end two columns short of the line's end, its space staying", () => {
    // text/counter 166: `ptw adgjmptwad` is 82 columns.
    expect(wrap("ptw adgjmptwa")).toEqual(["ptw adgjmptwa"]);
    expect(wrap("ptw adgjmptwad")).toEqual(["ptw ", "adgjmptwad"]);
    // text/wrap-words 27: 81 columns fit.
    expect(textWidth("small", "gjmp tadgjmptw")).toBe(81);
    expect(wrap("gjmp tadgjmptw")).toEqual(["gjmp tadgjmptw"]);
  });

  it("keeps spaces at the end of their line, the next word starting the next (text/wrap-spaces)", () => {
    expect(wrap("Adgjmptwadg     ")).toEqual(["Adgjmptwadg     "]);
    expect(wrap("Adgjmptwadg      a")).toEqual(["Adgjmptwadg      ", "a"]);
  });

  it("starts an empty line for the cursor when spaces push the end past x 83 (text/wrap-spaces 06)", () => {
    expect(textWidth("small", "Adgjmptwadg     ")).toBe(82);
    expect(textWidth("small", "Adgjmptwadg      ")).toBe(85);
    expect(wrap("Adgjmptwadg      ")).toEqual(["Adgjmptwadg      ", ""]);
  });

  it("gives a pending character its key's widest character (text/wrap-words 15)", () => {
    // `Adgj mptw ad gj` is 80 columns, but j's key also types `K` (7 columns).
    let state: TextState = { ...emptyText(), text: "Adgj mptw ad g", cursor: 14 };
    state = textKey(state, "5", 0, 459);
    expect(state.text).toBe("Adgj mptw ad gj");
    const slot = pendingSlot(state, "small");
    expect(slot).toEqual({ at: 14, width: 7 });
    expect(shown(state.text, wrapText(state.text, "small", EDITOR_LINE_WIDTH, slot))).toEqual([
      "Adgj mptw ad ",
      "gj",
    ]);
    expect(wrap("Adgj mptw ad gj")).toEqual(["Adgj mptw ad gj"]);
  });

  it("breaks the welcome note's large face at the same width (welcome/face 13)", () => {
    expect(textWidth("large", "Adgjmptwadgj")).toBe(82);
    expect(wrap("Adgjmptwadgj", "large")).toEqual(["Adgjmptwadgj"]);
    expect(wrap("Adgjmptwadgjm", "large")).toEqual(["Adgjmptwadgj", "m"]);
  });

  it("has one empty line for an empty text", () => {
    expect(wrapText("", "small", EDITOR_LINE_WIDTH)).toEqual([{ start: 0, end: 0 }]);
  });
});

describe("cursorLine and viewTop", () => {
  const text = "Adgjm adgjm adgjm adgjm adgjm adgjm b";
  const lines = wrapText(text, "small", EDITOR_LINE_WIDTH);

  it("puts the cursor at a line break on the next line, the end on the last", () => {
    expect(shown(text, lines)).toEqual(["Adgjm adgjm ", "adgjm adgjm ", "adgjm adgjm b"]);
    expect(cursorLine(lines, 11)).toBe(0);
    expect(cursorLine(lines, 12)).toBe(1);
    expect(cursorLine(lines, text.length)).toBe(2);
  });

  it("scrolls to keep the cursor's line in a window of three", () => {
    const four = [...lines, { start: text.length, end: text.length }];
    expect(viewTop(lines, text.length, 3)).toBe(0);
    expect(viewTop(four, text.length, 3, 0)).toBe(1);
    expect(viewTop(four, 0, 3, 1)).toBe(0);
    expect(viewTop(four, 12, 3, 1)).toBe(1);
  });
});

describe("trace: the stills' key sequences through the engine and layout (plan 18 Task 5)", () => {
  /** The header's mode text sprite for each shown mode. */
  const MODE_SPRITES: Readonly<Record<string, string>> = {
    Abc: "prompt/abc",
    abc: "prompt/abc-lower",
    ABC: "editor/mode-upper",
    "123": "editor/mode-123",
  };

  /** The golden's text rows y 7..36 with the cursor (a lit bar from y 7 + 10r to 16 + 10r) removed. */
  function withoutCursor(pixels: Uint8Array): { pixels: Uint8Array; cursor?: [number, number] } {
    const out = pixels.slice();
    for (let row = 0; row < 3; row++) {
      for (let x = 0; x < 84; x++) {
        const lit = (y: number) => pixels[y * 84 + x] === 1;
        if (!lit(7 + 10 * row) || !lit(16 + 10 * row)) continue;
        for (let y = 7 + 10 * row; y <= 16 + 10 * row; y++) out[y * 84 + x] = 0;
        return { pixels: out, cursor: [row, x] };
      }
    }
    return { pixels: out };
  }

  function band(pixels: Uint8Array, y0: number, y1: number): string[] {
    const rows: string[] = [];
    for (let y = y0; y <= y1; y++) {
      let row = "";
      for (let x = 0; x < 84; x++) row += pixels[y * 84 + x] === 1 ? "#" : ".";
      rows.push(row);
    }
    return rows;
  }

  const byGolden = new Map<string, [string, TextTrace][]>();
  for (const [id, trace] of Object.entries(TEXT_TRACES)) {
    const golden = id.split("#")[0]!;
    byGolden.set(golden, [...(byGolden.get(golden) ?? []), [id, trace]]);
  }

  for (const [goldenId, traces] of byGolden) {
    it(goldenId, () => {
      const golden = loadGolden(goldenId);
      const names = new Set(golden.images.map((image) => image.name));
      const checked = new Set<string>();
      for (const [id, trace] of traces) {
        let top = 0;
        for (const shot of replayTrace(trace)) {
          const { state } = shot;
          const lines = wrapText(
            state.text,
            "small",
            EDITOR_LINE_WIDTH,
            pendingSlot(state, "small"),
          );
          top = viewTop(lines, state.cursor, 3, top);
          if (!names.has(shot.image)) continue;
          checked.add(shot.image);
          const where = `${id} ${shot.image} "${state.text}"`;
          const { pixels } = golden.images.find((image) => image.name === shot.image)!;
          const fb = new Framebuffer();
          for (let row = 0; row < 3 && top + row < lines.length; row++) {
            const line = lines[top + row]!;
            fb.drawText(
              STOCK_FONTS.small,
              Array.from(state.text).slice(line.start, line.end).join(""),
              1,
              8 + 10 * row,
            );
          }
          const captured = withoutCursor(pixels);
          expect(band(captured.pixels, 7, 36), where).toEqual(band(fb.pixels, 7, 36));
          if (captured.cursor !== undefined) {
            expect(state.pending, `${where}: a cursor while a character is pending`).toBeNull();
            const line = cursorLine(lines, state.cursor);
            const before = Array.from(state.text).slice(lines[line]!.start, state.cursor).join("");
            expect(captured.cursor, `${where}: the cursor`).toEqual([
              line - top,
              textWidth("small", before),
            ]);
          }
          const sprite = WIDGET_DATA.sprites[MODE_SPRITES[shownMode(state)]!]!;
          expect(
            band(pixels, 0, 5).map((row) => row.slice(sprite.x, sprite.x + sprite.art[0]!.length)),
            `${where}: mode`,
          ).toEqual(sprite.art);
        }
      }
      expect([...checked].sort(), goldenId).toEqual([...names].sort());
    });
  }
});
