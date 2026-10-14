import { describe, expect, it } from "vite-plus/test";
import { rowsWindowTop } from "../src/index";

/** The visible indices for a window top (circular). */
function rowsOf(top: number, count: number, rows = 3): number[] {
  return Array.from({ length: Math.min(rows, count) }, (_, row) => (top + row) % count);
}

/** Replays ▼/▲ presses from entry at `start`, returning the visible rows after each step. */
function walk(count: number, start: number, keys: string): number[][] {
  let selected = start;
  let top = rowsWindowTop(undefined, selected, count, 3);
  const seen = [rowsOf(top, count)];
  for (const key of keys) {
    selected = (selected + (key === "v" ? 1 : -1) + count) % count;
    top = rowsWindowTop(top, selected, count, 3);
    seen.push(rowsOf(top, count));
  }
  return seen;
}

describe("rowsWindowTop", () => {
  it("is 0 on entry with count <= rows, else the selection is on the top row", () => {
    expect(rowsWindowTop(undefined, 2, 3, 3)).toBe(0);
    expect(rowsWindowTop(undefined, 1, 2, 3)).toBe(0);
    expect(rowsWindowTop(undefined, 0, 1, 3)).toBe(0);
    expect(rowsWindowTop(undefined, 0, 10, 3)).toBe(0);
    expect(rowsWindowTop(undefined, 5, 10, 3)).toBe(5);
    // A level of 4 opening on its last item wraps the window (Maximum time / 1 hour / 6 hours).
    expect(rowsOf(rowsWindowTop(undefined, 3, 4, 3), 4)).toEqual([3, 0, 1]);
  });

  it("keeps the window while ▼/▲ stay inside it", () => {
    expect(rowsWindowTop(0, 1, 10, 3)).toBe(0);
    expect(rowsWindowTop(0, 2, 10, 3)).toBe(0);
    expect(rowsWindowTop(4, 5, 10, 3)).toBe(4);
    expect(rowsWindowTop(4, 4, 10, 3)).toBe(4);
  });

  it("scrolls ▼ to the item after the bottom row onto the bottom row", () => {
    expect(rowsWindowTop(0, 3, 10, 3)).toBe(1);
    expect(rowsWindowTop(6, 9, 10, 3)).toBe(7);
  });

  it("puts ▲ above the window on the top row", () => {
    expect(rowsWindowTop(4, 3, 10, 3)).toBe(3);
  });

  it("continues ▼ circularly past the last item (P1)", () => {
    expect(rowsOf(rowsWindowTop(7, 0, 10, 3), 10)).toEqual([8, 9, 0]);
    expect(rowsOf(rowsWindowTop(8, 1, 10, 3), 10)).toEqual([9, 0, 1]);
    expect(rowsOf(rowsWindowTop(9, 2, 10, 3), 10)).toEqual([0, 1, 2]);
  });

  it("puts the last item on the top row for ▲ from the first (P1, P2)", () => {
    expect(rowsOf(rowsWindowTop(0, 9, 10, 3), 10)).toEqual([9, 0, 1]);
    expect(rowsOf(rowsWindowTop(0, 4, 5, 3), 5)).toEqual([4, 0, 1]);
  });

  it("puts the selection on the top row for a jump outside the window", () => {
    expect(rowsWindowTop(0, 6, 10, 3)).toBe(6);
    expect(rowsWindowTop(5, 1, 10, 3)).toBe(1);
  });

  it("returning to the item after the bottom row keeps it on the bottom row (D12 Top score)", () => {
    // Snake II menu (6 items), window [3, 4, 5]; New game (0) follows Instructions (5).
    expect(rowsOf(rowsWindowTop(3, 0, 6, 3), 6)).toEqual([4, 5, 0]);
  });

  it("follows the Phone book captures (10 items, P1)", () => {
    // Phone book: Search(0) … Service Nos.(9). ▼×9 then ▼×3 past the wrap.
    const seen = walk(10, 0, "vvvvvvvvvvvv");
    expect(seen[9]).toEqual([7, 8, 9]);
    expect(seen.slice(10)).toEqual([
      [8, 9, 0], // Speed dials / Voice tags / Search
      [9, 0, 1], // Voice tags / Search / Service Nos.
      [0, 1, 2], // Search / Service Nos. / Add name
    ]);
    // ▲ from the first item: Voice tags / Search / Service Nos.
    expect(walk(10, 0, "^")[1]).toEqual([9, 0, 1]);
  });

  it("wraps lists of 5 and 6 both ways (Games, Profiles; P2)", () => {
    expect(walk(5, 0, "vvvvv").slice(3)).toEqual([
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 0],
    ]);
    expect(walk(5, 0, "^^")).toEqual([
      [0, 1, 2],
      [4, 0, 1],
      [3, 4, 0],
    ]);
    expect(walk(6, 0, "vvvvvv")[6]).toEqual([4, 5, 0]);
    expect(walk(6, 0, "^")[1]).toEqual([5, 0, 1]);
  });

  it("never scrolls lists of 1, 2 or 3 (P2)", () => {
    for (const count of [1, 2, 3]) {
      for (const view of walk(count, 0, "vvvv^^^^")) expect(view[0]).toBe(0);
    }
  });

  it("scrolls a list of 4 by one", () => {
    expect(walk(4, 0, "vvvv^")).toEqual([
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2],
      [1, 2, 3],
      [2, 3, 0],
      [2, 3, 0],
    ]);
  });

  it("is 0 for an empty list and rejects out-of-range input", () => {
    expect(rowsWindowTop(undefined, 0, 0, 3)).toBe(0);
    expect(() => rowsWindowTop(undefined, 0, 4, 0)).toThrow(/rows/);
    expect(() => rowsWindowTop(undefined, 4, 4, 3)).toThrow(/selected/);
    expect(() => rowsWindowTop(4, 0, 4, 3)).toThrow(/previousTop/);
    expect(() => rowsWindowTop(undefined, 0, 1.5, 3)).toThrow(/count/);
  });
});
