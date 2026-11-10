import type { PhoneKey } from "@hellotimber/phone-core";
import type { TextPageModel } from "../display/widgets";
import { advance, textWidth } from "../text/layout";
import type { Flow, Widget } from "./flow";

/** A text page's width: thin-face lines run from x 0 across the whole LCD. */
const TEXT_PAGE_WIDTH = 84;

/** The lines a stock text page holds (`tree/08-games/8-1-6.leaf`). */
const TEXT_PAGE_LINES = 3;

/**
 * `text` as text-page lines. Measured on the five stock instruction texts (`tree/08-games`
 * 8-1-6, 8-2-4, 8-3-3, 8-4-1-5, 8-4-2-5): a word stays on the line while its advances end within
 * the 84 columns (`2,4,6 and 8. Use key`, 84, stays; the narrowest word moved would have ended at
 * 85), without the two-column margin of the editor's `wrapText`. The space a line breaks at is
 * not drawn. A word wider than a line is not captured: it starts a line and breaks where it
 * overflows, as in the editor.
 */
function wrapLines(text: string): string[] {
  const lines: string[] = [];
  let line = "";
  let x = 0;
  const breakLine = (): void => {
    lines.push(line);
    line = "";
    x = 0;
  };
  for (const [token] of text.matchAll(/ +|[^ ]+/g)) {
    const width = textWidth("thin", token);
    if (token.startsWith(" ")) {
      line += token;
      x += width;
      continue;
    }
    if (line.trimEnd() !== "" && x + width > TEXT_PAGE_WIDTH) breakLine();
    if (x + width <= TEXT_PAGE_WIDTH) {
      line += token;
      x += width;
      continue;
    }
    for (const char of token) {
      const charWidth = advance("thin", char);
      if (x > 0 && x + charWidth > TEXT_PAGE_WIDTH) breakLine();
      line += char;
      x += charWidth;
    }
  }
  lines.push(line);
  return lines.map((each) => each.trimEnd()).filter((each) => each !== "");
}

/**
 * Texts of any length as `textPages` screens (plan 28 D5): each text is wrapped in the thin face
 * as the stock instructions are (`wrapLines`) and cut into screens of the three lines a stock
 * page holds. Every text starts a new screen; an empty one is a blank screen.
 */
export function wrapTextPages(texts: readonly string[]): readonly (readonly string[])[] {
  return texts.flatMap((text) => {
    const lines = wrapLines(text);
    const screens: string[][] = [];
    for (let i = 0; i < lines.length; i += TEXT_PAGE_LINES) {
      screens.push(lines.slice(i, i + TEXT_PAGE_LINES));
    }
    return screens.length === 0 ? [[]] : screens;
  });
}

/**
 * Instructions: `More` pages through the text and cycles to the first page; C leaves (P12).
 * `pages` are screens of at most three lines (`wrapTextPages` makes them from longer texts).
 */
export function textPages(options: {
  readonly pages: readonly (readonly string[])[];
  readonly softkey: string;
}): Widget {
  if (options.pages.length === 0) throw new Error("Text pages need at least one page.");
  let page = 0;
  return {
    render: (): TextPageModel => ({
      kind: "text-page",
      lines: options.pages[page]!,
      softkey: options.softkey,
    }),
    onKey(key: PhoneKey, flow: Flow) {
      if (key === "navi") page = (page + 1) % options.pages.length;
      else if (key === "c") flow.back();
    },
  };
}
