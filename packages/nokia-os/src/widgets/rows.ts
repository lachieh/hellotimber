import { rowsWindowTop, type MenuIndicator, type PhoneKey } from "@hellotimber/phone-core";
import { VISIBLE_ROWS } from "../display/list-rows";

/** A widget list's selection and circular window (D3), shared by option lists and multi-select. */
export interface RowsCursor {
  /** null = nothing selected yet (an unset option list). */
  readonly selected: number | null;
  readonly windowTop: number;
}

/** The cursor on entry: the window at `selected` when the list scrolls, else 0. */
export function openRows(selected: number | null, count: number): RowsCursor {
  return {
    selected,
    windowTop: selected === null ? 0 : rowsWindowTop(undefined, selected, count, VISIBLE_ROWS),
  };
}

/**
 * ▲/▼ move the selection circularly; any other key leaves the cursor unchanged (undefined). An
 * unset list's first ▼ selects the first item and its first ▲ the last, as on entry (P10).
 */
export function moveRows(cursor: RowsCursor, key: PhoneKey, count: number): RowsCursor | undefined {
  if ((key !== "up" && key !== "down") || count === 0) return undefined;
  const { selected } = cursor;
  if (selected === null) return openRows(key === "down" ? 0 : count - 1, count);
  const next = (selected + (key === "down" ? 1 : count - 1)) % count;
  return {
    selected: next,
    windowTop: rowsWindowTop(cursor.windowTop, next, count, VISIBLE_ROWS),
  };
}

/**
 * What a widget list's indicator puts before the selected item's number: the list's own path
 * (`5-2-1`), its parent level's path (Call divert lists: `7-3-1` on 7-3-4), or nothing (Message
 * settings › Set n lists: `6`). See `optionListNumbering` in the firmware bindings.
 */
export type ListNumbering = "path" | "parent" | "option";

/**
 * A widget list's indicator: the kernel's position, cut per `numbering`, plus the selected
 * item's number (0 while unset), or the kernel's awaiting form unchanged while a shortcut digit
 * is awaited.
 */
export function rowsIndicator(
  position: MenuIndicator,
  selected: number | null,
  numbering: ListNumbering = "path",
): MenuIndicator {
  if (position.typed !== undefined || position.awaitingFirst) return position;
  const prefix =
    numbering === "path"
      ? position.segments
      : numbering === "parent"
        ? position.segments.slice(0, -1)
        : [];
  return { ...position, segments: [...prefix, selected === null ? 0 : selected + 1] };
}
