// Short text set for the LCD's reader pages: the stock thin font, three lines a page, as the
// stock firmware's game instructions show it (`text-pages`).
import { missingStockGlyphs, STOCK_FONTS } from "@hellotimber/nokia-kit/ui/resources";
import { textWidth } from "@hellotimber/phone-screen";

/** Columns a reader line may take (the LCD is 84 wide; lines start at x 0). */
export const READER_WIDTH = 84;
const LINES_PER_PAGE = 3;

/** `text` word-wrapped into reader pages; throws on a glyph the thin font lacks or a word too wide. */
export function readerPages(text: string): string[][] {
  const missing = missingStockGlyphs(text, "thin");
  if (missing.length > 0) {
    throw new Error(`"${text}" has characters the stock thin font lacks: ${missing.join(" ")}`);
  }
  const fits = (line: string) => textWidth(STOCK_FONTS.thin, line) <= READER_WIDTH;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!fits(word)) throw new Error(`"${word}" is wider than an LCD line.`);
    const next = line === "" ? word : `${line} ${word}`;
    if (fits(next)) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") lines.push(line);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }
  return pages;
}
