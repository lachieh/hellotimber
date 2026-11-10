import type { PhoneKey } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { paintWidget } from "../src/ui/display/widgets";
import { textWidth } from "../src/ui/text/layout";
import type { Flow, Widget } from "../src/ui/widgets/flow";
import { textPages, wrapTextPages } from "../src/ui/widgets/text-pages";

/** A flow that counts `back()`; text pages use nothing else. */
function fakeFlow(): Flow & { backs: number } {
  const flow = {
    backs: 0,
    back() {
      flow.backs++;
    },
  };
  return flow as unknown as Flow & { backs: number };
}

function press(widget: Widget, key: PhoneKey, flow: Flow): void {
  widget.onKeyDown?.(key, flow);
  widget.onKey?.(key, flow);
}

describe("wrapTextPages", () => {
  it("leaves a text that fits one line as one screen of one line", () => {
    expect(wrapTextPages(["Next page"])).toEqual([["Next page"]]);
  });

  it("wraps at words in the thin face and cuts each page into screens of three lines", () => {
    const text =
      "Make the snake grow longer by directing it to the food. Use the keys 2, 4, 6 and 8.";
    const screens = wrapTextPages([text]);
    expect(screens).toEqual([
      ["Make the snake", "grow longer by", "directing it to the"],
      ["food. Use the keys", "2, 4, 6 and 8."],
    ]);
    for (const line of screens.flat()) expect(textWidth("thin", line)).toBeLessThanOrEqual(84);
  });

  it("keeps a word that ends within the 84 columns, without the editor's two-column margin", () => {
    // Bantumi's last page (`tree/08-games/8-3-3`): 83 columns stay on one line.
    expect(textWidth("thin", "opponent's pot. Most")).toBe(83);
    expect(wrapTextPages(["get beans from opponent's pot. Most beans win."])).toEqual([
      ["get beans from", "opponent's pot. Most", "beans win."],
    ]);
    // Pairs II (`8-4-1-5`): exactly 84 stays; one more column moves the word.
    expect(textWidth("thin", "2,4,6 and 8. Use key")).toBe(84);
    expect(wrapTextPages(["2,4,6 and 8. Use key 5"])).toEqual([["2,4,6 and 8. Use key", "5"]]);
    expect(textWidth("thin", "Make the snake grow")).toBe(87);
    expect(wrapTextPages(["Make the snake grow"])).toEqual([["Make the snake", "grow"]]);
  });

  it("keeps the spaces inside a line and draws none at a line's end", () => {
    expect(wrapTextPages(["a  b   "])).toEqual([["a  b"]]);
    expect(wrapTextPages(["   "])).toEqual([[]]);
  });

  it("breaks a word longer than a line where it overflows the 84 columns", () => {
    // The thin `W` advances 8 columns: ten fill a line (80), an eleventh would end at 88.
    expect(textWidth("thin", "W")).toBe(8);
    const line = "W".repeat(10);
    expect(wrapTextPages(["W".repeat(10 * 7)])).toEqual([
      [line, line, line],
      [line, line, line],
      [line],
    ]);
  });

  it("starts every page on a new screen, in order, and keeps an empty page as a blank screen", () => {
    const line = "W".repeat(10);
    expect(wrapTextPages([`${line} ${line} ${line} ${line}`, "", "End"])).toEqual([
      [line, line, line],
      [line],
      [],
      ["End"],
    ]);
  });

  it("makes screens the stock painter draws", () => {
    for (const lines of wrapTextPages(["W".repeat(200), "a b c ".repeat(40)])) {
      expect(() =>
        paintWidget(new Framebuffer(), { kind: "text-page", lines, softkey: "More" }),
      ).not.toThrow();
    }
  });
});

describe("textPages", () => {
  it("More steps through every screen of every wrapped page and cycles; C leaves", () => {
    const line = "W".repeat(10);
    const screens = wrapTextPages(["W".repeat(10 * 4), "Next page"]);
    const widget = textPages({ pages: screens, softkey: "More" });
    const flow = fakeFlow();
    const expected = [[line, line, line], [line], ["Next page"]];
    for (const lines of [...expected, ...expected]) {
      expect(widget.render(flow)).toEqual({ kind: "text-page", lines, softkey: "More" });
      press(widget, "navi", flow);
    }
    expect(flow.backs).toBe(0);
    press(widget, "c", flow);
    expect(flow.backs).toBe(1);
  });

  it("shows pre-split stock pages as given", () => {
    const pages = [["Make the snake", "grow longer by", "directing it to the"], ["food."]];
    const widget = textPages({ pages, softkey: "More" });
    const flow = fakeFlow();
    expect(widget.render(flow)).toEqual({ kind: "text-page", lines: pages[0], softkey: "More" });
    press(widget, "navi", flow);
    expect(widget.render(flow)).toEqual({ kind: "text-page", lines: pages[1], softkey: "More" });
  });

  it("needs at least one page", () => {
    expect(() => textPages({ pages: [], softkey: "More" })).toThrow("at least one page");
  });
});
