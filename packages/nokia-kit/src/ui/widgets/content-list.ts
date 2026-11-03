// Plan 18c: the list of Templates or Smileys (`content/templates-list`): rows read afresh on every
// render (an Erase or a Save shows at once), the circular rows window, the soft key's choice on
// OK, C back (held: standby).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { ContentListModel } from "../display/widgets";
import type { Flow, Widget } from "./flow";
import { HeldC } from "./held-c";
import { moveRows, openRows, rowsIndicator, type ListNumbering, type RowsCursor } from "./rows";

export interface ContentListOptions {
  /** The rows' texts, read on every render. */
  readonly rows: () => readonly string[];
  /** The rows' icon sprite (templates), if any. */
  readonly icon?: string;
  readonly opening: number;
  readonly softkey: string;
  /** What the indicator shows before the row's number (default: the list's path). */
  readonly numbering?: ListNumbering;
  /** The numbers the indicator shows before the row's (an editor's Options › Template: `3`). */
  readonly indicatorPrefix?: readonly number[];
  /** The soft key on row `index`. */
  choose(index: number, flow: Flow): void;
}

class ContentListWidget implements Widget {
  readonly #options: ContentListOptions;
  #cursor: RowsCursor;
  readonly #c = new HeldC();

  constructor(options: ContentListOptions) {
    this.#options = options;
    this.#cursor = openRows(options.opening, options.rows().length);
  }

  render(flow: Flow): ContentListModel {
    const { rows, icon, softkey, indicatorPrefix, numbering } = this.#options;
    const selected = this.#cursor.selected ?? 0;
    const position = flow.indicator();
    const indicator =
      indicatorPrefix === undefined
        ? rowsIndicator(position, selected, numbering)
        : { ...position, segments: [...indicatorPrefix, selected + 1] };
    return {
      kind: "content-list",
      rows: rows(),
      ...(icon === undefined ? {} : { icon }),
      selected,
      windowTop: this.#cursor.windowTop,
      indicator,
      softkey,
    };
  }

  onKeyDown(key: PhoneKey): void {
    if (key === "c") this.#c.down();
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (key === "c") {
      this.#c.up(flow);
    } else if (key === "navi") {
      this.#options.choose(this.#cursor.selected ?? 0, flow);
    } else {
      const moved = moveRows(this.#cursor, key, this.#options.rows().length);
      if (moved !== undefined) this.#cursor = moved;
    }
  }

  tick(dtMs: number, flow: Flow): void {
    this.#c.tick(dtMs, flow);
  }
}

export function contentList(options: ContentListOptions): Widget {
  return new ContentListWidget(options);
}
