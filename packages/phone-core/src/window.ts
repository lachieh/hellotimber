function assertIndex(name: string, value: number, count: number): void {
  if (!Number.isInteger(value) || value < 0 || value >= count) {
    throw new Error(`${name} ${value} must index one of ${count} items.`);
  }
}

/**
 * The circular rows-window rule: the index of the item on the first of `rows` visible rows.
 *
 * With `count <= rows` the window is always 0. Entering a level (`previousTop` undefined) puts the
 * selection on the top row. Afterwards the window keeps its position while the selection stays
 * inside it (indices taken modulo `count`); a move to the item just after the bottom row scrolls
 * so the selection is on the bottom row; any other move outside the window (▲ above it, the wrap
 * from the first item, a jump) puts the selection on the top row.
 */
export function rowsWindowTop(
  previousTop: number | undefined,
  selected: number,
  count: number,
  rows: number,
): number {
  if (!Number.isInteger(rows) || rows <= 0) {
    throw new Error(`rows must be a positive integer (received ${rows}).`);
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`count must be a non-negative integer (received ${count}).`);
  }
  if (count === 0) return 0;
  assertIndex("selected", selected, count);
  if (previousTop !== undefined) assertIndex("previousTop", previousTop, count);
  if (count <= rows) return 0;
  if (previousTop === undefined) return selected;
  const offset = (selected - previousTop + count) % count;
  if (offset < rows) return previousTop;
  if (offset === rows) return (selected - rows + 1 + count) % count;
  return selected;
}
