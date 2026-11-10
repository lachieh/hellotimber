// Plan 28 (D5): the wrap `wrapTextPages` gives SDK games' instructions is the firmware's. Every
// stock instruction text (the games' `text-pages` leaves, from the tree goldens), joined back
// into one text, re-wraps into the pages captured from the phone.
import { describe, expect, it } from "vite-plus/test";
import { wrapTextPages } from "@hellotimber/nokia-kit/ui/widgets/text-pages";
import { STOCK_TREE, type StockTreeNode } from "../src/firmware/generated/stock-tree";

type Pages = readonly (readonly string[])[];

function stockTextPages(): { readonly number: string; readonly pages: Pages }[] {
  const found: { number: string; pages: Pages }[] = [];
  const walk = (node: StockTreeNode): void => {
    if (node.opens.kind === "text-pages")
      found.push({ number: node.number, pages: node.opens.pages });
    node.children?.forEach(walk);
  };
  STOCK_TREE.forEach(walk);
  return found;
}

describe("wrapTextPages against the stock instructions", () => {
  const stock = stockTextPages();

  it("covers every game's instructions", () => {
    expect(stock.map((each) => each.number)).toEqual([
      "8-1-6",
      "8-2-4",
      "8-3-3",
      "8-4-1-5",
      "8-4-2-5",
    ]);
  });

  it.each(stock)("re-wraps $number into its captured pages", ({ pages }) => {
    expect(wrapTextPages([pages.flat().join(" ")])).toEqual(pages);
  });
});
